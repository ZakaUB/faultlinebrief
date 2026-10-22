import datetime
import decimal
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import psycopg
from psycopg.rows import dict_row

DB_ID = "cc4cf967-6c3a-4c7d-a5a1-ca3cd9f2d8a9"
SOURCE = os.environ["PRODUCTION_DATABASE_URL"]
host = urllib.parse.urlparse(SOURCE).hostname or ""
if not host.endswith(".neon.tech"):
    raise SystemExit("Refusing non-Neon source")
endpoint = ("https://api.cloudflare.com/client/v4/accounts/"
            + os.environ["CLOUDFLARE_ACCOUNT_ID"] + "/d1/database/" + DB_ID + "/query")
headers = {"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"],
           "Content-Type": "application/json"}


def norm(value):
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: norm(v) for k, v in value.items()}
    if isinstance(value, list):
        return [norm(v) for v in value]
    return value


def encode(value):
    return json.dumps(norm(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def query(sql, params=()):
    data = json.dumps({"sql": sql, "params": list(params)}, ensure_ascii=False).encode()
    for attempt in range(5):
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.load(response)
            if not result.get("success") or any(not x.get("success", True) for x in result.get("result", [])):
                raise RuntimeError("D1 query failed: " + str(result.get("errors", [])))
            return [r for part in result.get("result", []) for r in part.get("results", [])]
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise


# The destination must be a clean production database, never mixed staging content.
existing = query("SELECT COUNT(*) AS n FROM migration_articles")
if int(existing[0]["n"]) != 0:
    raise SystemExit("Destination contains articles; refusing to overwrite or merge")

with psycopg.connect(SOURCE, row_factory=dict_row) as conn:
    conn.execute("SET TRANSACTION READ ONLY")
    tables = ("articles", "media", "categories", "articles_rels", "articles_sources")
    rows = {name: [dict(x) for x in conn.execute("SELECT * FROM public." + name)] for name in tables}

published = [a for a in rows["articles"] if a["status"] == "published"]
if len(published) < 40:
    raise SystemExit("Unexpected published article count: " + str(len(published)))
slugs = [a["slug"] for a in published]
if len(slugs) != len(set(slugs)):
    raise SystemExit("Duplicate published slugs")

media = {str(m["id"]): m for m in rows["media"]}
categories = {str(c["id"]): c for c in rows["categories"]}
article_ids = {a["id"] for a in published}
relations = [r for r in rows["articles_rels"] if r["parent_id"] in article_ids]
used_categories = {str(r["categories_id"]) for r in relations if r["categories_id"] is not None}
used_media = {str(a["featured_image_id"]) for a in published if a["featured_image_id"] is not None}
if not used_categories.issubset(categories) or not used_media.issubset(media):
    raise SystemExit("Missing production category or media reference")

for category_id in sorted(used_categories):
    c = categories[category_id]
    query("INSERT INTO migration_categories(id,slug,name,raw_json) VALUES (?,?,?,?)",
          [category_id, c["slug"], c["name"], encode(c)])
for media_id in sorted(used_media):
    query("INSERT INTO migration_media(id,raw_json) VALUES (?,?)",
          [media_id, encode(media[media_id])])

for article in sorted(published, key=lambda a: a["slug"]):
    related = sorted((r for r in relations if r["parent_id"] == article["id"]),
                     key=lambda r: (r.get("order") or 0, r["id"]))
    sources = sorted((s for s in rows["articles_sources"] if s["_parent_id"] == article["id"]),
                     key=lambda s: s.get("_order") or 0)
    metadata = {
        "seo_title": article.get("seo_title"),
        "seo_description": article.get("seo_description"),
        "deck": article.get("deck"),
        "homepage_lead": article.get("homepage_lead"),
        "editorial_placement": article.get("editorial_placement"),
        "created_at": article.get("created_at"),
        "category_relationships": related,
        "source_article": article,
    }
    image = media.get(str(article["featured_image_id"]), {}) if article["featured_image_id"] is not None else {}
    query("""INSERT INTO migration_articles
        (id,slug,title,status,published_at,updated_at,content_json,metadata_json,source_json,image_json)
        VALUES (?,?,?,?,?,?,?,?,?,?)""",
        [str(article["id"]), article["slug"], article["headline"], "published",
         norm(article["published_at"]) if article["published_at"] else None,
         norm(article["updated_at"]), encode(article["body"]), encode(metadata),
         encode(sources), encode(image)])

count = int(query("SELECT COUNT(*) AS n FROM migration_articles WHERE status='published'")[0]["n"])
if count != len(published):
    raise SystemExit("Import incomplete: " + str(count) + "/" + str(len(published)))
query("INSERT INTO migration_manifest(key,value) VALUES (?,?)",
      ["source_published_count", str(count)])
print("SUCCESS: imported", count, "published articles into production D1")
print("Imported", len(used_categories), "categories and", len(used_media), "media metadata records")
print("No production Neon writes, Worker deployment, or domain changes")

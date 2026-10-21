#!/usr/bin/env python3
"""Build deterministic staging D1 SQL from reviewed JSON exports, offline.

Input JSON: {"articles":[...],"categories":[...],"media":[...]}.
Only a staging read model: full Payload authentication/editor migration requires
separate compatibility work. No credentials or live database access required.
"""
import argparse
import hashlib
import json
from pathlib import Path

def quote(v):
    return "'" + str(v).replace("'", "''") + "'"

def canonical(v):
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Reviewed JSON export")
    p.add_argument("--output", required=True, help="Generated SQL for isolated D1 staging only")
    args = p.parse_args()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    lines = ["-- IMPORT ONLY INTO A NEW ISOLATED STAGING D1 DATABASE", "BEGIN TRANSACTION;"]
    counts = {}
    for collection, table in (("articles", "migration_articles"), ("categories", "migration_categories"), ("media", "migration_media")):
        rows = data.get(collection, [])
        if not isinstance(rows, list):
            raise ValueError(collection + " must be an array")
        ids = set()
        slugs = set()
        for row in rows:
            rid = str(row["id"])
            if rid in ids:
                raise ValueError("Duplicate ID in " + collection + ": " + rid)
            ids.add(rid)
            if collection in ("articles", "categories"):
                slug = str(row["slug"])
                if not slug or slug in slugs:
                    raise ValueError("Missing or duplicate slug in " + collection)
                slugs.add(slug)
            if collection == "articles":
                vals = [rid, slug, row.get("title",""), row.get("status", row.get("_status","draft")),
                        row.get("publishedAt", row.get("published_at","")), row.get("updatedAt", row.get("updated_at","")),
                        canonical(row.get("content", row)), canonical(row.get("meta",{})),
                        canonical(row.get("sources",[])), canonical(row.get("featuredImage",{}))]
                cols = "id,slug,title,status,published_at,updated_at,content_json,metadata_json,source_json,image_json"
            elif collection == "categories":
                vals = [rid,slug,row.get("name",row.get("title","")),canonical(row)]
                cols = "id,slug,name,raw_json"
            else:
                vals = [rid,canonical(row)]
                cols = "id,raw_json"
            lines.append(f"INSERT INTO {table} ({cols}) VALUES (" + ",".join(quote(v) for v in vals) + ");")
        counts[collection] = len(rows)
    fingerprint = hashlib.sha256(canonical(data).encode("utf-8")).hexdigest()
    lines.append("INSERT OR REPLACE INTO migration_manifest(key,value) VALUES ('source_sha256'," + quote(fingerprint) + ");")
    for k,v in counts.items():
        lines.append("INSERT OR REPLACE INTO migration_manifest(key,value) VALUES (" + quote(k+"_count") + "," + quote(v) + ");")
    lines.append("COMMIT;")
    Path(args.output).write_text("\n".join(lines)+"\n", encoding="utf-8")
    print(canonical({"counts":counts,"source_sha256":fingerprint,"output":args.output}))

if __name__ == "__main__":
    main()

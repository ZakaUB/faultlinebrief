#!/usr/bin/env python3
"""Offline read-only parity checker for two CSV exports. Never connects to production.
Usage: python migration-emergency/verify-export.py neon/articles.csv d1/articles.csv
"""
import csv, hashlib, json, pathlib, sys

def inspect(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    keys = set(rows[0]) if rows else set()
    canonical = [json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":")) for row in rows]
    digest = hashlib.sha256("\n".join(sorted(canonical)).encode("utf-8")).hexdigest()
    ids = [row.get("id") for row in rows if "id" in keys]
    return {"rows": len(rows), "columns": sorted(keys), "sha256": digest, "unique_ids": len(set(ids)) if ids else None}

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    left, right = [inspect(pathlib.Path(p)) for p in sys.argv[1:]]
    print(json.dumps({"source": left, "destination": right, "match": left == right}, indent=2))
    sys.exit(0 if left == right else 1)

"""Build the public 16-column source index from this checkout's sources.json.

The previous workbook-based export lives outside this repository and targets a
fixed sibling checkout. This standard-library build preserves its CSV contract.
"""

import argparse
import csv
from io import StringIO
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "sources.json"
OUTPUT = ROOT / "sources.csv"
COLUMNS = [
    ("Title", "title"), ("Publisher", "publisher"),
    ("Document date", "date"), ("Document type", "type"),
    ("Topic", "topic"), ("Review status", "status"),
    ("Summary", "summary"), ("Source URL", "url"),
    ("Document location and context", "locator"),
    ("Access checked", "accessChecked"), ("Record reference", "id"),
    ("Year", "year"),
]
EXTRAS = ["Review status explanation", "Research checked", "Collection scope", "Closure status caveat"]


def safe(value):
    value = str(value if value is not None else "")
    return "'" + value if re.match(r"^\s*[=+\-@]", value) else value


def build():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    records = data["records"]
    ids = [record["id"] for record in records]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Missing or duplicate source reference")
    stream = StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
    writer.writerow([label for label, _ in COLUMNS] + EXTRAS)
    for record in records:
        values = [record[key] for _, key in COLUMNS]
        values.extend([
            data["coverageDefinitions"][record["status"]],
            data["researchChecked"], data["scope"], data["currentClosureStatus"],
        ])
        writer.writerow([safe(value) for value in values])
    return ("\ufeff" + stream.getvalue()).encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when sources.csv is stale")
    args = parser.parse_args()
    expected = build()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != expected:
            parser.error("sources.csv is stale; run build_sources.py")
        print("sources.csv matches sources.json")
    else:
        OUTPUT.write_bytes(expected)
        print(f"Wrote {OUTPUT.name}")


if __name__ == "__main__":
    main()

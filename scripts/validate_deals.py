#!/usr/bin/env python3
"""Validate Teacher Treasure seed deal data without third-party dependencies."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "deals.json"
REQUIRED = {
    "id", "title", "organization", "type", "category", "locationType",
    "region", "url", "description", "verified", "created", "saves"
}
VALID_TYPES = {"Free", "Discount", "Giveaway", "Grant"}
VALID_LOCATIONS = {"Online", "Local"}


def valid_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except (TypeError, ValueError):
        return False


def main() -> None:
    deals = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if not isinstance(deals, list):
        raise SystemExit("data/deals.json must contain a JSON array")

    errors: list[str] = []
    seen_ids: set[str] = set()
    for index, deal in enumerate(deals, start=1):
        label = f"deal #{index}"
        if not isinstance(deal, dict):
            errors.append(f"{label}: must be an object")
            continue

        missing = REQUIRED - deal.keys()
        if missing:
            errors.append(f"{label}: missing {', '.join(sorted(missing))}")

        deal_id = str(deal.get("id", ""))
        if not deal_id:
            errors.append(f"{label}: id cannot be empty")
        elif deal_id in seen_ids:
            errors.append(f"{label}: duplicate id {deal_id!r}")
        seen_ids.add(deal_id)

        if deal.get("type") not in VALID_TYPES:
            errors.append(f"{label}: invalid type {deal.get('type')!r}")
        if deal.get("locationType") not in VALID_LOCATIONS:
            errors.append(f"{label}: invalid locationType {deal.get('locationType')!r}")
        if deal.get("created") and not valid_date(deal["created"]):
            errors.append(f"{label}: created must use YYYY-MM-DD")
        if deal.get("expires") and not valid_date(deal["expires"]):
            errors.append(f"{label}: expires must use YYYY-MM-DD")

        parsed = urlparse(str(deal.get("url", "")))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"{label}: url must be an absolute HTTP(S) URL")

    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Validated {len(deals)} deal records.")


if __name__ == "__main__":
    main()

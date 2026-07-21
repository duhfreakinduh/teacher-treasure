#!/usr/bin/env python3
"""Validate Teacher Treasure deal data without third-party dependencies."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "deals.json"
REQUIRED = {
    "id", "title", "organization", "type", "category", "locationType",
    "region", "expires", "url", "description", "eligibility",
    "verificationStatus", "lastVerified", "created", "savingsLabel"
}
VALID_TYPES = {"Free", "Discount", "Giveaway", "Grant"}
VALID_LOCATIONS = {"Online", "Local"}
VALID_STATUSES = {"verified", "community"}
SEARCH_HOSTS = {"google.com", "www.google.com", "bing.com", "www.bing.com"}


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
    seen_urls: set[str] = set()
    today = date.today()

    for index, deal in enumerate(deals, start=1):
        label = f"deal #{index}"
        if not isinstance(deal, dict):
            errors.append(f"{label}: must be an object")
            continue

        missing = REQUIRED - deal.keys()
        if missing:
            errors.append(f"{label}: missing {', '.join(sorted(missing))}")

        deal_id = str(deal.get("id", "")).strip()
        if not deal_id:
            errors.append(f"{label}: id cannot be empty")
        elif deal_id in seen_ids:
            errors.append(f"{label}: duplicate id {deal_id!r}")
        seen_ids.add(deal_id)

        for field in ("title", "organization", "category", "region", "description", "eligibility"):
            if not str(deal.get(field, "")).strip():
                errors.append(f"{label}: {field} cannot be empty")

        if deal.get("type") not in VALID_TYPES:
            errors.append(f"{label}: invalid type {deal.get('type')!r}")
        if deal.get("locationType") not in VALID_LOCATIONS:
            errors.append(f"{label}: invalid locationType {deal.get('locationType')!r}")
        if deal.get("verificationStatus") not in VALID_STATUSES:
            errors.append(f"{label}: invalid verificationStatus {deal.get('verificationStatus')!r}")

        for field in ("created", "lastVerified"):
            value = deal.get(field)
            if value and not valid_date(value):
                errors.append(f"{label}: {field} must use YYYY-MM-DD")
        if deal.get("expires") and not valid_date(deal["expires"]):
            errors.append(f"{label}: expires must be blank or use YYYY-MM-DD")

        if deal.get("verificationStatus") == "verified":
            verified = deal.get("lastVerified", "")
            if not verified:
                errors.append(f"{label}: verified deals require lastVerified")
            elif valid_date(verified) and date.fromisoformat(verified) > today:
                errors.append(f"{label}: lastVerified cannot be in the future")

        url = str(deal.get("url", ""))
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"{label}: url must be an absolute HTTP(S) URL")
        elif parsed.netloc.lower() in SEARCH_HOSTS:
            errors.append(f"{label}: url must be an official source, not a search engine")
        if url in seen_urls:
            errors.append(f"{label}: duplicate url {url!r}")
        seen_urls.add(url)

    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Validated {len(deals)} verified deal records.")


if __name__ == "__main__":
    main()

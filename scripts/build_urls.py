#!/usr/bin/env python3
"""Generate Instagram search URLs for a keyword or hashtag."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus


def hashtag_candidates(query: str, limit: int) -> list[str]:
    cleaned = query.strip().lstrip("#").strip()
    tokens = re.findall(r"[\w]+", cleaned, flags=re.UNICODE)
    candidates: list[str] = []

    compact = "".join(tokens)
    if compact:
        candidates.append(compact)

    for token in tokens:
        if len(token) >= 2:
            candidates.append(token)

    seen: set[str] = set()
    unique: list[str] = []
    for candidate in candidates:
        key = candidate.casefold()
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
        if len(unique) >= limit:
            break
    return unique


def build_payload(query: str, hashtag_limit: int) -> dict:
    encoded = quote_plus(query.strip())
    tags = hashtag_candidates(query, hashtag_limit)
    return {
        "query": query,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "instagram": {
            "keyword_search": f"https://www.instagram.com/explore/search/keyword/?q={encoded}",
            "hashtag_pages": [
                f"https://www.instagram.com/explore/tags/{quote_plus(tag)}/"
                for tag in tags
            ],
        },
        "fallback_web_search": {
            "posts": f"https://www.google.com/search?q=site%3Ainstagram.com%2Fp%2F+%22{encoded}%22",
            "reels": f"https://www.google.com/search?q=site%3Ainstagram.com%2Freel%2F+%22{encoded}%22",
        },
        "notes": [
            "Open Instagram URLs with the user's logged-in browser session.",
            "Verify recency from each opened post timestamp; search pages may be ranked or personalized.",
            "Use fallback web searches only when native Instagram discovery is blocked or sparse.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Instagram keyword, phrase, or hashtag to search")
    parser.add_argument(
        "--hashtag-limit",
        type=int,
        default=6,
        help="Maximum hashtag page candidates to generate",
    )
    args = parser.parse_args()
    print(json.dumps(build_payload(args.query, args.hashtag_limit), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

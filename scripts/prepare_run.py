#!/usr/bin/env python3
"""Create a workspace folder for one Instagram keyword search."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from build_urls import build_payload


def slugify(value: str, limit: int = 60) -> str:
    parts = re.findall(r"[a-z0-9]+", value.casefold())
    slug = "-".join(parts)[:limit].strip("-")
    if slug:
        return slug
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Instagram keyword, phrase, or hashtag to search")
    parser.add_argument(
        "--base",
        default=".",
        help="Workspace directory where instagram-search/ should be created",
    )
    parser.add_argument("--hashtag-limit", type=int, default=6)
    parser.add_argument("--max-posts", type=int, default=30)
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    run_dir = (
        Path(args.base).expanduser().resolve()
        / "instagram-search"
        / f"{now.strftime('%Y%m%dT%H%M%SZ')}-{slugify(args.query)}"
    )
    images_dir = run_dir / "images"
    screenshots_dir = run_dir / "screenshots"
    metadata_dir = run_dir / "metadata"
    for directory in (images_dir, screenshots_dir, metadata_dir):
        directory.mkdir(parents=True, exist_ok=True)

    payload = build_payload(args.query, args.hashtag_limit)
    session = {
        "query": args.query,
        "created_at_utc": now.isoformat(),
        "max_posts": args.max_posts,
        "run_dir": str(run_dir),
        "directories": {
            "images": str(images_dir),
            "screenshots": str(screenshots_dir),
            "metadata": str(metadata_dir),
        },
        "urls": payload,
    }

    (metadata_dir / "session.json").write_text(
        json.dumps(session, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (metadata_dir / "media.jsonl").touch()
    (metadata_dir / "posts.jsonl").touch()
    (run_dir / "summary.md").write_text(
        f"# Instagram Search: {args.query}\n\n"
        f"- Created: {now.isoformat()}\n"
        "- Status: in progress\n",
        encoding="utf-8",
    )

    print(json.dumps(session, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

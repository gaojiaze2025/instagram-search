#!/usr/bin/env python3
"""Save the public Open Graph image for an Instagram post or reel."""

from __future__ import annotations

import argparse
import html
import json
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


class OpenGraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "meta":
            return
        values = {key.lower(): value for key, value in attrs if value is not None}
        key = values.get("property") or values.get("name")
        content = values.get("content")
        if key and content:
            self.meta[key] = html.unescape(content)


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(10 * 1024 * 1024)
        charset = response.headers.get_content_charset() or "utf-8"
    return data.decode(charset, errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True, help="Directory from prepare_run.py")
    parser.add_argument("--post-url", required=True, help="Instagram /p/ or /reel/ URL")
    parser.add_argument("--name", help="Optional descriptive filename stem")
    parser.add_argument("--account")
    parser.add_argument("--timestamp-label")
    parser.add_argument("--caption-summary")
    parser.add_argument("--notes")
    args = parser.parse_args()

    page_html = fetch_html(args.post_url)
    og = OpenGraphParser()
    og.feed(page_html)

    image_url = og.meta.get("og:image")
    if not image_url:
        raise SystemExit("No public og:image found on this Instagram page")

    caption_summary = args.caption_summary or og.meta.get("og:description")
    notes = args.notes or "Saved from public Open Graph preview image."

    save_media = Path(__file__).with_name("save_media.py")
    command = [
        sys.executable,
        str(save_media),
        "--run-dir",
        args.run_dir,
        "--source-url",
        image_url,
        "--kind",
        "cover",
        "--post-url",
        args.post_url,
        "--notes",
        notes,
    ]
    if args.name:
        command.extend(["--name", args.name])
    if args.account:
        command.extend(["--account", args.account])
    if args.timestamp_label:
        command.extend(["--timestamp-label", args.timestamp_label])
    if caption_summary:
        command.extend(["--caption-summary", caption_summary])

    result = subprocess.run(command, check=True, text=True, capture_output=True)
    record = json.loads(result.stdout)
    record["og_image_url"] = image_url
    print(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Save a visible Instagram image URL or browser screenshot into a run folder."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


def slugify(value: str, fallback: str = "instagram-media", limit: int = 80) -> str:
    parts = re.findall(r"[a-z0-9]+", value.casefold())
    slug = "-".join(parts)[:limit].strip("-")
    return slug or fallback


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    for index in range(2, 1000):
        candidate = path.with_name(f"{stem}-{index}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Could not find an unused filename for {path}")


def extension_from_content_type(content_type: str, url: str) -> str:
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
    if guessed:
        return ".jpg" if guessed == ".jpe" else guessed
    suffix = Path(urlparse(url).path).suffix
    return suffix if suffix else ".jpg"


def download_image(url: str, max_bytes: int) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
        if not content_type.startswith("image/"):
            raise SystemExit(f"Refusing non-image content type: {content_type or 'unknown'}")
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise SystemExit(f"Refusing image larger than {max_bytes} bytes")
    return data, content_type


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def append_jsonl(path: Path, record: dict) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True, help="Directory from prepare_run.py")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source-url", help="Direct image URL visible in the browser")
    source.add_argument("--source-file", help="Local screenshot/image file to copy")
    parser.add_argument(
        "--kind",
        choices=["image", "screenshot", "cover"],
        default="image",
        help="Type of saved visual artifact",
    )
    parser.add_argument("--name", help="Optional descriptive filename stem")
    parser.add_argument("--post-url")
    parser.add_argument("--account")
    parser.add_argument("--timestamp-label")
    parser.add_argument("--caption-summary")
    parser.add_argument("--notes")
    parser.add_argument("--max-mb", type=int, default=25)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    images_dir = run_dir / "images"
    screenshots_dir = run_dir / "screenshots"
    metadata_dir = run_dir / "metadata"
    for directory in (images_dir, screenshots_dir, metadata_dir):
        directory.mkdir(parents=True, exist_ok=True)

    label = args.name or args.account or args.timestamp_label or "instagram-media"
    stem = slugify(label)

    if args.source_url:
        data, content_type = download_image(args.source_url, args.max_mb * 1024 * 1024)
        destination = unique_path(images_dir / f"{stem}{extension_from_content_type(content_type, args.source_url)}")
        destination.write_bytes(data)
        source_value = args.source_url
    else:
        source_path = Path(args.source_file).expanduser().resolve()
        if not source_path.is_file():
            raise SystemExit(f"Source file does not exist: {source_path}")
        destination_dir = screenshots_dir if args.kind == "screenshot" else images_dir
        suffix = source_path.suffix or ".png"
        destination = unique_path(destination_dir / f"{stem}{suffix}")
        shutil.copy2(source_path, destination)
        content_type = mimetypes.guess_type(str(destination))[0] or "application/octet-stream"
        source_value = str(source_path)

    record = {
        "saved_at_utc": datetime.now(timezone.utc).isoformat(),
        "kind": args.kind,
        "file": str(destination),
        "sha256": sha256_file(destination),
        "bytes": destination.stat().st_size,
        "content_type": content_type,
        "source": source_value,
        "post_url": args.post_url,
        "account": args.account,
        "timestamp_label": args.timestamp_label,
        "caption_summary": args.caption_summary,
        "notes": args.notes,
    }
    append_jsonl(metadata_dir / "media.jsonl", record)
    if args.post_url or args.account or args.timestamp_label or args.caption_summary:
        append_jsonl(metadata_dir / "posts.jsonl", record)

    print(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

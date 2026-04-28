---
name: instagram-search
description: Search Instagram for keywords, hashtags, accounts, topics, products, brands, campaigns, locations, or trends, then browse the newest visible image posts/carousels, save full visible images into the current workspace, and summarize findings. Use when the user asks to find, research, monitor, review, collect examples from, browse latest/recent Instagram image content, or save Instagram post images for a keyword or hashtag. Skips Reels/video content by default.
---

# Instagram Search

## Overview

Find relevant Instagram image posts with a browser-led workflow, save visible full images into the current workspace, then verify recency by opening posts and reading visible timestamps. Treat Instagram search results as ranked and personalized unless timestamps prove otherwise. Skip Reels/videos by default; this skill is image-only unless the user explicitly asks for video handling.

## Quick Start

1. Define scope
- If the user gave only a keyword, proceed with that keyword and likely hashtag variants.
- Ask a short clarification only when the missing detail changes the task materially: target language, location, number of posts, or time window.
- Default sample size: 30 relevant image posts or carousels.

2. Prepare links
- Run `python3 scripts/prepare_run.py "<keyword>" --base "$PWD"` from this skill directory to create a workspace result folder.
- Use the printed `run_dir` for all saved images, screenshots, and metadata.
- Use the returned Instagram search and hashtag URLs first.
- Keep fallback web-search URLs only for cases where Instagram search is blocked, sparse, or clearly stale.

3. Browse Instagram
- Use the browser with the user's existing Instagram session.
- Chrome Developer Mode is not required. This skill does not use a Chrome extension; it only needs a normal browser session that can access Instagram, preferably already logged in.
- If Instagram asks for login, checkpoint, CAPTCHA, or identity verification, ask the user to complete it in the browser. Never ask for or handle passwords, one-time codes, recovery codes, or cookies.
- Search the raw keyword in Instagram Search, then inspect matching Tags, Accounts, and Places when relevant. Do not use Reels as saved results in the default image-only workflow.

4. Collect candidate posts
- Open candidate image/carousel `/p/` permalinks individually. Skip `/reel/`, `/reels/`, links labeled Reel/Clip, tiles with video/reel icons, and opened posts whose timestamp/permalink points to `/reel/`.
- Capture: permalink, account handle, post type, visible timestamp, caption summary, why it matches the keyword, and visible engagement if useful.
- Save the visible image or carousel slide for each selected post into the run directory before moving on. Do not save Reel covers, video frames, or video screenshots in the default workflow.
- Prefer posts with explicit visible timestamps. If a timestamp cannot be found, mark it as unknown and do not use it to prove "latest".

5. Save images
- Prefer rendered visible media over link-preview images. For non-Reel image/carousel posts, first try `node scripts/save_visible_media.js --run-dir "<run_dir>" --post-url "<post_url>" --account "<handle>" --timestamp-label "<visible timestamp>" --name "<short-name>"`; this renders the page, finds the actual `img.currentSrc` being displayed, and usually saves a larger/full composition such as 1080x1350 instead of a cropped Open Graph preview.
- Use `--all-main --limit 5` with `save_visible_media.js` when a carousel has multiple visible slides worth saving. It saves the currently rendered main media images, not the "More posts" grid.
- If Playwright is available only from the Codex bundled runtime, set `NODE_PATH` to the bundled `node_modules` path or run the script with that runtime. On macOS the script defaults to the installed Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` when Playwright's bundled browser is unavailable.
- If rendered media extraction is unavailable for a non-Reel image/carousel post, try `python3 scripts/save_post_preview.py --run-dir "<run_dir>" --post-url "<post_url>" --account "<handle>" --timestamp-label "<visible timestamp>" --name "<short-name>"`; this saves the page's public Open Graph preview image, which is reliable but may be cropped.
- If the browser accessibility tree or normal page inspection exposes a direct image URL for content that is already visible to the user, save it with `python3 scripts/save_media.py --run-dir "<run_dir>" --source-url "<image_url>" --post-url "<post_url>" --account "<handle>" --timestamp-label "<visible timestamp>"`.
- If direct image saving is unavailable, capture only the media pane or selected media element, not the full post page. Copy the local screenshot into the archive with `python3 scripts/save_media.py --run-dir "<run_dir>" --source-file "<local_file>" --kind screenshot --post-url "<post_url>" --account "<handle>" --timestamp-label "<visible timestamp>"`.
- For carousels, `save_visible_media.js` usually saves the first rendered slide; use `--all-main` or navigate to the relevant slide and rerun if the image is on a later slide. Use Open Graph preview only as a fallback.
- For Reels/videos, skip the result and note it as skipped when relevant. Do not download videos, save Reel covers, or capture Reel frames unless the user explicitly changes the scope.
- Use descriptive filenames when helpful, but let the script sanitize and de-duplicate names.

6. Rank by recency
- Convert relative timestamps using the current date/time and the user's timezone when available.
- Sort verified posts newest first.
- State clearly when Instagram's UI appears to be showing ranked, recommended, "top", or "recent top" results instead of a complete chronological feed.

## Search Strategy

- Try the exact keyword first.
- For phrases, try compact hashtag forms and important tokens: `coffee shop nyc` -> `#coffeeshopnyc`, `#coffeeshop`, `#nyc`.
- For brands, products, people, and venues, inspect Accounts as well as posts.
- For events and places, inspect Places/location results if Instagram exposes them.
- For trend browsing, Reels may indicate that a topic is active, but skip them as saved results unless the user explicitly asks for video/Reel handling.
- Use fallback web search only as a supplement, and label it as non-native Instagram discovery.

## Output

Begin with a short scope note:

```text
结果基于我在 <date/time/timezone> 能看到的 Instagram 页面。Instagram 搜索结果可能受登录状态、地区、个性化推荐和平台排序影响；我只把能读到时间戳的帖子当作“最新”证据。图片/截图已保存到 <run_dir>。
```

Then provide a concise table:

| Time | Account | Type | Link | Saved image | Why relevant | Notes |
|---|---|---|---|---|---|---|

After the table, add a brief synthesis:
- freshest themes or repeated patterns
- notable accounts
- saved workspace folder
- gaps or limits, such as skipped Reels, login walls, sparse hashtag results, or unknown timestamps

## Guardrails

- Use only public content or content visible through the user's authorized session.
- Do not attempt to bypass private accounts, access controls, rate limits, bot checks, login challenges, or content restrictions.
- Do not use "private Instagram viewer" sites or unofficial credential/cookie capture flows.
- Do not like, comment, follow, message, save, report, or otherwise interact with content unless the user explicitly asks.
- Keep browsing volume modest. For broad monitoring or high-volume collection, recommend an official API or approved social listening tool instead.
- Avoid claiming comprehensive coverage; Instagram search is not a complete public archive.
- Save only media that was visible through the user's authorized session. Do not use cookies, tokens, private APIs, or anti-bot bypasses to fetch higher-resolution originals.
- Treat saved images as research/reference artifacts with source attribution; do not repost or republish them unless the user has rights to do so.

## Optional API Path

Read `references/graph-api.md` only when the user specifically wants API automation or has Meta/Instagram API credentials available. The default workflow is browser-based because arbitrary Instagram keyword search is not generally exposed as a simple public API.

## Resources

- `scripts/build_urls.py`: Generate native Instagram and fallback search URLs for a keyword.
- `scripts/prepare_run.py`: Create a workspace result folder and session metadata for a keyword search.
- `scripts/save_visible_media.js`: Render a non-Reel Instagram `/p/` image/carousel page and save the largest relevant visible media image from `img.currentSrc`. Preferred when the user needs the full image rather than a cropped preview.
- `scripts/save_post_preview.py`: Save the public Open Graph preview image from an Instagram `/p/` page when available. Use as fallback for non-Reel image/carousel posts because previews can be cropped.
- `scripts/save_media.py`: Save a visible image URL or local browser screenshot into the result folder and append media metadata.
- `references/graph-api.md`: Notes for the official API route when credentials and permissions exist.

# Instagram Search Skill

`instagram-search` is an agent skill for researching Instagram image posts from a normal browser session. It helps an AI agent search Instagram keywords, hashtags, accounts, places, or trends; inspect visible image/carousel posts; save visible media into the workspace; and summarize findings with source links and timestamps.

This skill is designed for lightweight research and reference collection. It skips Reels/videos by default and avoids private APIs, cookie capture, credential handling, or anti-bot bypasses.

## What It Does

- Searches Instagram for keywords, hashtags, accounts, places, brands, campaigns, products, or trends.
- Uses the user's existing authorized browser session when Instagram requires login.
- Opens candidate image/carousel posts and records visible timestamps, account handles, captions, links, and relevance notes.
- Saves visible images or carousel slides into a local result folder with metadata.
- Produces a concise summary table sorted by verified recency when timestamps are available.

## Requirements

- A browser session that can access Instagram, preferably already logged in.
- Chrome Developer Mode is not required. This is not a Chrome extension.
- Node.js for the image-saving helper script.
- Playwright when available; on macOS, the helper can fall back to the installed Google Chrome executable.
- Python 3 for the bundled metadata and media-saving scripts.

If Instagram asks for login, checkpoint, CAPTCHA, or identity verification, the user must complete that directly in the browser. The agent should not ask for or handle passwords, one-time codes, recovery codes, cookies, or tokens.

## Install

Install with the `skills` CLI:

```bash
npx skills add gaojiaze2025/instagram-search --skill instagram-search
```

Install globally for Codex:

```bash
npx skills add gaojiaze2025/instagram-search --skill instagram-search -g -a codex -y
```

Install globally for Claude Code:

```bash
npx skills add gaojiaze2025/instagram-search --skill instagram-search -g -a claude-code -y
```

You can also view it on skills.sh:

```text
https://skills.sh/gaojiaze2025/instagram-search
```

## Example Requests

```text
Search Instagram for recent image posts about "Jennifer Aniston outfit" and save the visible images.
```

```text
Find recent Instagram carousel posts for #coffeeshopnyc and summarize the freshest themes.
```

```text
Collect visible Instagram image examples for a new skincare campaign and include account links.
```

## Safety Notes

- Use only public content or content visible through the user's authorized session.
- Do not bypass private accounts, access controls, rate limits, login challenges, or content restrictions.
- Do not use private Instagram viewer sites or unofficial credential/cookie capture flows.
- Do not like, comment, follow, message, save, report, or otherwise interact with posts unless the user explicitly asks.
- Treat saved images as research/reference artifacts with attribution; do not repost or republish them unless you have rights to do so.

## Repository Layout

```text
SKILL.md                 Skill instructions and trigger metadata
scripts/                 Helper scripts for run setup and media capture
references/graph-api.md  Optional notes for official API-based workflows
```

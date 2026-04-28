#!/usr/bin/env node
/*
 * Save the largest visible Instagram image from a rendered image/carousel page.
 *
 * This complements save_post_preview.py: Open Graph images are reliable but can be
 * cropped previews. Rendering the page lets us read the actual img.currentSrc URLs
 * Instagram uses for the visible media pane.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const args = {
    waitMs: 6000,
    limit: 1,
    allMain: false,
    dryRun: false,
    viewportWidth: 1400,
    viewportHeight: 1000,
    videoScreenshot: false,
    allowReels: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (["allMain", "dryRun"].includes(key)) {
      args[key] = true;
      continue;
    }
    if (key === "allowReels") {
      args.allowReels = true;
      continue;
    }
    if (key === "videoScreenshot") {
      args.videoScreenshot = true;
      continue;
    }
    if (key === "noVideoScreenshot") {
      args.videoScreenshot = false;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    i += 1;
    if (["waitMs", "limit", "viewportWidth", "viewportHeight"].includes(key)) {
      args[key] = Number(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

function usage() {
  return `Usage:
  save_visible_media.js --run-dir <dir> --post-url <instagram-url> [--name <stem>]
                        [--account <handle>] [--timestamp-label <label>]
                        [--caption-summary <text>] [--all-main] [--limit <n>]
                        [--dry-run] [--allow-reels] [--video-screenshot]
                        [--browser-executable <path>]

Saves rendered page media from img.currentSrc. Use --all-main to save multiple
currently rendered main images, such as adjacent carousel slides. By default,
refuses /reel/ URLs and does not save video posters or frames.`;
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (firstError) {
    const candidates = [
      process.env.NODE_PATH,
      process.env.NODE_REPL_NODE_MODULE_DIRS,
      "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    ]
      .filter(Boolean)
      .flatMap((entry) => entry.split(path.delimiter))
      .filter(Boolean);

    for (const directory of candidates) {
      try {
        return require(path.join(directory, "playwright"));
      } catch {
        // Keep trying known module roots.
      }
    }

    throw new Error(
      `Could not load Playwright. Set NODE_PATH to a node_modules directory containing playwright. Original error: ${firstError.message}`,
    );
  }
}

function defaultBrowserExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function imageCandidatesScript() {
  return (allowReels) => {
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;

    function rectFor(element) {
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visibleArea: visibleWidth * visibleHeight,
      };
    }

    function scoreCandidate(candidate) {
      let score = candidate.naturalWidth * candidate.naturalHeight;
      score += candidate.rect.visibleArea * 12;
      if (candidate.rect.y >= -50 && candidate.rect.y <= viewportHeight * 1.15) score += 1_500_000;
      if (candidate.clientWidth >= 250 && candidate.clientHeight >= 250) score += 800_000;
      if (/profile picture/i.test(candidate.alt || "")) score -= 5_000_000;
      if (/static\.cdninstagram\.com/.test(candidate.src)) score -= 5_000_000;
      if (candidate.rect.y > viewportHeight * 1.4) score -= 2_000_000;
      return score;
    }

    const images = Array.from(document.images)
      .map((img, index) => {
        const src = img.currentSrc || img.src || "";
        const rect = rectFor(img);
        const alt = img.alt || "";
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;
        const isProfile = /profile picture/i.test(alt) || /t51\.2885-19|s150x150/.test(src);
        const isInstagramMedia = /cdninstagram\.com/.test(src) && !/static\.cdninstagram\.com/.test(src);
        return {
          index,
          sourceType: "img.currentSrc",
          src,
          alt,
          naturalWidth,
          naturalHeight,
          clientWidth: img.clientWidth || 0,
          clientHeight: img.clientHeight || 0,
          rect,
          isProfile,
          isInstagramMedia,
        };
      })
      .filter((candidate) => {
        if (!candidate.src || !candidate.isInstagramMedia || candidate.isProfile) return false;
        if (candidate.naturalWidth < 300 || candidate.naturalHeight < 300) return false;
        if (candidate.clientWidth < 80 || candidate.clientHeight < 80) return false;
        return true;
      });

    const posters = allowReels
      ? Array.from(document.querySelectorAll("video"))
      .map((video, index) => {
        const src = video.poster || "";
        const rect = rectFor(video);
        return {
          index,
          sourceType: "video.poster",
          src,
          alt: video.getAttribute("aria-label") || "Instagram video poster",
          naturalWidth: video.videoWidth || Math.round(rect.width),
          naturalHeight: video.videoHeight || Math.round(rect.height),
          clientWidth: Math.round(rect.width),
          clientHeight: Math.round(rect.height),
          rect,
          isProfile: false,
          isInstagramMedia: /cdninstagram\.com/.test(src),
        };
      })
          .filter((candidate) => candidate.src && candidate.isInstagramMedia)
      : [];

    return images
      .concat(posters)
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
      .sort((left, right) => right.score - left.score);
  };
}

function mainMediaOnly(candidates) {
  const seen = new Set();
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.src)) return false;
      seen.add(candidate.src);
      if (candidate.rect.y < -100) return false;
      if (candidate.rect.y > 700) return false;
      if (candidate.rect.visibleArea <= 0) return false;
      if (candidate.clientWidth < 200 || candidate.clientHeight < 200) return false;
      return true;
    })
    .sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x);
}

async function screenshotMainVideo(page, args) {
  const hasLoginOverlay = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return /Never miss a post|Log In\s+Sign Up|Sign up for Instagram/i.test(text);
  });
  if (hasLoginOverlay) {
    throw new Error(
      "Refusing video screenshot because Instagram rendered a login/sign-up overlay. Use save_post_preview.py or a logged-in browser media-pane screenshot instead.",
    );
  }

  const handles = await page.$$("video");
  const videos = [];
  for (const handle of handles) {
    const info = await handle.evaluate((video) => {
      const rect = video.getBoundingClientRect();
      const viewportWidth = window.innerWidth || 0;
      const viewportHeight = window.innerHeight || 0;
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const styles = window.getComputedStyle(video);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visibleArea: visibleWidth * visibleHeight,
        videoWidth: video.videoWidth || 0,
        videoHeight: video.videoHeight || 0,
        display: styles.display,
        visibility: styles.visibility,
        opacity: Number(styles.opacity || 1),
      };
    });
    if (info.display === "none" || info.visibility === "hidden" || info.opacity === 0) continue;
    if (info.y < -100 || info.y > args.viewportHeight * 0.75) continue;
    if (info.visibleArea <= 0 || info.width < 120 || info.height < 120) continue;
    videos.push({ handle, info, score: info.visibleArea + info.videoWidth * info.videoHeight });
  }

  videos.sort((left, right) => right.score - left.score);
  const selected = videos[0];
  if (!selected) return null;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-visible-video-"));
  const screenshotPath = path.join(tempDir, "frame.png");
  await selected.handle.screenshot({ path: screenshotPath });
  return { screenshotPath, info: selected.info };
}

function runSaveMedia(command) {
  const python = process.env.PYTHON || "python3";
  const result = spawnSync(python, command, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "save_media.py failed");
  }
  return JSON.parse(result.stdout);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runDir || !args.postUrl) {
    throw new Error(`${usage()}\n\n--run-dir and --post-url are required.`);
  }
  if (!args.allowReels && /\/reels?\//.test(new URL(args.postUrl).pathname)) {
    throw new Error("Skipping Reel URL in image-only mode. Use an image/carousel /p/ URL.");
  }

  const { chromium } = requirePlaywright();
  const launchOptions = { headless: true };
  const executablePath = args.browserExecutable || defaultBrowserExecutable();
  if (executablePath) launchOptions.executablePath = executablePath;

  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({
      viewport: { width: args.viewportWidth, height: args.viewportHeight },
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    await page.goto(args.postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(args.waitMs);

    const pageHasMainVideo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("video")).some((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width >= 120 && rect.height >= 120 && rect.y > -100 && rect.y < 750;
      });
    });
    if (pageHasMainVideo && !args.allowReels) {
      throw new Error("Skipping video/Reel page in image-only mode. No image was saved.");
    }

    const candidates = await page.evaluate(imageCandidatesScript(), args.allowReels);
    const mainCandidates = mainMediaOnly(candidates);
    const selected = args.allMain
      ? mainCandidates.slice(0, args.limit || 5)
      : mainCandidates.slice(0, Math.max(1, args.limit || 1));

    if (!selected.length && !args.videoScreenshot) {
      throw new Error("No visible main Instagram image found on the rendered page.");
    }

    if (args.dryRun) {
      const videoPreview = args.videoScreenshot
        ? await page.$$eval("video", (videos) =>
            videos.map((video, index) => {
              const rect = video.getBoundingClientRect();
              return {
                index,
                currentSrc: video.currentSrc || video.src || "",
                poster: video.poster || "",
                videoWidth: video.videoWidth || 0,
                videoHeight: video.videoHeight || 0,
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              };
            }),
          )
        : [];
      console.log(
        JSON.stringify({ post_url: page.url(), selected, main_candidates: mainCandidates, video_preview: videoPreview }, null, 2),
      );
      return;
    }

    const saveMedia = path.join(__dirname, "save_media.py");
    const records = [];
    selected.forEach((candidate, index) => {
      const name =
        args.name && selected.length > 1
          ? `${args.name}-${String(index + 1).padStart(2, "0")}`
          : args.name;
      const command = [
        saveMedia,
        "--run-dir",
        args.runDir,
        "--source-url",
        candidate.src,
        "--kind",
        "image",
        "--post-url",
        args.postUrl,
        "--notes",
        args.notes ||
          `Saved from rendered Instagram page ${candidate.sourceType}; preferred over Open Graph previews because it preserves the visible full media when available.`,
      ];
      if (name) command.push("--name", name);
      if (args.account) command.push("--account", args.account);
      if (args.timestampLabel) command.push("--timestamp-label", args.timestampLabel);
      if (args.captionSummary) command.push("--caption-summary", args.captionSummary);

      const record = runSaveMedia(command);
      record.visible_media = {
        source_type: candidate.sourceType,
        natural_width: candidate.naturalWidth,
        natural_height: candidate.naturalHeight,
        client_width: candidate.clientWidth,
        client_height: candidate.clientHeight,
        score: candidate.score,
      };
      records.push(record);
    });

    if (!records.length && args.videoScreenshot) {
      const video = await screenshotMainVideo(page, args);
      if (!video) {
        throw new Error("No visible main Instagram image or video element found on the rendered page.");
      }
      const command = [
        saveMedia,
        "--run-dir",
        args.runDir,
        "--source-file",
        video.screenshotPath,
        "--kind",
        "screenshot",
        "--post-url",
        args.postUrl,
        "--notes",
        args.notes ||
          "Saved as a screenshot of the rendered Instagram video element because this Reel did not expose a full image URL.",
      ];
      if (args.name) command.push("--name", args.name);
      if (args.account) command.push("--account", args.account);
      if (args.timestampLabel) command.push("--timestamp-label", args.timestampLabel);
      if (args.captionSummary) command.push("--caption-summary", args.captionSummary);

      const record = runSaveMedia(command);
      record.visible_media = {
        source_type: "video.elementScreenshot",
        natural_width: video.info.videoWidth,
        natural_height: video.info.videoHeight,
        client_width: Math.round(video.info.width),
        client_height: Math.round(video.info.height),
        score: video.info.visibleArea + video.info.videoWidth * video.info.videoHeight,
      };
      records.push(record);
    }

    console.log(JSON.stringify(records.length === 1 ? records[0] : records, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

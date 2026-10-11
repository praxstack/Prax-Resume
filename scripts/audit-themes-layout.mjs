#!/usr/bin/env node
/**
 * audit-themes-layout.mjs — A4 clip gate for the 15 resumes-v2 themes.
 * Every .resume-page has overflow:hidden, so content past the page box is
 * silently cut off in the PDF. At an A4-wide viewport under print media, fail
 * when:
 *   - bottom: any in-flow element's bottom edge lies below its page box, or
 *   - left/right: any visible text run extends past the page's left or right
 *     edge. This is measured per text node (Range rects), including text inside
 *     absolutely positioned blocks, so a nowrap strip that runs off the side is
 *     caught even when its container box looks fine.
 *
 * Fails (exit 1) on any such clip, if a theme does not have exactly 2 pages, or
 * if the theme count is not 15 (so the gate cannot pass vacuously).
 * Not covered: clipping inside nested overflow:hidden containers, and
 * staleness of the committed PDFs relative to their HTML.
 *
 * Reports name the clipped element by tag/class only, never its text, so
 * contact details are not echoed into logs.
 *
 *   node scripts/audit-themes-layout.mjs [theme.html ...]   (default: all 15)
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "resumes-v2");
const EXPECTED_THEMES = 15;
const EXPECTED_PAGES = 2;
const TOLERANCE_MM = 0.3;

export function measureClip(page) {
  return page.evaluate(() => {
    const mm = (px) => (px * 25.4) / 96;
    const describe = (el) =>
      el.tagName.toLowerCase() +
      (typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).join(".")
        : "");
    return [...document.querySelectorAll(".resume-page")].map((sheet, i) => {
      const pr = sheet.getBoundingClientRect();
      let worst = 0;
      let where = "";
      for (const el of sheet.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (Math.abs(r.height - pr.height) < 4) continue;
        const over = mm(r.bottom - pr.bottom);
        if (over > worst) {
          worst = over;
          where = describe(el);
        }
      }

      let worstX = 0;
      let side = "";
      let whereX = "";
      const range = document.createRange();
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const host = node.parentElement;
        if (!host || getComputedStyle(host).visibility !== "visible") continue;
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        for (const [s, over] of [
          ["right", mm(r.right - pr.right)],
          ["left", mm(pr.left - r.left)],
        ]) {
          if (over > worstX) {
            worstX = over;
            side = s;
            whereX = describe(host);
          }
        }
      }

      return {
        page: i + 1,
        overflowMm: +worst.toFixed(1),
        where,
        overflowXMm: +worstX.toFixed(1),
        side,
        whereX,
      };
    });
  });
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => resolve(root, f))
  : readdirSync(srcDir)
      .filter((f) => /^Resume \d\d .*\.html$/.test(f))
      .sort()
      .map((f) => resolve(srcDir, f));

const fails = [];
if (!args.length && files.length !== EXPECTED_THEMES) {
  fails.push(`expected ${EXPECTED_THEMES} theme files, found ${files.length}`);
}

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error(`browser launch failed: ${e.message.split("\n")[0]}\nRun: npx playwright install chromium`);
  process.exit(1);
}
for (const file of files) {
  const f = basename(file);
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  const pages = await measureClip(page);
  await page.close();
  if (pages.length !== EXPECTED_PAGES) {
    fails.push(`${f}: ${pages.length} pages (expected ${EXPECTED_PAGES})`);
  }
  let clipped = 0;
  for (const p of pages) {
    if (p.overflowMm > TOLERANCE_MM) {
      clipped++;
      fails.push(`${f} p${p.page}: clipped at bottom +${p.overflowMm}mm (${p.where})`);
    }
    if (p.overflowXMm > TOLERANCE_MM) {
      clipped++;
      fails.push(`${f} p${p.page}: text clipped at ${p.side} edge +${p.overflowXMm}mm (${p.whereX})`);
    }
  }
  console.log(`${clipped ? "FAIL" : "ok  "}  ${f}  pages=${pages.length}`);
}
await browser.close();

if (fails.length) {
  console.log("\n" + fails.join("\n"));
  process.exit(1);
}
console.log(`\n${files.length}/${args.length ? files.length : EXPECTED_THEMES} themes: no clipped content at A4`);

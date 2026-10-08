#!/usr/bin/env node
/**
 * audit-themes-layout.mjs — A4 clip gate for the 15 resumes-v2 themes.
 * Every .resume-page has overflow:hidden, so content past the page bottom is
 * silently cut off in the PDF. At an A4-wide viewport under print media, fail
 * when any in-flow element's bottom edge lies below its page box.
 *
 * Fails (exit 1) on any clip, if a theme does not have exactly 2 pages, or if
 * the theme count is not 15 (so the gate cannot pass vacuously).
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "resumes-v2");
const EXPECTED_THEMES = 15;
const EXPECTED_PAGES = 2;
const TOLERANCE_MM = 0.3;

export function measureClip(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".resume-page")].map((sheet, i) => {
      const pr = sheet.getBoundingClientRect();
      let worst = 0;
      let text = "";
      for (const el of sheet.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (Math.abs(r.height - pr.height) < 4) continue;
        const over = ((r.bottom - pr.bottom) * 25.4) / 96;
        if (over > worst) {
          worst = over;
          text = (el.innerText || "").slice(0, 50).replace(/\s+/g, " ");
        }
      }
      return { page: i + 1, overflowMm: +worst.toFixed(1), text };
    })
  );
}

const files = readdirSync(srcDir)
  .filter((f) => /^Resume \d\d .*\.html$/.test(f))
  .sort();

const fails = [];
if (files.length !== EXPECTED_THEMES) {
  fails.push(`expected ${EXPECTED_THEMES} theme files, found ${files.length}`);
}

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error(`browser launch failed: ${e.message.split("\n")[0]}\nRun: npx playwright install chromium`);
  process.exit(1);
}
for (const f of files) {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(resolve(srcDir, f)).href, { waitUntil: "networkidle" });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  const pages = await measureClip(page);
  await page.close();
  if (pages.length !== EXPECTED_PAGES) {
    fails.push(`${f}: ${pages.length} pages (expected ${EXPECTED_PAGES})`);
  }
  const clipped = pages.filter((p) => p.overflowMm > TOLERANCE_MM);
  for (const p of clipped) fails.push(`${f} p${p.page}: clipped +${p.overflowMm}mm "${p.text}"`);
  console.log(`${clipped.length ? "FAIL" : "ok  "}  ${f}  pages=${pages.length}`);
}
await browser.close();

if (fails.length) {
  console.log("\n" + fails.join("\n"));
  process.exit(1);
}
console.log(`\n${files.length}/${EXPECTED_THEMES} themes: no clipped content at A4`);

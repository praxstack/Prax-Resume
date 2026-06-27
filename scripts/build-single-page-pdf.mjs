#!/usr/bin/env node
/**
 * Build a SINGLE continuous-page PDF from an HTML resume via headless Chromium.
 *
 * Emits ONE page exactly as tall as the content — no A4, no pagination, no
 * dropped sections.
 *
 *   node scripts/build-single-page-pdf.mjs <input.html> [output.pdf]
 *
 * CORRECTNESS NOTES (bugs proven + fixed empirically, 2026-06-27):
 *
 *  1. page.pdf() ALWAYS renders in `print` media regardless of emulateMedia().
 *     => measure content height in `print` media, not `screen`.
 *
 *  2. Passing an explicit width/height to page.pdf() makes Chromium treat the
 *     height as a CLIP and paginate the overflow → multi-page, and any
 *     `pageRanges:"1"` then AMPUTATES the lower sections (Projects/Education/
 *     Awards silently vanish). VERIFIED: width/height path => pages=2.
 *
 *  3. CORRECT approach (verified pages=1, all sections present): inject a CSS
 *     `@page { size: 210mm <measuredHeight>mm; margin: 0 }` rule and pass
 *     `preferCSSPageSize: true` to page.pdf() with NO width/height/pageRanges.
 *     Chromium then makes the sheet genuinely that tall — one continuous page.
 *
 * Width is fixed to A4 width (210mm) so typography/line-length matches the design;
 * only the height grows to fit everything on one page.
 */

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, basename, extname } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [, , inputArg, outputArg] = process.argv;
const htmlPath = resolve(root, inputArg ?? "index.html");
const outPath = resolve(
  root,
  outputArg ?? `${basename(htmlPath, extname(htmlPath))} — single page.pdf`
);

if (!existsSync(htmlPath)) {
  console.error(`\u2717 HTML not found at ${htmlPath}`);
  process.exit(1);
}

const MM_PER_PX = 25.4 / 96;
const PAGE_WIDTH_MM = 210; // A4 width keeps typography identical to the design

function pdfPageCount(buf) {
  const m = buf.match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/) || buf.match(/\/Count\s+(\d+)/);
  if (m) return parseInt(m[1], 10);
  const objs = buf.match(/\/Type\s*\/Page(?![s])/g);
  return objs ? objs.length : 0;
}

const started = Date.now();
const browser = await chromium.launch();
const page = await browser.newPage();

await page.emulateMedia({ media: "print" }); // matches what page.pdf() renders with
await page.setViewportSize({ width: Math.round(PAGE_WIDTH_MM / MM_PER_PX), height: 1200 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

// Neutralize screen-card chrome (shadow, the .page max-width) but RESTORE the
// design's comfortable inner padding. The resume's own @media print rule zeroes
// .page padding (it assumed @page margin would supply the gutter); since we emit
// a custom borderless sheet with PDF margin:0, we must put the 16mm/18mm padding
// back on .page so text doesn't run edge-to-edge. This reproduces the screen
// design's exact margin ratio (210mm sheet, 18mm side / 16mm top-bottom padding).
const PAD_V_MM = 16; // top/bottom inner padding (matches screen .page)
const PAD_H_MM = 18; // left/right inner padding (matches screen .page)
await page.addStyleTag({
  content: `
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .page {
        margin: 0 !important; box-shadow: none !important; border-radius: 0 !important;
        width: ${PAGE_WIDTH_MM}mm !important; max-width: ${PAGE_WIDTH_MM}mm !important;
        padding: ${PAD_V_MM}mm ${PAD_H_MM}mm !important;
        box-sizing: border-box !important;
      }
    }
  `,
});
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const dims = await page.evaluate(() => {
  const el = document.querySelector(".page") || document.body;
  const r = el.getBoundingClientRect();
  return { width: Math.ceil(r.width), height: Math.ceil(Math.max(el.scrollHeight, r.height)) };
});

const widthMm = +(dims.width * MM_PER_PX).toFixed(2);
const heightMm = +((dims.height * MM_PER_PX) + 4).toFixed(2); // +4mm slack so nothing clips

// Inject the exact one-page sheet size and let preferCSSPageSize honor it.
await page.addStyleTag({
  content: `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0 !important; }`,
});
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

await page.pdf({
  path: outPath,
  printBackground: true,
  preferCSSPageSize: true, // honor the @page size above — the single size authority
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await browser.close();

const pages = pdfPageCount(readFileSync(outPath, "latin1"));
const ms = Date.now() - started;
if (pages !== 1) {
  console.error(`\u2717 expected 1 page, got ${pages}. Sheet ${widthMm}\u00d7${heightMm}mm — investigate.`);
  process.exit(1);
}
console.log(
  `\u2713 wrote ${outPath}\n  ONE page \u00b7 ${widthMm}mm \u00d7 ${heightMm}mm ` +
  `(print-laid content ${dims.width}\u00d7${dims.height}px) \u00b7 ${ms} ms`
);

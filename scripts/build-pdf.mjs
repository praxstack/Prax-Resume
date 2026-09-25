#!/usr/bin/env node
/**
 * Build a PDF from an HTML resume via headless Chromium.
 *
 *   node scripts/build-pdf.mjs                                # default: index.html → resume.pdf
 *   node scripts/build-pdf.mjs <input.html> [output.pdf]      # custom input / output
 *   npm run pdf                                               # shortcut for default
 */

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, basename, extname } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [, , inputArg, outputArg] = process.argv;

const htmlPath = resolve(root, inputArg ?? "index.html");
const outPath = resolve(
  root,
  outputArg ?? `${basename(htmlPath, extname(htmlPath))}.pdf`
);

if (!existsSync(htmlPath)) {
  console.error(`✗ HTML not found at ${htmlPath}`);
  process.exit(1);
}

const MM_PER_PX = 25.4 / 96;
const A4_WIDTH_PX = Math.round(210 / MM_PER_PX);
const A4_HEIGHT_PX = Math.round(297 / MM_PER_PX);

const started = Date.now();
const browser = await chromium.launch();
const page = await browser.newPage();

// Match A4 viewport before layout so mm-based sheets render 1:1 in PDF.
await page.setViewportSize({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });
await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() =>
  document.fonts ? document.fonts.ready : Promise.resolve()
);

// Preserve backgrounds, borders, and fills exactly as authored.
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media print {
      .deck { gap: 0 !important; padding: 0 !important; background: #fff !important; }
      .resume-page { box-shadow: none !important; }
    }
  `,
});

await page.pdf({
  path: outPath,
  printBackground: true,
  preferCSSPageSize: true,
  scale: 1,
});

await browser.close();

const ms = Date.now() - started;
console.log(`✓ wrote ${outPath}  (${ms} ms)`);

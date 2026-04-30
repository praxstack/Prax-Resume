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

const started = Date.now();
const browser = await chromium.launch();
const page = await browser.newPage();

await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluate(() =>
  document.fonts ? document.fonts.ready : Promise.resolve()
);

await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();

const ms = Date.now() - started;
console.log(`✓ wrote ${outPath}  (${ms} ms)`);

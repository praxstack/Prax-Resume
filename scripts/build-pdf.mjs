#!/usr/bin/env node
/**
 * Build resume.pdf from index.html via headless Chromium.
 *   npm run pdf
 */

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const htmlPath = resolve(root, "index.html");
const outPath = resolve(root, "resume.pdf");

if (!existsSync(htmlPath)) {
  console.error(`✗ index.html not found at ${htmlPath}`);
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

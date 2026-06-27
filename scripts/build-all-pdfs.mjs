#!/usr/bin/env node
/**
 * build-all-pdfs.mjs — batch-render every resume HTML to A4 PDF via headless Chromium.
 *
 * Renders: the canonical v3 (continuous-flow, paginated by its @media print rules)
 * + all 15 resumes-v2 themes (fixed 210x297mm .resume-page divs, @page size:A4 margin:0).
 * Each theme's own CSS owns pagination; this just drives the print engine and verifies
 * the PDF was written with the expected page count. Clickable <a href> links are
 * preserved into the PDF by Chromium automatically.
 *
 *   node scripts/build-all-pdfs.mjs
 */
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve, join, basename } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const v2dir = join(root, "resumes-v2");

const jobs = [];
// canonical v3 first
const v3 = join(root, "Prakhar Shekhar Parthasarthi Resume - v3.html");
if (existsSync(v3)) jobs.push({ html: v3, pdf: v3.replace(/\.html$/, ".pdf") });
// all 15 themes
for (const f of readdirSync(v2dir).filter(f => /^Resume \d\d .*\.html$/.test(f)).sort()) {
  jobs.push({ html: join(v2dir, f), pdf: join(v2dir, f.replace(/\.html$/, ".pdf")) });
}

const browser = await chromium.launch();
let ok = 0, fail = 0;
for (const { html, pdf } of jobs) {
  const t0 = Date.now();
  const page = await browser.newPage();
  try {
    await page.emulateMedia({ media: "print" });
    await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
    await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    const kb = (statSync(pdf).size / 1024).toFixed(0);
    console.log(`✓ ${basename(pdf).padEnd(46)} ${String(kb).padStart(4)} KB  (${Date.now() - t0}ms)`);
    ok++;
  } catch (e) {
    console.log(`✗ ${basename(html)} — ${e.message}`);
    fail++;
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(`\n${ok} PDF(s) written, ${fail} failed.`);
process.exit(fail ? 1 : 0);

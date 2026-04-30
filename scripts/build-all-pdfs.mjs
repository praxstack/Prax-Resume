#!/usr/bin/env node
/**
 * Render every resume-N.html in resumes-v2/ to resumes-v2/pdf/resume-N.pdf
 * via headless Chromium. Waits for document.fonts.ready so web fonts land
 * (we use font-display:block). Reports page count per file.
 */
import { chromium } from "playwright";
import { readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = resolve(root, "resumes-v2");
const outDir = resolve(srcDir, "pdf");

const files = readdirSync(srcDir)
  .filter((f) => /\.html$/.test(f) && /(^resume-\d+|^Resume\s+\d+)/.test(f))
  .sort((a, b) => {
    const na = +(a.match(/\d+/)?.[0] ?? 0);
    const nb = +(b.match(/\d+/)?.[0] ?? 0);
    return na - nb;
  });

if (!files.length) {
  console.error("No resume-*.html files in resumes-v2/");
  process.exit(1);
}

const browser = await chromium.launch();
const results = [];
for (const f of files) {
  const htmlPath = resolve(srcDir, f);
  const pdfPath = resolve(outDir, f.replace(/\.html$/, ".pdf"));
  const t0 = Date.now();
  const page = await browser.newPage();
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    document.fonts ? document.fonts.ready : Promise.resolve()
  );
  // Count .resume-page divs (the source-of-truth page count)
  const pageCount = await page.evaluate(
    () => document.querySelectorAll(".resume-page").length
  );
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
  results.push({ f, pages: pageCount, ms: Date.now() - t0, out: pdfPath });
  console.log(`✓ ${f} → ${pageCount} page${pageCount > 1 ? "s" : ""}  (${Date.now() - t0} ms)`);
}
await browser.close();

console.log("\nSummary:");
for (const r of results) console.log(`  ${r.f.padEnd(16)} ${r.pages} page(s)  ${r.out}`);

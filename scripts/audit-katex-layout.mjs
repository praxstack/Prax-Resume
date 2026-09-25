#!/usr/bin/env node
/**
 * Print-layout audit for KaTeX HTML resumes (clip + minimum bottom gap).
 *
 *   node scripts/audit-katex-layout.mjs [file.html ...]
 */
import { readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { assertLayoutOk, auditHtmlLayout } from "./katex-layout.mjs";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const files = (args.length
  ? args.map((f) => resolve(root, f))
  : readdirSync(root)
      .filter((f) => /^Prakhar — (KaTeX Pro|FTE 2|SDE 2|FDE|SDE AI|MTS)/.test(f) && f.endsWith(".html"))
      .sort()
      .map((f) => resolve(root, f)));

const browser = await chromium.launch();
let fail = 0;
for (const file of files) {
  const report = await auditHtmlLayout(browser, pathToFileURL(file).href);
  const issues = assertLayoutOk(report, basename(file));
  if (issues.length) {
    fail++;
    console.log(`FAIL  ${basename(file)}`);
    for (const i of issues) console.log(`  ${i}`);
  } else {
    const gaps = report.pages.map((p) => `p${p.page}:${p.gapMm}mm`).join(", ");
    console.log(`ok    ${basename(file)}  pages=${report.pageCount}  ${gaps}`);
  }
}
await browser.close();
process.exit(fail ? 1 : 0);

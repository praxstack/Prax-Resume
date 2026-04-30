#!/usr/bin/env node
/**
 * For each resume-N.html, open at A4 width, walk every .resume-page,
 * and report any descendant element whose bottom exceeds the page's
 * bottom edge (minus 2mm safety). Flags content silently clipped by
 * overflow:hidden.
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = resolve(root, "resumes-v2");
const files = readdirSync(srcDir)
  .filter((f) => /\.html$/.test(f) && /(^resume-\d+|^Resume\s+\d+)/.test(f))
  .sort((a, b) => +(a.match(/\d+/)?.[0] ?? 0) - +(b.match(/\d+/)?.[0] ?? 0));

const browser = await chromium.launch();
let anyFail = false;
for (const f of files) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } });
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(resolve(srcDir, f)).href, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    document.fonts ? document.fonts.ready : Promise.resolve()
  );
  const report = await page.evaluate(() => {
    const SAFETY_MM = 2; // 2mm buffer
    const mmToPx = (mm) => mm * (96 / 25.4);
    const pages = [...document.querySelectorAll(".resume-page")];
    const issues = [];
    pages.forEach((p, i) => {
      const pr = p.getBoundingClientRect();
      const bottom = pr.bottom - mmToPx(SAFETY_MM);
      const descendants = p.querySelectorAll("*");
      for (const el of descendants) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute") continue; // absolute elements are designed to be anchored
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.width === 0) continue;
        // Ignore page-sized wrappers (within 1mm of page box)
        const pageH = pr.bottom - pr.top;
        if (Math.abs(r.height - pageH) < mmToPx(1)) continue;
        if (r.bottom > bottom + 0.5) {
          // find the *deepest* offender by taking an element that has no child also overflowing
          const childOverflow = [...el.children].some(
            (c) => c.getBoundingClientRect().bottom > bottom + 0.5
          );
          if (!childOverflow) {
            issues.push({
              page: i + 1,
              overflowMm: +(((r.bottom - pr.bottom) * 25.4) / 96).toFixed(1),
              tag: el.tagName.toLowerCase(),
              cls: el.className?.toString?.().slice(0, 50) ?? "",
              text: (el.innerText || "").slice(0, 60).replace(/\s+/g, " "),
            });
          }
        }
      }
    });
    return issues.slice(0, 20);
  });
  if (report.length) {
    anyFail = true;
    console.log(`✗ ${f} — ${report.length} overflow issue(s):`);
    for (const r of report) {
      console.log(
        `    p${r.page} +${r.overflowMm}mm  <${r.tag}.${r.cls}>  "${r.text}"`
      );
    }
  } else {
    console.log(`✓ ${f} — no overflow`);
  }
  await page.close();
}
await browser.close();
process.exit(anyFail ? 1 : 0);

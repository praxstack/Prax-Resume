#!/usr/bin/env node
/**
 * Render the resume in BOTH light and dark themes to two PDFs.
 * Uses the same toggle the page exposes via data-theme attribute.
 *
 *   node scripts/build-themed-pdfs.mjs
 *
 * Output:
 *   "Prakhar — UnifyApps FDSE.pdf"        (light, default)
 *   "Prakhar — UnifyApps FDSE — dark.pdf" (dark, screen mode)
 *
 * Note: the light PDF uses Playwright's print emulation (matches @media print).
 * The dark PDF uses screen emulation so dark tokens apply, then we tell
 * Playwright to print backgrounds.
 */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const html = resolve(root, "Prakhar — UnifyApps FDSE.html");
const lightOut = resolve(root, "Prakhar — UnifyApps FDSE.pdf");
const darkOut = resolve(root, "Prakhar — UnifyApps FDSE — dark.pdf");

const browser = await chromium.launch();

// LIGHT — print media (matches the existing @media print rules)
{
  const page = await browser.newPage();
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.pdf({
    path: lightOut,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
  console.log(`✓ light → ${lightOut}`);
}

// DARK — screen media so dark tokens apply, but PDF page size + margins manual
{
  const page = await browser.newPage();
  await page.emulateMedia({ media: "screen", colorScheme: "dark" });
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Force dark theme regardless of system pref + drop screen-only chrome
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    const tb = document.querySelector(".toolbar");
    if (tb) tb.style.display = "none";
    // Strip the screen sheet styling so the page fills A4 cleanly
    const style = document.createElement("style");
    style.textContent = `
      html, body { background: var(--paper-soft) !important; }
      body { padding: 0 !important; }
      .page {
        max-width: none !important;
        margin: 0 !important;
        padding: 12mm 14mm !important;
        background: var(--paper) !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        font-size: 9pt !important;
        line-height: 1.4 !important;
      }
      /* Match the @media print density tokens so 2-page fit holds */
      .name { font-size: 19pt !important; line-height: 1.05 !important; margin-bottom: 4px !important; }
      .tagline { font-size: 8.8pt !important; margin-bottom: 4px !important; }
      .contact { font-size: 7.6pt !important; gap: 2px 14px !important; }
      .icon { width: 9px !important; height: 9px !important; }
      .role { padding-left: 13px !important; margin-bottom: 10px !important; }
      .role::before { left: 2px !important; top: 4px !important; }
      .role::after { left: -1px !important; top: 4px !important; width: 6px !important; height: 6px !important; border-width: 1.2px !important; }
      .masthead { padding-bottom: 8px !important; margin-bottom: 12px !important; }
      .block { margin-bottom: 14px !important; }
      .block__title { font-size: 7.4pt !important; margin-bottom: 8px !important; gap: 10px !important; }
      .summary { font-size: 8.9pt !important; line-height: 1.46 !important; }
      .role__title { font-size: 10pt !important; }
      .role__dates { font-size: 8pt !important; }
      .role__company { font-size: 8.9pt !important; margin-bottom: 4px !important; }
      .bullets { margin-top: 2px !important; }
      .bullets li { font-size: 8.7pt !important; line-height: 1.42 !important; margin-bottom: 3px !important; padding-left: 13px !important; }
      .project { padding-top: 8px !important; }
      .project__title { font-size: 10pt !important; margin-bottom: 4px !important; }
      .project__repo { font-size: 7.2pt !important; margin-bottom: 4px !important; }
      .chips { margin-bottom: 4px !important; gap: 3px !important; }
      .chips li { font-size: 6.6pt !important; padding: 0 5px !important; }
      .project__desc { font-size: 8.3pt !important; line-height: 1.4 !important; margin-bottom: 4px !important; }
      .project__metrics { font-size: 7.8pt !important; padding-top: 4px !important; line-height: 1.4 !important; }
      .projects { gap: 14px !important; }
      .skills { font-size: 8.6pt !important; line-height: 1.4 !important; row-gap: 4px !important; column-gap: 12px !important; grid-template-columns: 110px 1fr !important; }
      .skills dt { font-size: 7.8pt !important; }
      .row { font-size: 8.7pt !important; line-height: 1.4 !important; margin-bottom: 4px !important; }
      .row__right { font-size: 8pt !important; }
      .gpa { font-size: 7.4pt !important; padding: 0 4px !important; margin-left: 6px !important; }
      .project, .row, .bullets li { break-inside: avoid; page-break-inside: avoid; }
    `;
    document.head.appendChild(style);
  });
  // Wait one frame for layout to settle
  await page.waitForTimeout(150);
  await page.pdf({
    path: darkOut,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  await page.close();
  console.log(`✓ dark  → ${darkOut}`);
}

await browser.close();

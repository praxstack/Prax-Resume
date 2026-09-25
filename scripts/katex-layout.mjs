/**
 * Shared A4 print-layout measurement for KaTeX .resume-page sheets.
 */
export const MIN_GAP_MM = 8;
export const SAFETY_MM = 2;

export function measureResumePages(page) {
  return page.evaluate(({ safetyMm }) => {
    const mmToPx = (mm) => mm * (96 / 25.4);
    const SAFETY = mmToPx(safetyMm);
    const pages = [...document.querySelectorAll(".resume-page")];
    const reports = [];
    for (const [i, sheet] of pages.entries()) {
      const pr = sheet.getBoundingClientRect();
      const bottomLimit = pr.bottom - SAFETY;
      let lowest = pr.top;
      const issues = [];
      for (const el of sheet.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute") continue;
        const r = el.getBoundingClientRect();
        if (r.height < 1 || r.width < 1) continue;
        if (Math.abs(r.height - pr.height) < mmToPx(1)) continue;
        if (r.bottom > lowest) lowest = r.bottom;
        if (r.bottom > bottomLimit + 0.5) {
          const childOverflow = [...el.children].some(
            (c) => c.getBoundingClientRect().bottom > bottomLimit + 0.5
          );
          if (!childOverflow) {
            issues.push({
              page: i + 1,
              overflowMm: +(((r.bottom - pr.bottom) * 25.4) / 96).toFixed(1),
              text: (el.innerText || "").slice(0, 70).replace(/\s+/g, " "),
            });
          }
        }
      }
      reports.push({
        page: i + 1,
        gapMm: +(((pr.bottom - lowest) * 25.4) / 96).toFixed(1),
        issues,
      });
    }
    return { pageCount: pages.length, pages: reports };
  }, { safetyMm: SAFETY_MM });
}

export function assertLayoutOk(report, label) {
  const fails = [];
  for (const p of report.pages) {
    if (p.issues.length) {
      for (const issue of p.issues) {
        fails.push(
          `${label} p${issue.page} clip +${issue.overflowMm}mm — "${issue.text}"`
        );
      }
    }
    if (p.gapMm < MIN_GAP_MM) {
      fails.push(`${label} p${p.page} tight bottom gap ${p.gapMm}mm (min ${MIN_GAP_MM}mm)`);
    }
  }
  return fails;
}

export async function auditHtmlLayout(browser, htmlPath, { viewportWidth = 794, viewportHeight = 1123 } = {}) {
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight } });
  await page.emulateMedia({ media: "print" });
  await page.goto(htmlPath, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  const report = await measureResumePages(page);
  await page.close();
  return report;
}

#!/usr/bin/env node
/**
 * Verify a single-page resume PDF against its contract.
 *
 *   node scripts/verify-single-page-pdf.mjs <resume.html> <resume.pdf>
 *   npm run verify        # default signed resume
 *
 * Canonical, repeatable verification (no external Python/Pillow needed):
 *   1. PDF is exactly ONE page (/Count == 1).
 *   2. Sheet is ~210mm wide, tall portrait (height > width, > 450mm).
 *   3. All required sections + key content are present in the PDF text layer.
 *   4. Source HTML passes PII / honesty gates (email, location, no dead repo).
 *   5. Side margins exist (text not edge-to-edge) — measured from the PDF's own
 *      text-object x-positions, so it needs no rasterizer.
 *
 * Exit 0 = all pass; exit 1 = one or more failures (printed).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [, , htmlArg, pdfArg] = process.argv;
const HTML = resolve(root, htmlArg ?? "Prakhar Shekhar Parthasarthi Resume.html");
const PDF = resolve(root, pdfArg ?? "Prakhar Shekhar Parthasarthi Resume.pdf");

const pass = [], fail = [];
const ck = (n, c, d = "") => (c ? pass : fail).push(n + (d ? `  [${d}]` : ""));

const raw = readFileSync(PDF, "latin1");
const rawBuf = readFileSync(PDF);

// 1) one page
const cm = raw.match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/) || raw.match(/\/Count\s+(\d+)/);
const pageCount = cm ? parseInt(cm[1], 10) : (raw.match(/\/Type\s*\/Page(?![s])/g) || []).length;
ck("exactly one page", pageCount === 1, `/Count=${pageCount}`);

// 2) dimensions
const mb = raw.match(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/);
let widthPt = 0, heightPt = 0;
if (mb) {
  widthPt = parseFloat(mb[3]) - parseFloat(mb[1]);
  heightPt = parseFloat(mb[4]) - parseFloat(mb[2]);
  const wMm = (widthPt * 25.4) / 72, hMm = (heightPt * 25.4) / 72;
  ck("width ~210mm", Math.abs(wMm - 210) < 6, `${wMm.toFixed(1)}mm`);
  ck("tall single sheet >450mm", hMm > 450, `${hMm.toFixed(1)}mm`);
  ck("portrait (h>w)", heightPt > widthPt);
} else ck("MediaBox present", false);

// Decompress all streams once for text + position checks.
let streamText = "";
for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  try {
    const buf = Buffer.from(m[1], "latin1");
    streamText += zlib.inflateSync(buf).toString("latin1") + "\n";
  } catch { /* not a flate stream */ }
}

// 3) sections present — prefer pdftotext if available, fall back to stream text.
let textLayer = streamText;
try {
  textLayer = execFileSync("pdftotext", [PDF, "-"], { encoding: "utf8" });
} catch { /* pdftotext not installed; use stream text */ }
const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
const nt = norm(textLayer);
for (const s of [
  "Prakhar", "SUMMARY", "CORE TECHNICAL", "EXPERIENCE", "SELECTED PROJECTS",
  "Redis Server", "Markdown Viewer App", "EDUCATION", "Bhaskaracharya", "AWARDS", "Champion",
]) ck(`content: ${s}`, nt.includes(norm(s)));

// 4) PII / honesty gates on source HTML
const src = readFileSync(HTML, "utf8");
ck("canonical email", src.includes("prakhar.mnnit.2022@gmail.com"));
ck("dev email absent", !src.includes("prax.sr.sde@gmail.com"));
ck("Shahjahanpur header", src.includes("Shahjahanpur, UP &middot; open to relocate"));
ck("dead repo -pro absent", !src.includes("markdown-viewer-pro"));

// 5) side margins from text x-positions (no rasterizer needed).
//    Collect x from Tm matrices and Td offsets; leftmost text x ≈ left padding.
const xs = [];
for (const m of streamText.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+Tm/g)) {
  xs.push(parseFloat(m[5]));
}
if (xs.length && widthPt) {
  const leftMin = Math.min(...xs);
  // 18mm padding ≈ 51pt at 72dpi, but Chromium emits in CSS-px-derived units;
  // accept a left gutter that is a clear, non-trivial fraction of page width.
  const frac = leftMin / widthPt;
  ck("side margin present (text not edge-to-edge)", leftMin > 30 && frac > 0.05, `leftX=${leftMin.toFixed(0)}pt (${(frac * 100).toFixed(1)}% of width)`);
} else {
  ck("side margin measurable", false, "no Tm x-positions found");
}

console.log("=".repeat(60));
console.log(`VERIFY: ${basename(PDF)}`);
console.log("=".repeat(60));
console.log(`\nPASS (${pass.length}):`);
for (const p of pass) console.log("  ok   " + p);
if (fail.length) {
  console.log(`\nFAIL (${fail.length}):`);
  for (const f of fail) console.log("  FAIL " + f);
}
console.log("\n" + "=".repeat(60));
console.log(`RESULT: ${fail.length ? fail.length + " FAIL" : "ALL PASS"}  (${pass.length}/${pass.length + fail.length})`);
process.exit(fail.length ? 1 : 0);

#!/usr/bin/env node
/**
 * ATS-oriented checks for KaTeX role PDFs + local content audit on HTML.
 *
 *   node scripts/run-ats-benchmarks.mjs [basename without path ...]
 *   (no args: GenAI LLM 1- and 2-pager)
 *
 * Uses npm devDependency resume-parser-ats (strict PDF analyze) plus
 * audit-resume-content.mjs on matching HTML.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);

const DEFAULT_BASES = ["Prakhar — GenAI LLM — 1-Pager", "Prakhar — GenAI LLM — 2-Pager"];

function bases() {
  if (args.length) return args.map((b) => b.replace(/\.(html|pdf)$/i, ""));
  return DEFAULT_BASES;
}

let fail = 0;

for (const base of bases()) {
  const html = resolve(root, `${base}.html`);
  const pdf = resolve(root, `${base}.pdf`);
  const name = basename(base);

  console.log(`\n=== ATS bundle  ${name} ===`);

  if (!existsSync(html)) {
    console.error(`  FAIL  missing ${basename(html)}`);
    fail++;
    continue;
  }

  const content = spawnSync(process.execPath, ["scripts/audit-resume-content.mjs", html], {
    cwd: root,
    encoding: "utf8",
  });
  process.stdout.write(content.stdout || "");
  process.stderr.write(content.stderr || "");
  if (content.status !== 0) {
    console.error(`  FAIL  content audit (${name})`);
    fail++;
  }

  if (!existsSync(pdf)) {
    console.error(`  FAIL  missing ${basename(pdf)} (run npm run build:roles)`);
    fail++;
    continue;
  }

  const ats = spawnSync(
    resolve(root, "node_modules/.bin/resume-parser-ats"),
    ["analyze", pdf, "--strictness", "strict", "--focus", "ats,structure,content"],
    { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  const out = `${ats.stdout || ""}${ats.stderr || ""}`;
  console.log(out.trimEnd());

  const gradeMatch = out.match(/\bGrade:\s*([A-F][+-]?|\d+\/100)/i);
  const scoreMatch = out.match(/\bScore:\s*(\d+)/i);
  if (gradeMatch) console.log(`  note  resume-parser-ats grade: ${gradeMatch[1]}`);
  if (scoreMatch) console.log(`  note  resume-parser-ats score: ${scoreMatch[1]}`);

  if (ats.status !== 0) {
    console.error(`  FAIL  resume-parser-ats analyze (${name}) exit ${ats.status}`);
    fail++;
  } else if (/critical|must fix|fail/i.test(out) && !/no critical/i.test(out)) {
    console.error(`  FAIL  resume-parser-ats reported critical ATS issues (${name})`);
    fail++;
  } else {
    console.log(`  ok    resume-parser-ats analyze passed (${name})`);
  }
}

console.log("\n----");
if (fail) {
  console.error(`${fail} ATS bundle(s) failed`);
  process.exit(1);
}
console.log("ALL ATS bundles passed");

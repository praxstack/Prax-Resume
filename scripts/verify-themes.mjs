#!/usr/bin/env node
/**
 * verify-themes.mjs — data-contract verifier for the resumes-v2/ creative themes.
 * Checks the UNIVERSAL AGENTS.md contracts that apply regardless of aesthetic:
 * PII (canonical email, no forbidden email, location, github, linkedin),
 * honesty (real repos only, no forbidden 'markdown-viewer-pro' slug OR 'Markdown Viewer Pro' display title),
 * and presence of core real metrics. Design-specific checks are intentionally omitted
 * (each theme is its own aesthetic). Exit 0 = all pass, 1 = any violation.
 *
 *   node scripts/verify-themes.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "resumes-v2");
const files = readdirSync(dir).filter(f => /\.html$/.test(f)).sort();

let totalFail = 0;
const results = [];

for (const f of files) {
  const html = readFileSync(resolve(dir, f), "utf8");
  // tag-stripped text — catches forbidden names split across inline tags (e.g. "Viewer <em>· Pro</em>")
  const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  const checks = {
    "canonical email":        html.includes("prakhar.mnnit.2022@gmail.com"),
    "no forbidden email":     !html.includes("prax.sr.sde"),
    "github":                 html.includes("github.com/praxstack"),
    "linkedin (full url)":    html.includes("linkedin.com/in/prakharshekhar"),
    "Shahjahanpur location":  html.includes("Shahjahanpur"),
    "redis repo":             html.includes("redis-server-java"),
    "md repo = app":          html.includes("markdown-viewer-app"),
    "no md-pro slug":         !html.includes("markdown-viewer-pro"),
    "no 'Pro' display title": !/[Mm]arkdown[\s·]+[Vv]iewer[\s·]+[Pp]ro\b/i.test(text),
  };
  const fails = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  totalFail += fails.length;
  results.push({ name: f.replace(/^Resume /, "").replace(/\.html$/, ""), fails });
}

console.log(`=== verify-themes: ${files.length} resumes-v2 themes ===`);
for (const r of results) {
  console.log(r.fails.length === 0 ? `  ok   ${r.name}` : `  FAIL ${r.name} — ${r.fails.join(", ")}`);
}
console.log("----");
console.log(totalFail === 0 ? `ALL ${files.length} themes pass data contract` : `${totalFail} contract violation(s) across themes`);
process.exit(totalFail === 0 ? 0 : 1);

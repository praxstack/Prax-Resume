#!/usr/bin/env node
/**
 * verify-resume.mjs — canonical, repeatable contract verifier for resume HTML.
 * Asserts the AGENTS.md PII / honesty / standalone rules mechanically so they
 * are enforced on every edit, not just hoped-for.
 *
 * Usage:  node scripts/verify-resume.mjs "<file>.html"
 *         npm run verify:resume -- "<file>.html"
 * Exit 0 = all contracts pass, 1 = any violation.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: verify-resume.mjs <file.html>"); process.exit(2); }

let html;
try { html = readFileSync(file, "utf8"); }
catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(2); }

let pass = 0, fail = 0;
const ok   = (m) => { console.log(`  ok   ${m}`); pass++; };
const bad  = (m) => { console.log(`  FAIL ${m}`); fail++; };
const assert = (cond, m) => cond ? ok(m) : bad(m);

console.log(`=== verify-resume: ${file} ===`);

// ── PII contracts (AGENTS.md §1) ──
assert(html.includes("prakhar.mnnit.2022@gmail.com"), "canonical email present");
assert(!html.includes("prax.sr.sde"), "forbidden dev email ABSENT");
assert(/Shahjahanpur,\s*UP/.test(html), "header location = Shahjahanpur, UP");
// phone: no 10-digit / +91 sequences anywhere
assert(!/(\+?91[\s-]?)?\b\d{10}\b/.test(html.replace(/\d{4}\s*[—–-]\s*\d{4}/g, "")), "no phone number leaked");
assert(/github\.com\/praxstack/.test(html), "github profile present");
assert(/linkedin\.com\/in\/prakharshekhar/.test(html), "linkedin profile present");

// ── Honesty contracts (AGENTS.md §2) ──
assert(!/tailored for/i.test(html), "no 'Tailored for' recruiter tag");
// only the real, verified projects may appear as praxstack repos
const repos = [...html.matchAll(/github\.com\/praxstack\/([a-z0-9-]+)/g)].map(m => m[1]);
const allowed = new Set(["redis-server-java", "markdown-viewer-app", "ai-visual-code-review", "markdown-viewer-pro"]);
const bogus = repos.filter(r => !allowed.has(r));
assert(bogus.length === 0, `only verified projects linked${bogus.length ? " (bogus: " + bogus.join(",") + ")" : ""}`);

// ── Standalone contract (AGENTS.md §3.1) ──
assert(!/href=["']css\//.test(html) && !/href=["']\.\/css\//.test(html), "no external local CSS dependency");
assert(/<style>/.test(html), "CSS inlined (<style> present)");

// ── SVG integrity (this redesign) ──
const svgOpen = (html.match(/<svg\b/g) || []).length;
const svgClose = (html.match(/<\/svg>/g) || []).length;
assert(svgOpen === svgClose && svgOpen > 0, `SVG tags balanced (${svgOpen} open / ${svgClose} close)`);
const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const uses = [...html.matchAll(/<use href="#([^"]+)"/g)].map(m => m[1]);
const dangling = uses.filter(u => !symbols.has(u));
assert(dangling.length === 0, `all <use> refs resolve to a <symbol>${dangling.length ? " (dangling: " + [...new Set(dangling)].join(",") + ")" : ""}`);

// ── Required content (real metrics must survive edits) ──
for (const m of ["47%", "33%", "195k rps", "43 bps CPT", "GPA 9.25"]) {
  assert(html.includes(m), `real metric/fact present: "${m}"`);
}
assert(/Space Grotesk/.test(html) && /Lora/.test(html), "Anthropic-inspired fonts wired (Space Grotesk + Lora)");

console.log("----");
console.log(`RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

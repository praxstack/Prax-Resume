#!/usr/bin/env node
/**
 * Local resume content + placement audit.
 *
 * Checks PII, honesty, section order, weak phrasing, quantification,
 * and role-keyword coverage. Does not call a remote API.
 *
 *   node scripts/audit-resume-content.mjs [file.html ...]
 *   (no args: every "Prakhar — *.html" in the repo root)
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const files = (args.length
  ? args.map((f) => resolve(root, f))
  : readdirSync(root)
      .filter((f) => /^Prakhar — (KaTeX Pro|FTE 2|SDE 2|FDE|SDE AI|MTS)/.test(f) && f.endsWith(".html"))
      .sort()
      .map((f) => resolve(root, f))
);

const REQUIRED = [
  "47%",
  "33%",
  "195k rps",
  "43 bps CPT",
  "GPA 9.25",
  "1.1s",
  "0.59s",
  "Software Development Engineer",
  "Bengaluru",
  "Jul 2022",
  "Sep 2025",
  "prakhar.mnnit.2022@gmail.com",
  "Shahjahanpur, UP",
  "github.com/praxstack",
  "linkedin.com/in/prakharshekhar",
];

const ALLOWED_REPOS = new Set([
  "redis-server-java",
  "markdown-viewer-app",
  "ai-visual-code-review",
  "coach-atlas",
  "audio-transcription-pipeline",
  "warp-byok-proxy",
]);

const ROLE_KEYWORDS = {
  "FTE 2": {
    need: ["React", "60%+", "Spring Boot", "80%+"],
    anyOf: ["full-time", "full time Software Development Engineer", "intern then"],
  },
  "SDE 2": {
    need: ["CompletableFuture", "SQS", "CDK", "microservices", "80%+", "195k rps"],
  },
  FDE: {
    need: ["on-call", "partner", "43 bps CPT", "150+", "COE", "customer"],
  },
  "SDE AI": {
    need: ["Bedrock", "Claude", "Voxtral", "Fabric", "npm v2.4.1", "BYOK", "warp-byok-proxy"],
  },
  MTS: {
    need: ["deadlock", "195k rps", "0.3 ms", "idempotent", "42 tests", "#2061"],
  },
};

const FIRST_PERSON = /\b(I|I'm|I've|my|me|our|we)\b/i;

function auditSlugFromFilename(name) {
  if (/^Prakhar — KaTeX Pro (1|2)-Pager\.html$/.test(name)) return "KaTeX Pro";
  const m = name.match(/^Prakhar — (.+?) — (1|2)-Pager\.html$/);
  return m ? m[1] : null;
}

const VERBS = /\b(owned|shipped|built|designed|refactored|parallelised|parallelized|migrated|authored|introduced|held|resolved|orchestrated|published|fixed|applied|cut|routed|deprecated)\b/i;

const WEAK = [
  [/responsible for/i, "responsible for"],
  [/duties included/i, "duties included"],
  [/helped (with|to)\b/i, "helped with/to"],
  [/assisted with/i, "assisted with"],
  [/worked on various/i, "worked on various"],
  [/\bvarious\b/i, "various"],
  [/team player/i, "team player"],
  [/\bpassionate\b/i, "passionate"],
  [/\bsynergy\b/i, "synergy"],
  [/\bleverag/i, "leverage"],
  [/rockstar|ninja|guru/i, "hype title"],
  [/forward deployed engineer/i, "claimed Forward Deployed Engineer title"],
  [/member of technical staff/i, "claimed Member of Technical Staff title"],
  [/\bFTE\s*2\b/i, "FTE 2 printed on the page"],
  [/\bSDE\s*(II|2)\b/i, "SDE II / SDE 2 printed as a title"],
  [/\bAI Engineer\b/i, "AI Engineer printed as a title"],
  [/OpenAI|Anthropic/i, "target company name on the page"],
  [/LangChain|fine-tun|Kubernetes|\bk8s\b/i, "unverified skill"],
  [/markdown-viewer-pro/i, "dead repo markdown-viewer-pro"],
  [/tailored for/i, "Tailored for tag"],
  [/prax\.sr\.sde/i, "forbidden email"],
];

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryText(html) {
  const m = html.match(/<p class="summary">([\s\S]*?)<\/p>/);
  return m ? textOf(m[1]) : "";
}

function bulletTexts(html) {
  const out = [];
  for (const block of html.matchAll(/<ul class="bullets">([\s\S]*?)<\/ul>/g)) {
    for (const m of block[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      out.push(textOf(m[1]));
    }
  }
  return out;
}

let failedFiles = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const text = textOf(html);
  const name = basename(file);
  const fails = [];
  const warns = [];

  for (const fact of REQUIRED) {
    if (!html.includes(fact) && !text.includes(fact)) fails.push(`missing fact: ${fact}`);
  }
  if (!/<style>/.test(html)) fails.push("CSS not inlined");
  if (/href=["'][^"']*css\//.test(html)) fails.push("external CSS");

  const phoneHay = html.replace(/\d{4}\s*[—–-]\s*\d{4}/g, "");
  if (/(\+?91[\s-]?)?\b\d{10}\b/.test(phoneHay)) fails.push("phone number present");

  const repos = [...html.matchAll(/github\.com\/praxstack\/([a-z0-9-]+)/g)].map((m) => m[1]);
  const bogus = repos.filter((r) => !ALLOWED_REPOS.has(r));
  if (bogus.length) fails.push(`unverified repo: ${bogus.join(", ")}`);

  const expAt = text.indexOf("Experience");
  const eduAt = text.indexOf("Education");
  const awardsAt = text.indexOf("Awards");
  const skillsAt = text.indexOf("Skills");
  if (skillsAt < 0) fails.push("Skills section missing");
  if (expAt < 0) fails.push("Experience section missing");
  if (eduAt < 0) fails.push("Education section missing");
  if (awardsAt < 0) fails.push("Awards section missing");
  if (expAt >= 0 && eduAt >= 0 && expAt > eduAt) fails.push("Education appears before Experience");
  if (/EngineerJul|EngineerJan|EngineerSep|EngineerMay/.test(text)) fails.push("date glued to title");

  const contactLis = html.match(/<ul class="contact"[\s\S]*?<\/ul>/);
  const liCount = contactLis ? (contactLis[0].match(/<li\b/g) || []).length : 0;
  if (liCount < 3) fails.push(`contact should be 3 separate lines (found ${liCount})`);

  for (const [re, label] of WEAK) {
    const hit = text.match(re);
    if (hit) fails.push(`wording: ${label} (“${hit[0]}”)`);
  }

  const labels = [...html.matchAll(/<span class="lbl">([^<]+)<\/span>/g)].map((m) => m[1]);
  for (const label of labels) {
    if (label.length > 3 && label === label.toUpperCase()) fails.push(`all-caps bullet label: ${label}`);
  }
  const stats = [...html.matchAll(/<div class="stat-label">([^<]+)<\/div>/g)].map((m) => m[1]);
  for (const label of stats) {
    if (label === label.toUpperCase()) fails.push(`all-caps stat label: ${label}`);
  }

  const bullets = bulletTexts(html);
  const proseScope = `${summaryText(html)} ${bullets.join(" ")}`;
  const fpHit = proseScope.match(FIRST_PERSON);
  if (fpHit) fails.push(`wording: first person in summary or bullets (“${fpHit[0]}”)`);

  if (bullets.length < 4) fails.push(`too few experience bullets (${bullets.length})`);
  const unquantified = bullets.filter((b) => !/\d/.test(b));
  if (unquantified.length > 2) {
    fails.push(`${unquantified.length} bullets without a number: “${unquantified[0].slice(0, 70)}”`);
  } else if (unquantified.length) {
    warns.push(`${unquantified.length} bullet(s) without a number (no invented metric added): “${unquantified[0].slice(0, 70)}”`);
  }
  const noVerb = bullets.filter((b) => !VERBS.test(b));
  if (noVerb.length) {
    fails.push(`${noVerb.length} bullet(s) without an action verb: “${noVerb[0].slice(0, 70)}”`);
  }

  const slug = auditSlugFromFilename(name);
  const roleSpec = slug ? ROLE_KEYWORDS[slug] : null;
  if (roleSpec) {
    const missing = roleSpec.need.filter((k) => !text.includes(k) && !html.includes(k));
    if (missing.length) fails.push(`role keywords missing: ${missing.join(", ")}`);
    if (roleSpec.anyOf) {
      const ok = roleSpec.anyOf.some((k) => text.includes(k) || html.includes(k));
      if (!ok) fails.push(`role keywords missing (one of): ${roleSpec.anyOf.join(", ")}`);
    }
  }

  if (!/Master of Computer Applications/.test(text)) fails.push("degree keyword Master missing");
  if (!/Bachelor of Science/.test(text)) fails.push("degree keyword Bachelor missing");
  if ((text.match(/Under review/g) || []).length < 1 && /deer-flow|claude-mem|tolaria/.test(text)) {
    fails.push("open PRs must be labeled Under review");
  }
  if (/contributed to deer-flow|merged into deer-flow|merged into claude-mem|merged into tolaria/i.test(text)) {
    fails.push("open PR described as merged");
  }

  warns.push("phone intentionally absent — strict ATS phone points stay at 0");
  if (/grid-template-columns:\s*1fr 1fr/.test(html)) {
    warns.push("project grid is two columns — readable, costs the single-column ATS check");
  }

  const status = fails.length ? "FAIL" : "PASS";
  if (fails.length) failedFiles++;
  console.log(`\n=== ${status}  ${name} ===`);
  for (const f of fails) console.log(`  FAIL  ${f}`);
  for (const w of warns) console.log(`  note  ${w}`);
  if (!fails.length) console.log(`  ok    ${bullets.length} quantified bullets, facts and wording clean`);
}

console.log("\n----");
console.log(`${files.length - failedFiles}/${files.length} files passed content + placement audit`);
process.exit(failedFiles ? 1 : 0);

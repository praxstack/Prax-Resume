#!/usr/bin/env node
/**
 * Build role-targeted KaTeX Pro resumes (1-pager and 2-pager).
 * Facts are the verified Amazon / project record. Targeting changes
 * emphasis and order only. Amazon title stays Software Development Engineer.
 *
 *   node scripts/build-role-resumes.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { katexStyleBlock, katexProStyleBlock } from "./load-katex-styles.mjs";
import { assertLayoutOk, measureResumePages } from "./katex-layout.mjs";

const root = resolve(import.meta.dirname, "..");
const CHECK_HTML = process.argv.includes("--check-html");
const style1 = katexStyleBlock(1);
const style2 = katexStyleBlock(2);
const stylePro1 = katexProStyleBlock(1);
const stylePro2 = katexProStyleBlock(2);

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function outputPath(role, pagesLabel) {
  if (role.fileBase) {
    return resolve(root, `${role.fileBase} ${pagesLabel}.html`);
  }
  return resolve(root, `Prakhar — ${role.slug} — ${pagesLabel}.html`);
}

const FONT = `https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap`;

function doc({ description, style, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prakhar Shekhar Parthasarthi — Software Engineer</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONT}" rel="stylesheet">
  ${style}
</head>
<body>
  <div class="deck">
${body}
  </div>
</body>
</html>
`;
}

function header(subtitle) {
  return `    <header class="titleblock">
      <h1 class="name">Prakhar Shekhar Parthasarthi</h1>
      <p class="subtitle">${subtitle}</p>
      <ul class="contact" aria-label="Contact">
        <li><a href="mailto:prakhar.mnnit.2022@gmail.com">prakhar.mnnit.2022@gmail.com</a></li>
        <li>Shahjahanpur, UP · open to relocate</li>
        <li><a href="https://github.com/praxstack" rel="noopener">github.com/praxstack</a> | <a href="https://www.linkedin.com/in/prakharshekhar" rel="noopener">linkedin.com/in/prakharshekhar</a> | <a href="https://prax-portfolio-one.vercel.app" rel="noopener">prax-portfolio-one.vercel.app</a></li>
      </ul>
    </header>`;
}

function metrics(stats) {
  const cells = stats
    .map(
      (s) =>
        `        <div class="stat"><div class="stat-num">${s.num}</div><div class="stat-label">${s.label}</div></div>`
    )
    .join("\n");
  return `      <div class="metrics" aria-label="Impact highlights">\n${cells}\n      </div>`;
}

function skills(rows, id) {
  const body = rows
    .map(([cat, val]) => `          <div class="skill-cat">${cat}</div>\n          <div class="skill-val">${val}</div>`)
    .join("\n");
  return `      <section aria-labelledby="${id}">
        <h2 id="${id}" class="sect">Skills</h2>
        <div class="skills">
${body}
        </div>
      </section>`;
}

function bullets(items) {
  return `          <ul class="bullets">\n${items.map((b) => `            <li>${b}</li>`).join("\n")}\n          </ul>`;
}

function roleBlock(title, company, items) {
  return `        <article class="role">
          <div class="role-head">
            <h3 class="role-title">${title}</h3>
          </div>
          <p class="role-co">${company}</p>
${bullets(items)}
        </article>`;
}

const AMAZON = `<strong>Amazon</strong> · Travel (Hotels &amp; Flights) · Bengaluru`;
const AMAZON_INTERN = `<strong>Amazon</strong> · Bengaluru`;
const TITLE = `Software Development Engineer, Jul 2022 — Sep 2025`;
const INTERN_TITLE = `Software Development Engineer, Intern, May 2021 – Jul 2021 · Feb 2022 – Jul 2022`;
const INTERN_TITLE_SHORT = `Software Development Engineer, Intern, May 2021 – Jul 2021 · Feb 2022 – Jul 2022`;
const INTERN_TITLE_1P = `Software Development Engineer, Intern, 2021 — 2022`;

const OWN_L = `<span class="lbl">Service ownership — Spring Boot, Spring MVC.</span> Owned <strong>4 customer-facing microservices</strong> powering the hotel booking platform — search, listing, room selection, order review — across design, code review, deploy, and on-call. REST controllers, service-layer logic, <span class="tt">@Repository</span> DynamoDB DAOs via Spring DI. Prime-exclusive discount and partner-discount integration — <span class="metric">~30 bps</span> funnel churn drop.`;
const CONC_L = `<span class="lbl">JVM concurrency — CompletableFuture, bounded executors.</span> Refactored sequential downstream calls into <span class="tt">CompletableFuture.allOf()</span> on a bounded <span class="tt">ExecutorService</span>; parallelised 6 partner-API lookups — hotel landing p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion up <span class="metric">+33%</span>. GZIP on 150–200 MB catalog payloads cut wire size <span class="metric">95%</span>.`;
const EVT_L = `<span class="lbl">Event-driven — SQS + Step Functions.</span> Designed idempotent Java webhook for real-time flight schedule changes — SQS ingestion, DynamoDB dedup keys, audit logging, automated offline modifications — <span class="metric">43 bps CPT</span>. Orchestrated booking state machine (confirm/cancel/retry) on Step Functions with Java Lambda handlers.`;
const IAC_L = `<span class="lbl">Infrastructure as code — AWS CDK (Java).</span> Authored all service IaC in <strong>Java CDK</strong> — Lambdas, DynamoDB, SQS, Step Functions, API Gateway, CloudWatch alarms. Migrated 2 services from hand-rolled CloudFormation — rollback incidents <span class="metric">halved</span>.`;
const TEST_L = `<span class="lbl">Testing — JUnit 5, Mockito, Spring Boot.</span> Held <span class="metric">80%+</span> line coverage; Mockito argument captors for downstream contract verification; <span class="tt">@SpringBootTest</span> integration tests against in-memory DynamoDB. Introduced Gradle JaCoCo coverage gates in CI.`;
const OPS_L = `<span class="lbl">Operational excellence.</span> On-call tickets cut from <span class="metric">20+ to ~5 per shift</span> (<span class="metric">~2 SDE-weeks/week</span> reclaimed). Java email-automation deprecated stale WebLab experiments — config-hygiene incidents from 5–6 to <span class="metric">0</span>. Resolved <span class="metric">150+</span> production incidents; authored COEs. Built auto-insurance purchase flow (Java + React) — <span class="metric">60%+</span> renewal lift.`;
const CUST_L = `<span class="lbl">Customer delivery — Java + React.</span> Built the auto-insurance purchase flow (Java services + React) with milestone persistence and auto-fill — <span class="metric">60%+</span> renewal lift, on the four booking services owned through deploy and on-call.`;
const OPS_FDE = `<span class="lbl">Customer operations.</span> On-call tickets cut from <span class="metric">20+ to ~5 per shift</span> (<span class="metric">~2 SDE-weeks/week</span> reclaimed). Resolved <span class="metric">150+</span> production incidents and authored COEs. Built the auto-insurance purchase flow (Java + React) — <span class="metric">60%+</span> renewal lift.`;
const IAC_OPS = `<span class="lbl">Infrastructure and on-call.</span> Authored service IaC in <strong>Java CDK</strong>; migrated 2 services from CloudFormation — rollback incidents <span class="metric">halved</span>. On-call from <span class="metric">20+ to ~5 per shift</span> (<span class="metric">~2 SDE-weeks/week</span> reclaimed); resolved <span class="metric">150+</span> incidents; config-hygiene incidents to <span class="metric">0</span>.`;

const OWN_S = `<span class="lbl">Ownership.</span> Owned <strong>4 customer-facing microservices</strong> (search → order review); Spring Boot REST, DynamoDB DAOs, Prime and partner discount flows — <span class="metric">~30 bps</span> funnel churn drop.`;
const CONC_S = `<span class="lbl">Concurrency.</span> Parallelised 6 partner APIs via <span class="tt">CompletableFuture.allOf()</span> — p90 <span class="metric">47%</span> (<span class="metric">1.1s→0.59s</span>), conversion <span class="metric">+33%</span>; GZIP cut wire size <span class="metric">95%</span>.`;
const EVT_S = `<span class="lbl">Event-driven.</span> Designed an idempotent flight schedule-change webhook (SQS, dedup keys) — <span class="metric">43 bps CPT</span>; Step Functions booking state machine with Java Lambdas.`;
const IAC_S = `<span class="lbl">IaC.</span> Authored service infra in <strong>Java CDK</strong>; migrated 2 services from CloudFormation — rollback incidents <span class="metric">halved</span>.`;
const TEST_S = `<span class="lbl">Testing.</span> Held <span class="metric">80%+</span> line coverage; <span class="tt">@SpringBootTest</span> + in-memory DynamoDB; introduced Gradle JaCoCo gates in CI.`;
const OPS_S = `<span class="lbl">Operations.</span> On-call <span class="metric">20+→~5</span>/shift (<span class="metric">~2 SDE-weeks/week</span>); resolved <span class="metric">150+</span> incidents and authored COEs; config-hygiene incidents to <span class="metric">0</span>.`;
const CUST_S = `<span class="lbl">Customer delivery.</span> Built the auto-insurance purchase flow (Java + React) — <span class="metric">60%+</span> renewal lift, owned through deploy and on-call.`;

const KATEX_B1 = [
  OWN_S,
  CONC_S,
  EVT_S,
  `<span class="lbl">IaC &amp; ops.</span> All service infra in <strong>Java CDK</strong>; migrated 2 services from CloudFormation — rollback incidents <span class="metric">halved</span>. On-call <span class="metric">20+→~5</span>/shift; resolved <span class="metric">150+</span> incidents.`,
  TEST_S,
];

const INTERN_GQL = `Migrated legacy GraphQL resolvers to <strong>Java</strong> — DynamoDB via Spring-injected DAOs, API Gateway + Lambda.`;
const INTERN_OCR = `Shipped <strong>One-Click Renewal</strong> for auto-insurance using past-purchase data — async Java pre-fill workflow.`;
const INTERN_DI = `Applied OO design and <strong>Google Guice DI</strong>; <span class="metric">90%+</span> unit-test coverage (JUnit 5 + Mockito).`;

const INTERN_S_FTE = `Shipped <strong>One-Click Renewal</strong> for auto-insurance; migrated GraphQL resolvers to Java + DynamoDB; <span class="metric">90%+</span> unit-test coverage (JUnit 5 + Mockito, Guice DI).`;
const INTERN_S_SDE = `Migrated GraphQL resolvers to Java + DynamoDB (API Gateway + Lambda); shipped <strong>One-Click Renewal</strong>; <span class="metric">90%+</span> unit-test coverage (JUnit 5 + Mockito).`;

const SK_JAVA = `<strong>Java 17</strong>, Spring Boot, Spring MVC, Guice, JUnit 5, Mockito, SLF4J, Maven, Gradle · <span class="tt">ExecutorService</span>, <span class="tt">CompletableFuture</span>, <span class="tt">ConcurrentHashMap</span>, JVM profiling, GC analysis`;
const SK_JAVA_S = `Java 17, Spring Boot/MVC, Guice, JUnit 5, Mockito, Maven · concurrency, GC profiling`;
const SK_DIST = `Microservices, REST, GraphQL, event-driven architecture, idempotency &amp; dedup keys, state machines, retry/backoff, DLQ, at-least-once, TDD`;
const SK_DIST_S = `Microservices, REST, GraphQL, idempotency, state machines, DLQ, at-least-once, TDD`;
const SK_AWS = `Lambda (Java), DynamoDB, SQS, Step Functions, API Gateway, AppSync, CloudWatch, ECS, <strong>CDK (Java)</strong>`;
const SK_AWS_S = `Lambda, DynamoDB, SQS, Step Functions, API Gateway, CloudWatch, ECS, CDK (Java)`;
const SK_FE = `<strong>React.js (SSR &amp; CSR)</strong>, Redux, HTML/CSS, JavaScript/TypeScript`;
const SK_FE_S = `React (SSR &amp; CSR), Redux, HTML/CSS, TypeScript`;
const SK_DATA = `DynamoDB, Redis, NoSQL modelling, SQL, caching strategies`;
const SK_DATA_S = `DynamoDB, Redis, NoSQL modelling, SQL, caching`;
const SK_TOOL = `Git, GitHub, CI/CD, Gradle JaCoCo coverage gates, Agile/Scrum, on-call, code review, incident response · Python, C++`;
const SK_TOOL_S = `Git, CI/CD, JaCoCo gates, Agile, on-call, incident response · Python, C++`;
const SK_AI = `AWS Bedrock, Claude (transcript repair), Voxtral (ASR), bearer-token auth, multi-provider BYOK`;
const SK_AI_S = `AWS Bedrock, Claude, Voxtral, bearer-token auth, multi-provider BYOK`;

function stat(num, label) {
  return { num, label };
}
const S47 = stat(`<span class="mathrm">47</span>%`, "p90 latency cut");
const S33 = stat(`+<span class="mathrm">33</span>%`, "conversion lift");
const S195 = stat(`<span class="mathrm">195</span>k`, "GET rps · Java Redis");
const S20 = stat(`20<span class="mathrm">→</span>5`, "on-call / shift");
const S60 = stat(`<span class="mathrm">60</span>%+`, "renewal lift");
const S4 = stat(`<span class="mathrm">4</span>`, "services owned");
const S80 = stat(`<span class="mathrm">80</span>%+`, "line coverage");
const S43 = stat(`<span class="mathrm">43</span>`, "bps CPT");
const S3PR = stat(`<span class="mathrm">3</span>`, "merged Fabric PRs");
const S63 = stat(`<span class="mathrm">63</span>`, "pipeline tests");
const SNPM = stat(`v<span class="mathrm">2.4.1</span>`, "npm package");
const S42 = stat(`<span class="mathrm">42</span>`, "Redis tests");
const S03 = stat(`&lt;<span class="mathrm">0.3</span>`, "ms p50");

const PROJ = {
  ai: {
    full: `<article class="proj">
            <h3 class="proj-title">AI Visual Code Review</h3>
            <p class="proj-repo"><a href="https://github.com/praxstack/ai-visual-code-review" rel="noopener">github.com/praxstack/ai-visual-code-review</a> · <a href="https://www.npmjs.com/package/ai-visual-code-review" rel="noopener">npm</a></p>
            <ul class="chips"><li>Node.js</li><li>TypeScript</li><li>Jest</li><li>VS Code API</li></ul>
            <p class="proj-desc">Security-hardened visual code-review tool with GitHub-style diff UI, AI markdown exports, command-injection protection, rate limiting. Published npm + VS Code extension.</p>
            <p class="proj-metrics"><strong>Published:</strong> <span class="metric">npm v2.4.1</span> · MIT.</p>
          </article>`,
    compact: `<article class="proj">
          <h3 class="proj-title">AI Visual Code Review</h3>
          <p class="proj-repo"><a href="https://github.com/praxstack/ai-visual-code-review" rel="noopener">github.com/praxstack/ai-visual-code-review</a> · npm v2.4.1</p>
          <p class="proj-desc">Visual diff review + VS Code extension; TypeScript, Jest, command-injection hardening, AI markdown exports.</p>
        </article>`,
  },
  redis: {
    full: `<article class="proj">
            <h3 class="proj-title">Redis Server in Java</h3>
            <p class="proj-repo"><a href="https://github.com/praxstack/redis-server-java" rel="noopener">github.com/praxstack/redis-server-java</a></p>
            <ul class="chips"><li>Java 17</li><li>ConcurrentHashMap</li><li>JUnit 5</li></ul>
            <p class="proj-desc">RESP2-compatible Redis from scratch; bounded <span class="tt">ExecutorService</span>, lock-free reads, hybrid TTL eviction, TCP integration tests.</p>
            <p class="proj-metrics">GET <span class="metric">195k rps</span> · SET <span class="metric">154k rps</span> · p50 &lt; <span class="metric">0.3 ms</span> · <strong>42 tests</strong>.</p>
          </article>`,
    compact: `<article class="proj">
          <h3 class="proj-title">Redis Server in Java</h3>
          <p class="proj-repo"><a href="https://github.com/praxstack/redis-server-java" rel="noopener">github.com/praxstack/redis-server-java</a></p>
          <p class="proj-desc">RESP2 from scratch; bounded thread pool, <span class="tt">ConcurrentHashMap</span>, hybrid TTL. GET <span class="metric">195k rps</span>, SET <span class="metric">154k rps</span>, p50 &lt; <span class="metric">0.3 ms</span>; 42 tests.</p>
        </article>`,
  },
  audio: {
    full: `<article class="proj">
            <h3 class="proj-title">Audio Transcription Pipeline</h3>
            <p class="proj-repo"><a href="https://github.com/praxstack/audio-transcription-pipeline" rel="noopener">github.com/praxstack/audio-transcription-pipeline</a></p>
            <ul class="chips"><li>Python</li><li>Bedrock</li><li>pyannote</li><li>pytest</li></ul>
            <p class="proj-desc">Multi-stage pipeline: raw audio/video → speaker-labelled Markdown. pyannote diarization + AWS Bedrock (Voxtral ASR + Claude repair).</p>
            <p class="proj-metrics"><span class="metric">63</span> tests · 6 stages · MIT.</p>
          </article>`,
    compact: `<article class="proj">
          <h3 class="proj-title">Audio Transcription Pipeline</h3>
          <p class="proj-repo"><a href="https://github.com/praxstack/audio-transcription-pipeline" rel="noopener">github.com/praxstack/audio-transcription-pipeline</a></p>
          <p class="proj-desc">Six-stage audio/video → speaker-labelled Markdown. Bedrock Voxtral ASR + Claude repair. 63 tests.</p>
        </article>`,
  },
  coach: {
    full: `<article class="proj">
            <h3 class="proj-title">Coach Atlas</h3>
            <p class="proj-repo"><a href="https://github.com/praxstack/coach-atlas" rel="noopener">github.com/praxstack/coach-atlas</a></p>
            <ul class="chips"><li>React</li><li>TypeScript</li><li>Mermaid</li><li>KaTeX</li></ul>
            <p class="proj-desc">AI technical-interview mentor + tutorial studio; Socratic prep, Mermaid/KaTeX/code rendering, multi-provider BYOK (keys in browser).</p>
            <p class="proj-metrics">React + TypeScript · deployed on Vercel.</p>
          </article>`,
    compact: `<article class="proj">
          <h3 class="proj-title">Coach Atlas</h3>
          <p class="proj-repo"><a href="https://github.com/praxstack/coach-atlas" rel="noopener">github.com/praxstack/coach-atlas</a></p>
          <p class="proj-desc">AI interview mentor + tutorial studio; React/TS, Mermaid/KaTeX rendering, multi-provider BYOK (keys in browser).</p>
        </article>`,
  },
  warp: {
    full: `<article class="proj">
            <h3 class="proj-title">Warp BYOK Proxy</h3>
            <p class="proj-repo"><a href="https://github.com/praxstack/warp-byok-proxy" rel="noopener">github.com/praxstack/warp-byok-proxy</a> · AGPL-3.0</p>
            <ul class="chips"><li>Rust</li><li>AWS Bedrock</li><li>BYOK</li></ul>
            <p class="proj-desc">Local proxy that routes Warp Terminal AI calls to an operator-controlled AWS Bedrock account. Bearer-token and AWS credential auth; protobuf chat mapped onto Bedrock Converse streaming.</p>
            <p class="proj-metrics"><span class="metric">113</span> Rust tests.</p>
          </article>`,
    compact: `<article class="proj">
          <h3 class="proj-title">Warp BYOK Proxy</h3>
          <p class="proj-repo"><a href="https://github.com/praxstack/warp-byok-proxy" rel="noopener">github.com/praxstack/warp-byok-proxy</a></p>
          <p class="proj-desc">Rust local proxy routing Warp Terminal AI calls to AWS Bedrock (BYOK, bearer and AWS credentials). 113 Rust tests. AGPL-3.0.</p>
        </article>`,
  },
  fabric: {
    compact: `<article class="proj">
          <h3 class="proj-title">Open Source — Fabric (42k stars)</h3>
          <p class="proj-repo"><a href="https://github.com/danielmiessler/Fabric" rel="noopener">danielmiessler/Fabric</a> · Go</p>
          <p class="proj-desc">3 merged PRs: Bedrock bearer auth (#2044), dynamic regions (#2052), streaming deadlock fix (#2061).</p>
        </article>`,
  },
};

const PRS = {
  2044: `<li><a href="https://github.com/danielmiessler/Fabric/pull/2044" rel="noopener">#2044</a> — AWS Bedrock bearer-token (ABSK) auth + guided <span class="tt">--setup</span>. <span class="oss-diff">+882 / −83</span></li>`,
  2052: `<li><a href="https://github.com/danielmiessler/Fabric/pull/2052" rel="noopener">#2052</a> — dynamic Bedrock region fetching (40+ regions). <span class="oss-diff">+252 / −15</span></li>`,
  2061: `<li><a href="https://github.com/danielmiessler/Fabric/pull/2061" rel="noopener">#2061</a> — streaming-goroutine deadlock fix in <span class="tt">Chatter.Send</span>. <span class="oss-diff">+494 / −42</span></li>`,
};

function oss(order) {
  return `        <div class="oss-block">
          <h3 class="oss-title">Open-Source Contributions</h3>
          <p class="proj-desc"><strong>Merged into <a href="https://github.com/danielmiessler/Fabric" rel="noopener">danielmiessler/Fabric</a></strong> (Go, 42k stars):</p>
          <ul class="oss-list">
            ${order.map((n) => PRS[n]).join("\n            ")}
          </ul>
          <p class="oss-open">Under review: <a href="https://github.com/bytedance/deer-flow/pull/3790" rel="noopener">deer-flow</a>, <a href="https://github.com/thedotmack/claude-mem/pull/2710" rel="noopener">claude-mem</a>, <a href="https://github.com/refactoringhq/tolaria/pull/912" rel="noopener">tolaria</a>.</p>
        </div>`;
}

function projects(keys, density) {
  return `        <div class="projects">
          ${keys.map((k) => PROJ[k][density]).join("\n          ")}
        </div>`;
}

function edu(fullCollege) {
  const bsc = fullCollege
    ? `<strong>Bachelor of Science (B.Sc. Hons), Computer Science</strong> · Bhaskaracharya College, University of Delhi · 2015 — 2018`
    : `<strong>Bachelor of Science (B.Sc. Hons), Computer Science</strong> · University of Delhi · 2015 — 2018`;
  return `      <section aria-labelledby="edu-h">
        <h2 id="edu-h" class="sect">Education</h2>
        <div class="row"><p><strong>Master of Computer Applications (M.C.A.), Computer Science</strong> · MNNIT, Prayagraj · GPA 9.25 · 2019 — 2022</p></div>
        <div class="row"><p>${bsc}</p></div>
      </section>`;
}

function awards() {
  return `      <section aria-labelledby="awards-h">
        <h2 id="awards-h" class="sect">Awards</h2>
        <div class="row">
          <p><strong>Amazon Pay Merchants Categories Champion</strong> — 100+ hotel trust-buster bugs; on-call <span class="metric">20+ to ~5</span> per shift · 2023</p>
        </div>
      </section>`;
}

function summary(id, html) {
  return `      <section aria-labelledby="${id}">
        <h2 id="${id}" class="sect">Summary</h2>
        <p class="summary">${html}</p>
      </section>`;
}

const ROLES = [
  {
    slug: "KaTeX Pro",
    fileBase: "Prakhar — KaTeX Pro",
    auditSlug: "KaTeX Pro",
    subtitle: "Full-Stack Software Engineer · Java &amp; Spring Boot · React · AWS",
    description:
      "Resume of Prakhar Shekhar Parthasarthi — Full-Stack Software Engineer (ex-Amazon). Professional KaTeX Pro résumé.",
    stats: [S47, S33, S195, S20],
    summary2: `Full-stack software engineer with <strong>3+ years at Amazon</strong> across Payments and Travel — <strong>owned 4 microservices end-to-end</strong> through design, build, deploy, and on-call. Java-heavy backend (<strong>Java 17 / Spring Boot</strong>, JVM concurrency with <span class="tt">CompletableFuture</span>, bounded <span class="tt">ExecutorService</span>, <span class="tt">ConcurrentHashMap</span>), idempotent event-driven architecture over <strong>SQS + Step Functions</strong>, and typed infrastructure in <strong>AWS CDK (Java)</strong> — paired with <strong>React (SSR &amp; CSR) + Redux</strong> for customer-facing flows.`,
    summary1: `Full-stack engineer with <strong>3+ years at Amazon</strong> (Travel — Hotels &amp; Flights); owned <strong>4 microservices</strong> end-to-end through design, deploy, and on-call. Backend-heavy: <strong>Java 17 / Spring Boot</strong>, JVM concurrency (<span class="tt">CompletableFuture</span>, bounded <span class="tt">ExecutorService</span>), idempotent event-driven flows over <strong>SQS + Step Functions</strong>, IaC in <strong>AWS CDK (Java)</strong>; front-end: <strong>React (SSR &amp; CSR) + Redux</strong> on customer-facing booking surfaces.`,
    skills2: [
      ["Java &amp; JVM", SK_JAVA],
      ["Distributed Systems", SK_DIST],
      ["AWS", SK_AWS],
      ["Front-end", SK_FE],
      ["Data &amp; Storage", SK_DATA],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Java &amp; JVM", SK_JAVA_S],
      ["Distributed", SK_DIST_S],
      ["AWS", SK_AWS_S],
      ["Front-end", SK_FE_S],
      ["Data", SK_DATA_S],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [OWN_L, CONC_L, EVT_L, IAC_L],
    p2: [TEST_L, OPS_L],
    b1: KATEX_B1,
    intern2: [INTERN_GQL, INTERN_OCR, INTERN_DI],
    intern1: `Migrated GraphQL resolvers to Java + DynamoDB; shipped <strong>One-Click Renewal</strong> for auto-insurance; <span class="metric">90%+</span> unit-test coverage (JUnit 5 + Mockito).`,
    internTitle1: INTERN_TITLE_1P,
    proj2: ["ai", "redis", "audio", "coach"],
    proj1: ["ai", "redis", "coach", "fabric"],
    oss: [2044, 2052, 2061],
    style1: stylePro1,
    style2: stylePro2,
  },
  {
    slug: "FTE 2",
    subtitle: "Software Engineer · Full-stack delivery · Java, React, AWS",
    description: "Resume of Prakhar Shekhar Parthasarthi, full-stack software engineer (ex-Amazon SDE). Emphasis on end-to-end delivery, React, and production ownership.",
    stats: [S47, S33, S60, S20],
    summary2: `Software engineer who joined Amazon as an intern and then became a full-time Software Development Engineer, with <strong>3+ years</strong> across Payments and Travel. Owned <strong>4 microservices</strong> end-to-end — design, build, deploy, and on-call — in <strong>Java 17 / Spring Boot</strong>, and shipped customer-facing <strong>React (SSR &amp; CSR) + Redux</strong>, including an auto-insurance purchase flow with a <span class="metric">60%+</span> renewal lift. Hotel landing p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>) and conversion rose <span class="metric">+33%</span>.`,
    summary1: `Full-stack engineer, intern then full-time Software Development Engineer at Amazon (<strong>3+ years</strong>, Travel). Owned <strong>4 microservices</strong> in <strong>Java 17 / Spring Boot</strong> and shipped <strong>React</strong> booking and insurance flows — p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion <span class="metric">+33%</span>, renewals <span class="metric">60%+</span>.`,
    skills2: [
      ["Front-end", SK_FE],
      ["Java &amp; JVM", SK_JAVA],
      ["AWS", SK_AWS],
      ["Distributed Systems", SK_DIST],
      ["Data &amp; Storage", SK_DATA],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Front-end", SK_FE_S],
      ["Java &amp; JVM", SK_JAVA_S],
      ["AWS", SK_AWS_S],
      ["Distributed", SK_DIST_S],
      ["Data", SK_DATA_S],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [OWN_L, CONC_L, CUST_L, TEST_L],
    p2: [EVT_L, IAC_OPS],
    b1: [OWN_S, CONC_S, CUST_S, TEST_S, EVT_S],
    intern2: [INTERN_OCR, INTERN_GQL, INTERN_DI],
    intern1: INTERN_S_FTE,
    proj2: ["ai", "coach", "redis", "audio"],
    proj1: ["ai", "coach", "redis", "fabric"],
    oss: [2044, 2052, 2061],
  },
  {
    slug: "SDE 2",
    subtitle: "Software Engineer · Distributed systems · Java 17 · AWS",
    description: "Resume of Prakhar Shekhar Parthasarthi, software engineer (ex-Amazon SDE). Emphasis on Java services, concurrency, and event-driven AWS.",
    stats: [S47, S195, S4, S80],
    summary2: `Software Development Engineer with <strong>3+ years at Amazon</strong> Travel, owning <strong>4 microservices</strong> in <strong>Java 17 / Spring Boot</strong>. Distributed-systems work spans JVM concurrency (<span class="tt">CompletableFuture</span>, bounded <span class="tt">ExecutorService</span>), idempotent flows on <strong>SQS + Step Functions</strong> (<span class="metric">43 bps CPT</span>), and typed <strong>AWS CDK (Java)</strong>. Hotel landing p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion up <span class="metric">+33%</span>, line coverage held at <span class="metric">80%+</span>.`,
    summary1: `Software Development Engineer, <strong>3+ years at Amazon</strong> Travel. Owned <strong>4 microservices</strong> in <strong>Java 17 / Spring Boot</strong>: <span class="tt">CompletableFuture</span> fan-out, idempotent <strong>SQS</strong> (<span class="metric">43 bps CPT</span>), and <strong>CDK (Java)</strong>. p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion <span class="metric">+33%</span>, coverage <span class="metric">80%+</span>.`,
    skills2: [
      ["Java &amp; JVM", SK_JAVA],
      ["Distributed Systems", SK_DIST],
      ["AWS", SK_AWS],
      ["Data &amp; Storage", SK_DATA],
      ["Front-end", SK_FE],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Java &amp; JVM", SK_JAVA_S],
      ["Distributed", SK_DIST_S],
      ["AWS", SK_AWS_S],
      ["Data", SK_DATA_S],
      ["Front-end", SK_FE_S],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [OWN_L, CONC_L, EVT_L, IAC_L],
    p2: [TEST_L, OPS_L],
    b1: [OWN_S, CONC_S, EVT_S, IAC_S, TEST_S],
    intern2: [INTERN_GQL, INTERN_OCR, INTERN_DI],
    intern1: INTERN_S_SDE,
    proj2: ["redis", "audio", "ai", "coach"],
    proj1: ["redis", "fabric", "ai", "audio"],
    oss: [2061, 2044, 2052],
  },
  {
    slug: "FDE",
    subtitle: "Software Engineer · Customer-facing systems · Production ownership",
    description: "Resume of Prakhar Shekhar Parthasarthi, software engineer (ex-Amazon SDE). Emphasis on customer-facing ownership, partner integrations, and on-call.",
    stats: [S47, S33, S43, S20],
    summary2: `Software Development Engineer with <strong>3+ years</strong> owning customer-facing Amazon Travel systems — hotel search through order review — including partner integrations, on-call, and written COEs. Funnel churn down <span class="metric">~30 bps</span>, flight schedule-change pain addressed at <span class="metric">43 bps CPT</span>, landing p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion up <span class="metric">+33%</span>, on-call load cut from <span class="metric">20+ to ~5</span> per shift.`,
    summary1: `Software Development Engineer with <strong>3+ years</strong> on customer-facing Amazon Travel systems: partner discounts, on-call, and COEs. Churn down <span class="metric">~30 bps</span>, schedule-change pain at <span class="metric">43 bps CPT</span>, p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion <span class="metric">+33%</span>.`,
    skills2: [
      ["Distributed Systems", SK_DIST],
      ["Java &amp; JVM", SK_JAVA],
      ["AWS", SK_AWS],
      ["Front-end", SK_FE],
      ["Data &amp; Storage", SK_DATA],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Distributed", SK_DIST_S],
      ["Java &amp; JVM", SK_JAVA_S],
      ["AWS", SK_AWS_S],
      ["Front-end", SK_FE_S],
      ["Data", SK_DATA_S],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [OWN_L, EVT_L, OPS_FDE, CONC_L],
    p2: [TEST_L, IAC_L],
    b1: [OWN_S, EVT_S, OPS_S, CUST_S, CONC_S],
    intern2: [INTERN_OCR, INTERN_GQL, INTERN_DI],
    intern1: INTERN_S_FTE,
    proj2: ["coach", "ai", "redis", "audio"],
    proj1: ["coach", "ai", "redis", "fabric"],
    oss: [2044, 2061, 2052],
  },
  {
    slug: "SDE AI",
    subtitle: "Software Engineer · Applied AI · AWS Bedrock · Java backends",
    description: "Resume of Prakhar Shekhar Parthasarthi, software engineer (ex-Amazon SDE). Emphasis on shipped Bedrock systems, applied AI projects, and Java backends.",
    stats: [S3PR, S63, SNPM, S47],
    summary2: `Software engineer pairing production Java services with applied AI. At Amazon Travel, owned <strong>4 microservices</strong> — p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion up <span class="metric">+33%</span>, idempotent flight webhook at <span class="metric">43 bps CPT</span>. Shipped Bedrock work since: three merged <strong>Fabric</strong> pull requests (42k stars), a six-stage audio pipeline (<strong>Voxtral + Claude</strong>, 63 tests), and <span class="metric">npm v2.4.1</span>.`,
    summary1: `Software engineer shipping applied AI on top of production Java. Amazon Travel: 4 microservices, p90 <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion <span class="metric">+33%</span>, webhook <span class="metric">43 bps CPT</span>. Bedrock: Fabric auth and streaming fixes, Voxtral + Claude transcription (63 tests), <span class="metric">npm v2.4.1</span>, Warp BYOK proxy.`,
    skills2: [
      ["Applied AI", SK_AI],
      ["Java &amp; JVM", SK_JAVA],
      ["AWS", SK_AWS],
      ["Distributed Systems", SK_DIST],
      ["Front-end", `${SK_FE}, Mermaid, KaTeX`],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Applied AI", SK_AI_S],
      ["Java &amp; JVM", SK_JAVA_S],
      ["AWS", SK_AWS_S],
      ["Distributed", SK_DIST_S],
      ["Front-end", `React, TypeScript, Mermaid, KaTeX, BYOK UI`],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [OWN_L, CONC_L, EVT_L, TEST_L],
    p2: [IAC_L, OPS_L],
    b1: [CONC_S, EVT_S, OWN_S, IAC_S, TEST_S],
    intern2: [INTERN_GQL, INTERN_OCR, INTERN_DI],
    intern1: INTERN_S_SDE,
    proj2: ["audio", "warp", "ai", "redis"],
    proj1: ["audio", "warp", "ai", "redis"],
    oss: [2044, 2052, 2061],
  },
  {
    slug: "MTS",
    subtitle: "Software Engineer · Systems · Correctness · Applied AI infrastructure",
    description: "Resume of Prakhar Shekhar Parthasarthi, software engineer (ex-Amazon SDE). Emphasis on concurrency, correctness, throughput, and AI infrastructure.",
    stats: [S195, S03, S42, S47],
    summary2: `Software engineer focused on correctness under concurrency and measured throughput. At Amazon Travel, owned <strong>4 microservices</strong>: p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion up <span class="metric">+33%</span>, an idempotent SQS webhook at <span class="metric">43 bps CPT</span>, and Java CDK stacks that halved rollbacks. RESP2 Redis in Java 17 reaches GET <span class="metric">195k rps</span> (p50 under <span class="metric">0.3 ms</span>, 42 tests). Fixed a streaming-goroutine deadlock in Fabric <strong>#2061</strong> (Go, 42k stars).`,
    summary1: `Software engineer focused on correctness and throughput. Amazon: p90 cut <span class="metric">47%</span> (<span class="metric">1.1s → 0.59s</span>), conversion <span class="metric">+33%</span>, idempotent SQS at <span class="metric">43 bps CPT</span>. RESP2 Redis: GET <span class="metric">195k rps</span>, p50 &lt; <span class="metric">0.3 ms</span>, 42 tests. Fabric <strong>#2061</strong> fixed a streaming-goroutine deadlock (Go, 42k stars).`,
    skills2: [
      ["Java &amp; JVM", SK_JAVA],
      ["Distributed Systems", SK_DIST],
      ["AWS", SK_AWS],
      ["Data &amp; Storage", SK_DATA],
      ["Applied AI", `Bedrock bearer-token auth, streaming clients, Claude repair, Voxtral ASR — scoped to shipped patches and pipelines`],
      ["Tooling &amp; Process", SK_TOOL],
    ],
    skills1: [
      ["Java &amp; JVM", SK_JAVA_S],
      ["Distributed", SK_DIST_S],
      ["AWS", SK_AWS_S],
      ["Data", SK_DATA_S],
      ["Applied AI", `Bedrock auth, streaming clients, Claude, Voxtral`],
      ["Tooling", SK_TOOL_S],
    ],
    p1: [CONC_L, EVT_L, TEST_L, IAC_L],
    p2: [OWN_L, OPS_L],
    b1: [CONC_S, EVT_S, TEST_S, IAC_S, OWN_S],
    intern2: [INTERN_DI, INTERN_GQL, INTERN_OCR],
    intern1: INTERN_S_SDE,
    proj2: ["redis", "audio", "ai", "warp"],
    proj1: ["redis", "fabric", "audio", "warp"],
    oss: [2061, 2044, 2052],
  },
];

function page1(role) {
  return `    <main class="resume-page" role="main">
${header(role.subtitle)}
${metrics(role.stats)}
${summary("sum-h", role.summary1)}
${skills(role.skills1, "skills-h")}
      <section aria-labelledby="exp-h">
        <h2 id="exp-h" class="sect">Experience</h2>
${roleBlock(TITLE, AMAZON, role.b1)}
${roleBlock(INTERN_TITLE_SHORT, AMAZON_INTERN, [role.intern1])}
      </section>
      <section aria-labelledby="proj-h">
        <h2 id="proj-h" class="sect">Projects</h2>
${projects(role.proj1, "compact")}
      </section>
${edu(false)}
${awards()}
    </main>`;
}

function page2(role) {
  return `    <section class="resume-page" aria-label="Page 1">
${header(role.subtitle)}
${metrics(role.stats)}
${summary("p1-sum", role.summary2)}
${skills(role.skills2, "p1-skills")}
      <section aria-labelledby="p1-exp">
        <h2 id="p1-exp" class="sect">Experience</h2>
${roleBlock(TITLE, AMAZON, role.p1)}
      </section>
      <span class="page-num" aria-hidden="true">1 / 2</span>
    </section>

    <section class="resume-page" aria-label="Page 2">
      <section aria-labelledby="p2-exp">
        <h2 id="p2-exp" class="sect sect--cont">Experience · Amazon SDE (continued)</h2>
        <p class="role-co role-co--cont">Jul 2022 — Sep 2025 · Travel (Hotels &amp; Flights) · Bengaluru</p>
${bullets(role.p2)}
${roleBlock(INTERN_TITLE, AMAZON_INTERN, role.intern2)}
      </section>
      <section aria-labelledby="p2-proj">
        <h2 id="p2-proj" class="sect">Projects</h2>
${projects(role.proj2, "full")}
${oss(role.oss)}
      </section>
${edu(true)}
${awards()}
      <span class="page-num" aria-hidden="true">2 / 2</span>
    </section>`;
}

function styleFor(role, pagesLabel) {
  if (pagesLabel === "1-Pager") {
    return role.style1 ?? style1;
  }
  return role.style2 ?? style2;
}

const MM = 25.4 / 96;
const A4_W = Math.round(210 / MM);
const A4_H = Math.round(297 / MM);

const outputs = [];
let htmlMismatch = 0;

for (const role of ROLES) {
  for (const pagesLabel of ["1-Pager", "2-Pager"]) {
    const out = outputPath(role, pagesLabel);
    const name = basename(out);
    const html = doc({
      description: role.description,
      style: styleFor(role, pagesLabel),
      body: pagesLabel === "1-Pager" ? page1(role) : page2(role),
    });

    if (CHECK_HTML) {
      const onDisk = readFileSync(out, "utf8");
      if (sha256(onDisk) !== sha256(html)) {
        console.error(`MISMATCH  ${name}  (re-run npm run build:roles)`);
        htmlMismatch++;
      } else {
        console.log(`ok      ${name}`);
      }
    } else {
      writeFileSync(out, html);
      console.log(`wrote   ${name}`);
    }
    outputs.push(out);
  }
}

if (CHECK_HTML) {
  process.exit(htmlMismatch ? 1 : 0);
}

const browser = await chromium.launch();
let layoutFail = 0;

for (const htmlPath of outputs) {
  const name = basename(htmlPath);
  const page = await browser.newPage({ viewport: { width: A4_W, height: A4_H } });
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

  const report = await measureResumePages(page);
  const layoutIssues = assertLayoutOk(report, name);
  if (layoutIssues.length) {
    layoutFail++;
    console.log(`FAIL    ${name}`);
    for (const msg of layoutIssues) console.log(`  ${msg}`);
  } else {
    const gaps = report.pages.map((p) => `p${p.page}:${p.gapMm}mm`).join(", ");
    console.log(`ok      ${name}  pages=${report.pageCount}  ${gaps}`);
  }

  const pdfPath = htmlPath.replace(/\.html$/, ".pdf");
  await page.addStyleTag({
    content: `*, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @media print { .deck { gap: 0 !important; padding: 0 !important; background: #fff !important; } .resume-page { box-shadow: none !important; } }`,
  });
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
    scale: 1,
  });
  await page.close();
}

await browser.close();
process.exit(layoutFail ? 1 : 0);

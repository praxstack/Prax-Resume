# CLAUDE.md — Project Rules for AI Agents

> **Purpose:** binding rules for any AI agent (Claude, Cline, Codex, Cursor, etc.) working inside this repo. These exist because the agent has previously made all of these mistakes; encoding them here prevents repeats.
>
> **Mirror:** `AGENTS.md` is identical content for non-Claude tools. Edit both, or symlink one to the other.

---

## 0. Owner & Identity

- **Owner:** Prakhar Shekhar Parthasarthi
- **GitHub:** [github.com/praxstack](https://github.com/praxstack)
- **LinkedIn:** [linkedin.com/in/prakharshekhar](https://www.linkedin.com/in/prakharshekhar)
- **Location (current):** Shahjahanpur, UP · open to relocate
- **Location (prior, used in role contexts):** Bengaluru (Amazon, Jul 2022 – Sep 2025)

---

## 1. PII / Contact rules — NON-NEGOTIABLE

### 1.1 · Email

- **Canonical resume email:** `prakhar.mnnit.2022@gmail.com`
- **This is the ONLY email** that may appear on resumes, cover notes, application forms, or any artifact intended for an external recruiter / hiring manager / company.
- **DO NOT use** any of the following on resumes/cover notes:
  - `prax.sr.sde@gmail.com` *(this address may show up in form contexts because the user is logged in with it — never copy it onto an artifact)*
  - any work email
  - any address auto-detected from environment, form pre-fill, or git config

### 1.2 · Location

- **On resumes:** `Shahjahanpur, UP · open to relocate`
- **On role/experience entries** (where the role was performed): use the city of that role (e.g. Amazon role → `Bengaluru`)
- **Never invent** a location — ask if unsure.

### 1.3 · Phone number

- **Never include** a phone number unless the user explicitly types it into the conversation. Do not pull from git config, environment, or other files.

### 1.4 · LinkedIn / GitHub

- LinkedIn: `linkedin.com/in/prakharshekhar`
- GitHub: `github.com/praxstack`
- These are the only two social profiles that go on the resume.

---

## 2. Honesty rules — also non-negotiable

### 2.1 · Do not invent projects or experience

- If a project, repo, role, metric, or skill is not on disk, in git history, on the user&rsquo;s GitHub, or stated by the user — **do not put it on the resume**.
- This includes &ldquo;in flight&rdquo; / &ldquo;ETA&rdquo; / &ldquo;currently building&rdquo; framing for things that don&rsquo;t exist yet. **Plans go in a separate planning doc, never in the resume.**
- **Verify before claiming.** Use `gh repo list praxstack`, `npm view`, or read the repo before describing a project.

### 2.2 · Real projects on this owner

- `praxstack/redis-server-java` — RESP2-compatible Redis server in Java 17 (bounded thread pool, lock-free `ConcurrentHashMap`, hybrid TTL eviction, 150k+ ops/sec, 42 tests). Real, MIT, on GitHub.
- `praxstack/ai-visual-code-review` — npm-published `ai-visual-code-review@2.4.1`, MIT, JS+TS+VS Code extension. Real.
- `praxstack/markdown-viewer-app` — Vite + Vanilla JS markdown viewer (real-time preview, Mermaid, 10 themes, PDF/HTML export), live at `praxstack.github.io/markdown-viewer-app/`. Real. **(NOTE: `markdown-viewer-pro` is a DEAD repo — 404, deleted. Never link it; use `markdown-viewer-app`.)**
- `praxstack/warp-byok-proxy` — Rust local proxy routing Warp Terminal AI calls to AWS Bedrock (BYOK, SigV4/bearer). Real, AGPL-3.0.
- **Open-source contributions (external repos, verified):** 3 PRs **merged** into `danielmiessler/Fabric` (42k★ Go) — #2044 Bedrock bearer-token auth, #2052 dynamic region fetching, #2061 streaming-deadlock fix. Open/under-review PRs: `bytedance/deer-flow` #3790, `thedotmack/claude-mem` #2710, `refactoringhq/tolaria` #912. Only claim merged PRs as "contributed"; label open ones "under review". NEVER claim a closed-unmerged PR.
- Anything else: ASK before adding to a resume.

### 2.4 · Portfolio link

- Canonical portfolio URL: `https://prax-portfolio-one.vercel.app` (also reachable at `prax-portfolio.vercel.app`). This link MAY appear in the contact/header area of resumes. Source repo: `github.com/praxstack/prax-portfolio`.

### 2.3 · No tagging the artifact

- **Do not put recruiter-facing tags** on the resume (e.g. `Tailored for — UnifyApps`). The resume goes to the recruiter; the recruiter does not need to be told it was tailored. Internal-only tagging belongs in the filename.

---

## 3. File / output rules

### 3.1 · HTML, not PDF, by default

- The user prefers **HTML pages** for sharing, reviewing, and presenting. Generate HTML first; only build PDF when explicitly asked or when the user is about to upload to a form requiring PDF.
- HTML files are standalone (inlined CSS, no external CSS dependencies) so they can be hosted on GitHub Pages without breaking.

### 3.2 · Visual identity

- Resume design system tokens (defined in `css/resume.css` + inlined in standalone HTML files):
  - `--paper-soft: #FAF7F2` page background
  - `--ink: #0B1524`, `--ink-body: #2A3647` text
  - `--accent: #8C2B12` (rust) — reserved for dates, metrics, eyebrows
  - `--serif: "IBM Plex Serif"`, `--sans: "Inter"`, `--mono: "JetBrains Mono"`
- All UnifyApps pack pages (`UNIFYAPPS_*.html`, `Prakhar — UnifyApps FDSE.html`) inherit these tokens. Match them when adding new pages.

### 3.3 · Filenames

- Resume variants: `Prakhar — <Target>.html` (em dash, not hyphen).
- Application packs: `UNIFYAPPS_*.html` (or analogous COMPANY_TOPIC pattern). Index page = `<COMPANY>_INDEX.html`.

---

## 4. Build / dev workflow

- **HTML preview:** `open <file>.html` (macOS).
- **Local server:** `npm run serve` → `python3 -m http.server 5173`.
- **PDF build (only when asked):** `npm run pdf -- "<input>.html" "<output>.pdf"`. Requires Playwright; if missing, run `npm install && npx playwright install chromium`.
- **Audit:** `npm run audit:v2` checks `resumes-v2/*.html` for overflow.

---

## 5. When the user gives feedback

- **Take the correction at face value.** If the user says &ldquo;remove X&rdquo;, remove it; do not justify or hedge.
- **Don&rsquo;t put back content** the user has rejected, even in a different form.
- **Update this file** when the user gives a permanent rule (e.g. an email convention, a do-not-claim project). New rules go in the appropriate numbered section.

---

## 6. Recent corrections — encoded as rules

These came from real user pushback in 2026-05. They are now rules:

- **2026-05-18:** Use `prakhar.mnnit.2022@gmail.com` on all PII-bearing artifacts; never `prax.sr.sde@gmail.com`. *(§1.1)*
- **2026-05-18:** Location is `Shahjahanpur, UP · open to relocate`, not Bengaluru, on the resume header. *(§1.2)*
- **2026-05-18:** Do not put a `Tailored for — <Company>` pill on the resume. *(§2.3)*
- **2026-05-18:** Do not invent projects on the resume. The Java agentic workflow engine is a *plan*, not a shipped project; it lives in `UNIFYAPPS_GENAI_PROJECT_SPEC.html` only, not on the resume. The shipped project is `ai-visual-code-review` (npm v2.4.1). *(§2.1, §2.2)*
- **2026-05-18:** Default output is HTML, not PDF. *(§3.1)*

---

## 7. If you&rsquo;re an agent reading this for the first time

1. Read this file end-to-end.
2. Before generating any resume / cover-note / application content, re-check §1 and §2.
3. If you&rsquo;re about to claim a project, repo, or role you didn&rsquo;t verify in this session — stop and verify, or ask.
4. When the user gives a correction, propose a one-line addition to §6 and ask if it should become a permanent rule.

# Prax-Resume - Understanding (audit 2026-10-02)

Repo: GitHub praxstack/Prax-Resume (PUBLIC, GitHub Pages from main /, https://praxstack.github.io/Prax-Resume/). Local main HEAD c564c27 is **2 commits behind origin/main** (72269f1 = PR #3 "Release v1.2.0"); audit read local HEAD plus `git diff HEAD origin/main` (adds CHANGELOG.md, bumps version to 1.2.0, ignores the Apr-2026 PDF, skips PDF export when layout check fails).

## Purpose
Personal resume of Prakhar Shekhar Parthasarthi: static HTML/CSS, Playwright (headless Chromium) PDF export, plus a UnifyApps FDSE application pack (interview prep markdown/HTML). No runtime app, no server, no persistence.

## Authoritative vs historical docs
- AGENTS.md / CLAUDE.md: authoritative rules (PII, honesty, filenames). Claimed "identical mirror"; `diff` shows identical (same size). Hand-edited duplicates, not symlinked.
- README.md: partly authoritative (KaTeX section, top) and partly STALE (Structure/Design/Export sections describe `index.html`, `resume.pdf`, `scripts/build-pdf.mjs` only).
- RESUME_REASSESSMENT.md: historical (Apr/May 2026 design critique).
- CHANGELOG.md: only on origin/main (1.1.0, 1.2.0).
- UNIFYAPPS_*: application pack, historical/one-off. No SPEC/PLAN/openspec/.specify/docs dirs exist.

## Module map
- Generator (source of truth for 12 role resumes): scripts/build-role-resumes.mjs (649 lines; prose, metrics, HTML, PDF) + templates/katex-{1,2}-pager.css, scripts/katex-layout.mjs (print layout checker), scripts/load-katex-styles.mjs.
- Audits: audit-katex-layout.mjs (Playwright clip/bottom-gap), audit-resume-content.mjs (PII/honesty/keywords, 235 lines), verify-resume.mjs (canonical v3 contract), verify-themes.mjs (resumes-v2, regex over HTML), audit-overflow.mjs (resumes-v2 A4 overflow), verify-single-page-pdf.mjs.
- PDF builders (legacy/per-lineage): build-pdf.mjs, build-resume-pdf.mjs (v3), build-single-page-pdf.mjs, build-all-pdfs.mjs + build-themed-pdfs.mjs (resumes-v2).
- Hand-authored HTML: v3 canonical ("... Resume - v3.html"), Apr-2026 (+standalone), Ex-SDE (anonymised, +standalone), "Resume.html" (single page), css/ + assets/svg/ (used by older non-standalone pages), resumes-v2/ 15 themed A4 designs (HTML+PDF).
- Generated: 12 KaTeX role HTML + PDF in repo root (KaTeX Pro, FTE 2, SDE 2, FDE, SDE AI, MTS; 1- and 2-pager).
- UnifyApps pack: ~20 .md/.html/.xml (cover note, outreach playbook, GenAI spec, 5 project answer banks, cheat sheet, mock-interview prompt).

## Flows
1. Edit bullets in build-role-resumes.mjs -> `npm run build:roles` -> layout gate -> writes HTML+PDF -> `npm run check:roles` compares committed HTML to generator.
2. Legacy: `npm run pdf*` / `pdf:v2` / `pdf:resume` -> Playwright print.
3. `npm test` (scripts/run-tests.sh) runs 5 checks: verify-resume (v3), verify-themes, audit:content, audit:katex-layout, check:roles.

## Data/state
Files only. No DB, keychain, env vars, network (Pages hosting only; HTML pulls Google Fonts / CDN at view time - not audited). Playwright ^1.48 resolved to 1.61.1.

## CI / GitHub
- `.github/workflows` does NOT exist (also not on origin/main). Only runs are GitHub-managed "pages build and deployment" (latest listed 2026-05-18 success; two cancelled). README ("(CI)") and CHANGELOG ("CI via npm test") claim CI that does not exist.
- Issues open: 0. PRs: #1,#2,#3 all merged (Sep 22 - Oct 2 2026) from branches prax/katex-*-dbce. Only remote branch: main. Release v1.2.0 (Latest).
- Cadence: ~38 commits Apr 29 - Jun 29 2026 (single author "Prax Lannister"), then PR bursts Sep 22-Oct 2.

## Verification run (local HEAD)
`npm test` -> rc=1. verify-resume PASS, verify-themes PASS, audit:content PASS (all 12), check:roles PASS (12/12 ok). audit:katex-layout FAILED: Playwright 1.61.1 wants chromium_headless_shell-1228 but ~/Library/Caches/ms-playwright only has 1234/1243 (environment, `npx playwright install` needed; not run to avoid a download). Log: npm-test.log in this dir. So layout gate unverified here.

## Prepass scanners
gitleaks (history + tree) [] ; trufflehog history 0 findings; osv no results; semgrep 0 results (only HTML parse warnings); trivy ran clean. No secrets.

## PII exposure (public repo)
The audit reviewed contact details and other personal data in tracked files. The detailed findings are kept privately by the owner.

## Roadmap vs reality (spot-checks, 10+)
1. README "Twelve KaTeX Pro resumes": 12 HTML + 12 PDF present - TRUE.
2. check:roles snapshot of all 12 - TRUE (ran, ok).
3. "all 16 PDFs (v3 + 15 themes)" (commit b8d4baa/035f1d9): 15 resumes-v2 PDFs + v3 PDF present - TRUE.
4. "npm test covers all 10 themes" (c2a51ea): now 15 files, verify-themes globs dir -> covers 15 - TRUE (superseded).
5. md-viewer-pro dead-link purge (48461e9): still present in Apr-2026 html (+standalone) and playbook; those variants are exempt from tests - PARTIAL.
6. Location Bengaluru->Shahjahanpur "8 themes": roles still carry Bengaluru per rule 1.2 - consistent.
7. README structure (index.html, css/, resume.pdf): index.html absent, README stale - FALSE.
8. README Design says IBM Plex Sans body; AGENTS.md 3.2 says Inter/JetBrains Mono - internal doc disagreement.
9. CHANGELOG "CI via npm test": no workflow - FALSE.
10. Ex-SDE html is "anonymised" (package.json): Ex-SDE files still contain canonical email? run-tests.sh says it omits it by design - not verified here.
11. package.json `pdf` script outputs "Apr 2026.pdf" which origin/main now gitignores and local HEAD does not track - consistent only on origin.
12. UNIFYAPPS_PROJECT_INSP_ONE_CLICK_RENEWAL.md vs ..._RENEWALS.md: near-duplicate pair (diff 2611 lines) - docs clutter.

## Risk areas
- No CI: gates (content, layout, snapshot) run only manually; a Playwright version bump silently breaks `npm test` (happened here).
- Generated artifacts committed (PDFs ~32 MB pack); HTML/PDF drift possible: check:roles verifies HTML only, not that PDFs match.
- Regex-based honesty/PII checks only apply to canonical v3, themes and role pack; ~15 other tracked files (Apr-2026, Ex-SDE, Resume.html, UnifyApps pack) are untested.
- Content-exposure review of the interview-prep material: details are kept privately by the owner.

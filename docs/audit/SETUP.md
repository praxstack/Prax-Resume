# Prax-Resume setup (macOS, verified 2026-10-04)

Static HTML/CSS resumes + PDFs. Node scripts (Playwright) build PDFs and run audits. No app server, no env vars, no secrets.

## Install
    cd Prax-Resume
    npm install                      # only dep: playwright ^1.48 (lock resolves 1.60.x, wants chromium_headless_shell-1228)
    npx playwright install chromium  # REQUIRED once; ~94 MiB to ~/Library/Caches/ms-playwright

## Test (full suite)
    npm test        # bash scripts/run-tests.sh; ~1-2 min
Result after browser install: ALL PASS (v3 canonical contract; 15 resumes-v2 themes; 12/12 KaTeX content audits; 12/12 print-layout audits, 1-pagers=1 page, 2-pagers=2; generator snapshot ok). Logs: npm-test2.log.
Known failure without the browser step: `audit-katex-layout` throws "browserType.launch: Executable doesn't exist ... chromium_headless_shell-1228" (first run, npm-test.log). Fix = `npx playwright install chromium`.
No separate lint/typecheck exists. npm test does not modify tracked files (git status clean after runs).

## Build artifacts (these overwrite tracked HTML/PDF; run only intentionally)
    npm run build:roles   # regenerate 12 KaTeX role HTML+PDF from scripts/build-role-resumes.mjs
    npm run check:roles   # non-writing snapshot check
    npm run pdf:resume    # v3 PDF;  npm run pdf:single / pdf:v2 / pdf:all for others

## Run / view
    npm run serve         # python3 -m http.server 5173 (binds ALL interfaces by default)
    # safer: python3 -m http.server 5173 --bind 127.0.0.1
    open "http://127.0.0.1:5173/Prakhar%20Shekhar%20Parthasarthi%20Resume%20-%20v3.html"
Smoke (127.0.0.1): v3.html 200 (title "Prakhar Shekhar Parthasarthi — Full-Stack Software Engineer"), v3.pdf 200, UNIFYAPPS_INDEX.html 200, resumes-v2 theme 200, css/resume.css 200. `/index.html` is 404 (README structure section is stale: no index.html, no scripts/build-pdf.mjs "only"). Server stopped afterwards.

## Env vars: none.  Xcode: not applicable.

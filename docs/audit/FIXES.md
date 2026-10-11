# Prax-Resume fixes (branch fix/audit-2026-10, in a separate fix worktree)

Scope: kept findings with final severity P0/P1. No P0 exists; P1 = RES-020, RES-021. Nothing pushed.

## RES-020 — fixed — 36502cf
- Verified with gh: deer-flow #3790 MERGED; claude-mem #2710 and tolaria #912 CLOSED unmerged.
- Removed the two closed PRs; deer-flow now listed as "Also merged" in the generator (scripts/build-role-resumes.mjs), v3.html, AGENTS.md and CLAUDE.md. Rebuilt the 12 role HTML+PDF and the v3 PDF.
- scripts/audit-resume-content.mjs now fails if claude-mem/tolaria appear, or deer-flow is called "under review" (static, no network).
- Test evidence: new audit gave 6/12 FAIL on old HTML, 12/12 pass after rebuild; full `npm test` ALL PASS.
- Remains: nothing.

## RES-021 — fixed — 9354c3b
- Cause: page 2 of Riso, Halftone, Swiss, Vinyl, Playbill and Keynote overflowed the fixed A4 page (measured 39, 24, 9.6, 16.6, 15.8, 35.5 mm) under overflow:hidden. The Fabric "Open Source" card had been added as an orphan third item in two-column grids.
- Fix: per-theme CSS block (3-column project grid plus tighter spacing) in the six themes; content unchanged. Only those six theme PDFs regenerated (2 pages each, verified with pdfinfo/pdftotext).
- Added scripts/audit-themes-layout.mjs (A4 viewport, print media; fails on any clip, a page count other than 2, or a theme count other than 15) and wired it into scripts/run-tests.sh.
- Test evidence: gate reported 6 FAIL on the old themes, 15/15 ok after; full `npm test` ALL PASS.
- Remains: RES-022 (replacing the older audit:v2 script) and RES-023 (job titles/dates in themes) are P2 and not touched. Visual check was by screenshot of page 2 for each changed theme.

## Open decisions
None required for P0/P1. Note for the owner: package-lock.json was reverted after `npm install` modified it (not committed). Main checkout untouched; worktree was based on origin/main (72269f1-equivalent v1.2.0).

## Correction after review (2026-10-08, ship step)
- The RES-021 gate originally checked only the bottom edge, so "fails on any clip" was overstated: Swiss Flag Poster page 1 was still clipped on the right (review M1). Fixed in b37eebf: the contact strip now wraps, that PDF was regenerated, and the gate also checks left/right text clipping.
- The RES-021 CSS is unscoped and also changes page-1 spacing slightly (review n3).
- 36502cf (now 192cfc2 after the rebase) regenerated all role PDFs, including 1-pagers whose HTML did not change (review n4).

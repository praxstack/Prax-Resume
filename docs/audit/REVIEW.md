# Prax-Resume review: fix/audit-2026-10

- **Reviewer:** independent Opus review, 2026-10-08
- **Worktree:** separate fix worktree (left unmodified)
- **Base:** merge-base with origin/main = 72269f1 (origin/main is still 72269f1, so there is no drift)
- **Commits:** 36502cf (RES-020) and 9354c3b (RES-021)

## Verdict: approve-with-nits

Both commits fix the root cause of the finding they cite. Each new gate fails on the base content and passes on the head. The full `npm test` passes on the head. Every PDF the branch committed matches a fresh render of the branch HTML.

There is one major issue, and the branch did not cause it. The Swiss Flag Poster PDF is one of the six "fixed" themes, and it still clips content: on page 1 the contact/location line runs off the right edge. The new gate only checks the bottom edge, so FIXES.md overstates it as failing "on any clip". This should be fixed as a follow-up, or before merge if the Swiss PDF is published.

| Commit | Finding | Correctness | Test/gate | Scope/honesty | Verdict |
|---|---|---|---|---|---|
| 36502cf | RES-020 | Correct. I checked all PR states with gh (below). claude-mem and tolaria are removed everywhere, and deer-flow is relabelled "Also merged" in the generator, the 6 role 2-pagers, v3, AGENTS.md and CLAUDE.md. | Real: it fails 6/12 on the base HTML and passes 12/12 on the head. It does not cover v3 (m1). | It is a static denylist rather than a check of PR state, and the code comment says so. The rebuilt 1-pager PDFs and the PDF size growth are not disclosed (n4). | approve-with-nits |
| 9354c3b | RES-021 | Correct for page-2 bottom clipping. All six themes now end with their footer visible, and I checked this visually. The HTML diff is CSS only, so the content is unchanged. | Real for vertical clipping: 6 FAIL on the base with the same mm figures as FIXES.md, and 15/15 ok on the head. It is blind to horizontal and nested clipping (M1, m2). | The CSS is unscoped and also changes page 1 (n3). "Fails on any clip" is overstated (M1). | approve-with-nits |

## PR states (gh, verified 2026-10-08)

| PR | State | Merged at / by | Resume claim after branch |
|---|---|---|---|
| bytedance/deer-flow#3790 | MERGED | 2026-07-05, by a maintainer, into main | "Also merged" (correct) |
| thedotmack/claude-mem#2710 | CLOSED (unmerged) | none | removed (correct) |
| refactoringhq/tolaria#912 | CLOSED (unmerged) | none | removed (correct) |
| danielmiessler/Fabric#2044, #2052, #2061 | MERGED | 2026-03-06, 03-09 and 03-18 | "merged" (correct) |

The repo owner's account authored all six PRs. A search of every tracked text file and every committed PDF on the head finds claude-mem, tolaria and "under review" only in the audit script and AGENTS.md/CLAUDE.md. deer-flow appears once in each 2-pager PDF and once in v3.pdf.

## Theme PDFs (the six named in RES-021)

- **Page count and size:** all 15 theme PDFs have 2 pages and use an A4 page size (594.96 x 841.92 pt), checked with pdfinfo.
- **Freshness:** I re-rendered every theme, every role HTML file and v3 from the branch HTML into a scratch directory using A4 print media. The text in all 13 PDFs the branch committed matches the fresh render, ignoring whitespace. The 6 role 1-pagers, 6 role 2-pagers and the v3 PDF are therefore in sync.
- **Visual check (rasterised at 50 and 110 dpi):**
  - **Page 2 of all six themes:** the Education and Recognition blocks and the closing footer are now fully visible.
  - **On the base:**
    - Riso's page 2 ended under an empty "Schooling" heading.
    - Halftone, Vinyl and Playbill lost their Education/Awards blocks and colophons.
    - Keynote lost the Education block and the contact footer.
    - Swiss lost its colophon.
  - **The new 3-column project grids:** these render cleanly with no text cut inside the cards.
- **Bottom margin on page 2 (DOM probe):**

  | Theme | Base | Head |
  |---|---|---|
  | Riso | -39.2 mm | 5.1 mm |
  | Halftone | -23.8 mm | 15.6 mm |
  | Swiss | -9.6 mm | 8.0 mm |
  | Vinyl | -16.6 mm | 9.0 mm |
  | Playbill | -15.8 mm | 4.0 mm |
  | Keynote | -35.5 mm | 0.0 mm |

  Keynote's footer is designed to sit flush with the page bottom.
- **Still clipped:** Swiss Flag Poster page 1 (M1).

## Findings

### Major

**M1. Swiss Flag Poster page 1 clips the contact/location line on the right, and the gate cannot see it.**
- **Where:** `resumes-v2/Resume 08 — Swiss Flag Poster.html` (the contact strip under the name block) and `scripts/audit-themes-layout.mjs:30-38`.
- **Evidence:**
  - A DOM probe at an A4 viewport with print media finds leaf spans in that strip ending 48 to 83 mm past the right edge of the page. `.resume-page` has `overflow:hidden`.
  - In the committed PDF on the branch, the strip is cut off mid-word at the right edge, and the location text after the last separator is missing.
  - This is identical on the base, so it is not a regression.
  - `measureClip` only compares `r.bottom` with `pr.bottom`, so the gate passes Swiss as "ok".
  - FIXES.md says the gate "fails on any clip", and the commit's own header says it fails "when any in-flow element's bottom edge lies below its page box". FIXES.md overstates this.
- **Fix:**
  - Add a horizontal check to `measureClip`: for leaf elements with text, flag `r.right - pr.right` (and `pr.left - r.left`) above the tolerance.
  - Let the Swiss contact strip wrap (`flex-wrap:wrap` or a smaller font size), then regenerate that PDF.
  - Correct the claim in FIXES.md.

### Minor

**m1. The canonical v3 resume is not protected against the closed PRs coming back.**
- **Where:** `scripts/audit-resume-content.mjs:16-21` (the default glob only matches the 12 role files) and `scripts/verify-resume.mjs` (it has no PR check).
- **Evidence:** I put a claude-mem#2710 "Under review" link into a scratch copy of v3. `node scripts/verify-resume.mjs <copy>` still reported 18 passed and 0 failed.
- **Fix:** add the same closed-PR denylist to `verify-resume.mjs`, or run the PR-state block of `audit-resume-content` on v3 as well.

**m2. The theme gate measures the live DOM, not the committed PDFs, and it skips some clipping cases.**
- **Where:** `scripts/audit-themes-layout.mjs:30-33` and `:64-68`.
- **Evidence:**
  - The page count it reports is the number of `.resume-page` elements, not the number of PDF pages.
  - Nothing fails if a committed PDF is stale relative to its HTML. On this branch I checked freshness manually and the PDFs are fresh.
  - Absolutely positioned elements and clipping inside nested `overflow:hidden` containers are skipped. For example, Boarding Pass `.pass-top` on page 2 overflows by 154 px vertically inside its own clip. I found no hidden text leaves there, so it is benign today.
- **Fix:** optionally add a PDF check (pdfinfo page count plus a text-equality check against a fresh render), and check nested clip containers for hidden text leaves.

### Nits

- **n1.** `scripts/audit-resume-content.mjs:220` still fails on "contributed to deer-flow". #3790 is merged, so under AGENTS.md ("Only claim merged PRs as contributed") that sentence is now true. Drop deer-flow from that regex.
- **n2.** The "Also merged" paragraph keeps the `oss-open` / `oss__intro--open` class names, which still say "open" (`scripts/build-role-resumes.mjs:279` and v3.html:464). Separately, and not caused by this branch, the v3 "75k★" figure for deer-flow is stale: the repo now has about 83.5k stars.
- **n3.** The RES-021 CSS blocks use `@media print, screen` with unscoped selectors such as `.frame`, `.sheet` and `.cards`. They therefore also change page 1: Riso's page-1 bottom gap went from 13.8 mm to 7.8 mm, and Playbill's went from -0.2 mm to 1.8 mm. FIXES.md says "tighten page 2". Page 1 still looks correct in all six themes.
- **n4.** Commit 36502cf regenerated all 12 role PDFs, including the six 1-pagers whose HTML did not change. The role PDFs grew by about 45-60% (for example 284 KB to 419 KB). Some base PDFs (for example the MTS 1-Pager) already differed in text from a fresh render of the base HTML, so the rebuild also brings in that earlier drift. The result is correct because it is in sync, but FIXES.md does not mention it.
- **n5.** The commit subject says "audit PR states", but the gate is a hardcoded list of names and will not notice future state changes. The code comment is honest about this.

### Security and data safety

No secrets are introduced. No new personal data appears beyond what the resumes already published: the edits only remove links and add CSS. No network calls are made in the gates.

## Check results (SETUP.md: `npm test`; there is no separate lint or typecheck)

**Environment note:** the Playwright `chromium_headless_shell-1228` cache is now empty on this machine. Without it, both layout gates exit with the launch error described in SETUP.md. That happened on the first head run: RC4=1 and RC6=1, while all non-browser gates passed. To avoid downloading the browser, I ran both trees with a scratch `--import` shim that forces `channel:"chrome"` (system Chrome 154). No repo files were changed.

| Gate | Base 72269f1 | Head 9354c3b |
|---|---|---|
| verify-resume (v3) | PASS | PASS (18/0) |
| verify-themes | 15/15 | 15/15 |
| audit-resume-content | 12/12 | 12/12 |
| audit-katex-layout | 12/12 | 12/12 (1-pagers have 1 page, 2-pagers have 2) |
| check:roles snapshot | ok | ok |
| audit-themes-layout (new) | not present | 15/15 ok |
| **npm test overall** | **ALL PASS** | **ALL PASS** |

I also ran the head's new gates against the base content:

- **audit-resume-content:** FAIL on all six 2-pagers, with both the closed-PR message and the deer-flow "under review" message.
- **audit-themes-layout:** 6 FAIL: Riso +39.2 mm, Halftone +23.8, Swiss +9.6, Vinyl +16.6, Playbill +15.8, and Keynote, which also failed (its +35.5 mm line was hidden by my output filter). The other 9 were ok.

`git status` in the worktree stayed clean after all runs. The throwaway base worktree was created in the session scratchpad and has been removed.

## FIXES.md claims I could not confirm, or found false

- **False or overstated:** the gate "fails on any clip". It only catches bottom-edge overflow, and Swiss page 1 is still clipped horizontally (M1).
- **Overstated:** "per-theme CSS block … tighten page 2". The rules are global and also change page 1 (n3).
- **Not reproduced in the same environment:** the "full `npm test` ALL PASS" result was obtained with the Playwright headless shell, which is no longer installed. I reproduced ALL PASS with system Chrome 154 instead.
- **Confirmed:**
  - The gh PR states.
  - The 6/12 → 12/12 content-gate result.
  - 6 FAIL → 15/15 on the theme gate, with the same mm figures.
  - The six theme PDFs have 2 pages each.
  - The content is unchanged (the HTML diff is CSS only).
  - package-lock.json is not committed. It is clean and resolves Playwright 1.61.1.

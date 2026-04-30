# Resume Reassessment — Prax-Resume

**Date:** Apr 2026  
**Subject files:** `Prakhar Shekhar Parthasarthi Resume Apr 2026.{html,pdf}`, `Ex-SDE Resume.{html,pdf}`  
**Review lenses:** ATS parseability · Recruiter 6-second scan · Content strength · Visual design (via `ui-ux-pro-max` skill)

---

## TL;DR — Verdict

| Lens | v1 Score | v2 Target | Critical? |
|---|:-:|:-:|:-:|
| **ATS parseability** | 8 / 10 | 9 / 10 | ✓ |
| **Recruiter 6-sec scan** | 6 / 10 | 9 / 10 | ✓✓ |
| **Content & impact claims** | 9 / 10 | 9.5 / 10 |  |
| **Visual design polish** | 7 / 10 | 9 / 10 | ✓ |
| **Print typography density** | 7 / 10 | 9 / 10 | ✓ |

**Biggest single win available:** the 6-second recruiter scan. Your metrics are excellent but visually buried inside prose — a scanning recruiter misses them. The v2 CSS elevates metrics, dates, and role progression into the primary visual hierarchy without touching content.

---

## Lens 1 · ATS parseability (8/10 → 9/10)

**What's already right**
- Single-column layout, semantic HTML (`<article>`, `<section>`, `<dl>`, `<h1–h3>`)
- No columns, tables for layout, or images
- Real text, no icons-as-text / SVG-as-text tricks
- `aria-labelledby` wiring is correct

**Minor issues**
1. Job title `role__title` is an `<h3>` and job company is a `<p>` sibling — some older ATS parsers want company name closer in the DOM. → **Fix:** keep as-is (the common semantic pattern is well-supported), but verify the rendered visual order puts **title → company → dates** in normal reading order.
2. HTML entities (`&mdash;`, `&rarr;`, `&plus;`) get parsed correctly by modern ATS (Greenhouse, Lever, Workday), but some tail-end systems choke on unicode arrows. → **Fix (v2):** replace `&rarr;` (→) and `&tilde;` (~) in visible text with plain "to" / "~". Keep em-dashes.
3. The `<code>` tags wrapping JVM primitives (`CompletableFuture`, etc.) render fine in text extraction but add slight noise. → **Keep** — tradeoff is worth it for the technical-depth signal.

---

## Lens 2 · Recruiter 6-sec scan (6/10 → 9/10) ← BIGGEST WIN

A recruiter in 6 seconds looks for four things: **company names, dates, job titles, headline metrics**. On v1, only dates (rust color) and company name (rust color) pop — both use the same rust, which flattens the hierarchy.

**Issues**
1. **Rust-colored company name competes with rust-colored dates.** Eye can't anchor. Both signal "I'm important" simultaneously.
2. **Metrics hide inside body prose.** "47% p90 reduction", "33% conversion lift" are the strongest signals in the document and should be the most visible. Currently just bolded.
3. **Section dividers use a gradient band** — visually busy; recruiter reads it as decorative, skips past instead of using it as a waypoint.
4. **Section titles are 9pt uppercase** — technically readable but lose to the 25pt name and 10.6pt role titles. No clean "table of contents" feel.

**v2 fixes (implemented)**
- **Demote company color** from rust to ink — keep rust for dates only (scanning eye now follows job timeline down the page).
- **Promote metrics** to small accent-soft background badges (`.metric` gets a subtle tint + weight). Still prose-embedded but visually isolated.
- **Section titles**: replace gradient band with a clean uppercase eyebrow (JetBrains Mono, 8pt, tracking-widest, rust) above a hairline rule that runs the full content width. Reads as a newspaper section header.
- **Role title + dates** use the same baseline — the dates in monospace right-align to form a visible "career ladder" down the page.

---

## Lens 3 · Content & impact claims (9/10 → 9.5/10)

**Strengths**
- Strong quantified outcomes (47%, 33%, 43 bps CPT, 20→5 tickets, 150k rps, etc.)
- Technical depth with primitives named (`CompletableFuture.allOf()`, `ConcurrentHashMap`, `@SpringBootTest`) — signals JVM fluency
- Specific infra migrations with comparative impact ("halved rollback incidents")
- Two projects with distinct framings: systems deep-dive (Redis) + product-polish demo (Markdown editor)

**Minor tuning suggestions (not implemented — require your judgment)**
1. Summary's "20+ → ~5 per shift" appears in both Summary and Operational Excellence bullet. **Recommendation:** keep only in the bullet; swap the summary slot for a different differentiator (e.g., "authored all service IaC in typed Java CDK").
2. Core Technical Stack "Other Languages: Python, C++, VTL" — **VTL** is AWS-specific and near-invisible to non-Amazon recruiters. Consider demoting to "Infra: AWS CDK (Java), VTL mapping templates".
3. Intern section: two dates `May 2021 – Jul 2021 · Feb 2022 – Jul 2022` reads as two separate internships stacked. A recruiter may miss that these are two distinct stints. **Consider** splitting into two sub-bullets with individual date ranges for clarity (optional — the current compression is also a valid stylistic choice).
4. Award "Amazon Pay Merchants Categories Champion" appears under Travel role context — may confuse (Amazon Pay ≠ Travel). Clarify or reframe.

---

## Lens 4 · Visual design (via ui-ux-pro-max) — 7/10 → 9/10

`ui-ux-pro-max --design-system` recommended **Classic Elegant** pairing: serif display + sans body + mono for data (exactly your current IBM Plex Serif + Inter + JetBrains Mono). The font stack is already best-in-class for engineering resumes. What needed upgrade was the **composition rules around it**.

### Specific findings

| Rule (UI Pro Max) | v1 Status | v2 Fix |
|---|---|---|
| `visual-hierarchy` — hierarchy via size, spacing, contrast, not color alone | ❌ Rust used for both dates AND company — competes | ✓ Rust reserved for dates + metrics only |
| `whitespace-balance` — intentional grouping | ⚠ Section title gradient band adds visual noise | ✓ Replaced with clean eyebrow + hairline rule |
| `weight-hierarchy` — weights reinforce hierarchy | ✓ Already good (600 headings, 400 body) | — |
| `color-semantic` — semantic tokens, no raw hex | ✓ CSS vars in place | ✓ Expanded token set (accent-soft, rule-hair) |
| `number-tabular` — tabular figures for data | ✓ Already applied | ✓ Extended to all dates + metrics |
| `spacing-scale` — 4pt rhythm | ⚠ Mixed (3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 16) | ✓ Normalized to 4/8/12/16/24 rhythm |
| `primary-action` — one anchor per view | N/A resume, but *primary eye anchor* = name. v1 has rust tab under name that competes | ✓ Cleaner, name is the clear anchor |
| `style-match` — style fits product type | ✓ Editorial serif is right for SDE resume | ✓ Doubled down — more editorial, less card-y |
| `icon-style-consistent` | ⚠ Diamond bullet rotated 45° is unusual; chips pill-shaped | ✓ Retained diamond (signature), normalized chips |
| `consistency` — same style everywhere | ⚠ Project cards use tinted bg + thick left border — card-y; rest of resume is flat editorial | ✓ Project cards flattened to match — hairline top rule + generous whitespace |

### Anti-patterns removed
- ❌ Gradient band on section titles (reads as "template")
- ❌ Doubled rust accent (both company + dates)
- ❌ Tinted project card background clashing with paper color
- ❌ Mixed non-grid spacing (3px, 5px, 7px etc)

### Retained signatures
- ✓ IBM Plex Serif display → Inter body → JetBrains Mono labels
- ✓ Rust-on-ink-on-paper palette
- ✓ Rotated-diamond accent bullets (actually distinctive; keep)
- ✓ Tabular-nums for all numeric data

---

## Lens 5 · Print typography density (7/10 → 9/10)

**v1 issues**
- 8.6pt body text in print is borderline. Modern ATS scanners and humans both prefer 9–10pt minimum.
- Masthead consumed ~17% of page 1 in print — oversized.
- `.role--intern` forced to page 2 via `break-before: page` wasted most of page 1's lower half.

**v2 fixes**
- Body bumped to 9pt print (was 8.6pt).
- Masthead tightened — name 18pt (was 20pt), tighter leading, compressed contact line.
- Removed `break-before: page` on intern role — now flows naturally. Page 1 fills properly; intern naturally reaches page 2 in the signed variant; Ex-SDE variant targets **single A4 page**.
- Increased `print.css` control over section margins to balance pages.

---

## Changes delivered in v2

### `css/resume.css` (rewritten)
- Expanded color tokens: `--paper`, `--ink`, `--ink-body`, `--ink-mute`, `--rule-hair`, `--accent`, `--accent-soft`, `--mono-label`.
- Normalized spacing to 4/8/12/16/24/32 scale.
- Section title → JetBrains Mono eyebrow + hairline rule (no gradient).
- Role company → ink weight-500 (demoted from rust).
- Role dates → Mono tracking 0.08em (cleaner).
- `.metric` → subtle accent-soft background pill with tabular-nums.
- Projects → flat, hairline-top, generous padding (no tinted bg).
- Masthead → cleaner ink rule with short accent segment at left origin.

### `css/print.css` (rewritten)
- Body 9pt (up from 8.6pt).
- Removed forced page break on `.role--intern`.
- Tighter masthead.
- Adjusted section + role margins so both variants paginate cleanly.

### HTML — no structural changes required
All class names preserved. Semantic markup unchanged. Only a handful of entity swaps: `&rarr;` → `to`, `&tilde;` → `~` in visible prose (ATS-safer).

---

## Not changed (by design)

- Content, metrics, role bullets — unchanged.
- Font families — unchanged (they were already optimal).
- Core IA: summary → stack → experience → projects → education → awards.
- Two-variant setup: signed + anonymized.

---

## Build

```sh
npm run pdf        # signed variant
npm run pdf:anon   # Ex-SDE variant
npm run pdf:all    # both
```

Both PDFs regenerated with v2 styling. Visual diff: same identity, more editorial authority, scannable hierarchy.

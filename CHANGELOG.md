# Changelog

## 1.2.0 — 2026-10-02

### KaTeX Pro role pack

- Twelve KaTeX B&amp;W A4 résumés (KaTeX Pro + FTE 2, SDE 2, FDE, SDE AI, MTS — 1- and 2-pager), HTML + PDF.
- Single generator: `scripts/build-role-resumes.mjs` with CSS templates in `templates/`.
- CI via `npm test`: content audit, print layout audit, generator HTML snapshot (`check:roles`).

### Fixes

- Skip PDF export when print layout check fails (avoids stale/wrong PDF on clip).
- `--check-html` reports missing artifacts instead of throwing.
- Ignore local `Prakhar Shekhar Parthasarthi Resume Apr 2026.pdf` export in git.

## 1.1.0

- Canonical v3 resume, resumes-v2 themes, PDF tooling.

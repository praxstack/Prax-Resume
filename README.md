# Prax Resume

Personal resume of **Prakhar Shekhar Parthasarthi** — Software Engineer (Java / JVM / Distributed Systems).

Static HTML + CSS. Headless Chromium exports PDFs for upload-ready artifacts.

## KaTeX Pro + role variants

Twelve **KaTeX Pro B&amp;W A4** résumés live in the repo root (`Prakhar — KaTeX Pro …`, `Prakhar — FTE 2 …`, etc.). **HTML and PDF are build artifacts** — prose and metrics come from `scripts/build-role-resumes.mjs` (single source of truth). CSS templates sit in `templates/katex-1-pager.css` and `templates/katex-2-pager.css`.

Regenerate HTML + PDF after editing bullets:

```sh
npm install
npx playwright install chromium   # first time only
npm run build:roles               # writes all 12 HTML + 12 PDF, layout-gated
npm run check:roles               # fail if committed HTML ≠ generator (CI)
npm run audit:content             # PII, honesty, role keywords
npm run audit:katex-layout        # clip + minimum bottom gap (no sparse fail)
```

`npm test` runs the canonical v3 contract, theme checks, and all KaTeX audits above.

## Structure

```
Prax-Resume/
├── index.html            # Semantic markup only
├── css/
│   ├── reset.css         # Minimal reset + base typography
│   ├── resume.css        # Screen styles (editorial / engineering)
│   └── print.css         # @page + print refinements (A4)
├── scripts/
│   └── build-pdf.mjs     # Headless Chromium → resume.pdf
├── package.json
└── README.md
```

## Design

- **Type**: IBM Plex Serif (display) + IBM Plex Sans (body) + IBM Plex Mono (code)
- **Accent**: rust `#8C2B12` on ink `#0B1524`, paper `#FDFBF5`
- **Single-column** layout — ATS-parser-safe, no multi-column grids
- **Print-ready**: tuned for A4, single-page target

## Local preview

Open `index.html` directly, or serve:

```sh
python3 -m http.server 5173
# → http://localhost:5173
```

## Export to PDF

One-command headless build (recommended):

```sh
npm install
npx playwright install chromium   # first time only
npm run pdf                       # → resume.pdf
```

Or from the browser:

1. Open `index.html`
2. ⌘P / Ctrl-P
3. Destination → **Save as PDF**
4. Paper size → **A4**
5. Margins → **Default** (print.css defines `@page` margins)
6. Background graphics → **On** (preserves accent colour)

## License

Personal — all rights reserved.

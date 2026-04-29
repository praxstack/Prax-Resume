# Prax Resume

Personal resume of **Prakhar Shekhar Parthasarthi** — Software Engineer (Java / JVM / Distributed Systems).

Static HTML + CSS. No build step.

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

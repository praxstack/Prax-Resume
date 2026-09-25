import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readCss(name) {
  const path = resolve(root, "templates", name);
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(
      `Missing KaTeX CSS template ${path}. Restore templates/katex-1-pager.css and katex-2-pager.css. (${e.message})`
    );
  }
}

const ROLE_1_OVERRIDES = `
    /* Role 1-pagers: use slack without crowding the edge. */
    body { font-size: 9.05pt; }
    .summary { font-size: 8.7pt; }
    .bullets li { margin-bottom: 3.4pt; }
    .sect { margin: 7pt 0 3.5pt; }
    .skills { gap: 2.6pt 8pt; }
    .metrics { margin: 7pt 0 8pt; }
    .projects { gap: 6pt 8pt; }
`;

const ROLE_2_OVERRIDES = `
    /* Role 2-pagers: fill A4 without clipping. */
    body { font-size: 10.2pt; line-height: 1.46; }
    .name { font-size: 21pt; }
    .subtitle { font-size: 10.4pt; }
    .summary { font-size: 10pt; line-height: 1.5; }
    .bullets li { font-size: 9.4pt; margin-bottom: 5pt; line-height: 1.45; }
    .sect { margin: 10pt 0 6pt; font-size: 8.4pt; }
    .skills { font-size: 9pt; }
    .proj-desc { font-size: 8.5pt; }
    .proj { padding: 8pt 9pt; }
    .projects { gap: 9pt 12pt; }
    .metrics { margin: 10pt 0 10pt; }
    .stat { padding: 8pt 5pt; }
    .stat-num { font-size: 15pt; }
    .role-title { font-size: 11pt; }
    .resume-page:first-of-type .bullets li { margin-bottom: 9pt; line-height: 1.48; }
    .resume-page:first-of-type .skills { gap: 7pt 10pt; font-size: 9.2pt; }
    .resume-page:first-of-type .sect { margin: 13pt 0 8pt; }
    .resume-page:first-of-type .metrics { margin: 12pt 0 13pt; }
    .resume-page:first-of-type .titleblock { margin-bottom: 10pt; padding-bottom: 9pt; }
    .resume-page:first-of-type .role-co { margin-bottom: 7pt; }
`;

export function katexStyleBlock(which, { roleOverrides = true } = {}) {
  const base = readCss(which === 1 ? "katex-1-pager.css" : "katex-2-pager.css");
  const extra = roleOverrides ? (which === 1 ? ROLE_1_OVERRIDES : ROLE_2_OVERRIDES) : "";
  return `<style>\n${base}\n${extra}\n  </style>`;
}

/** KaTeX Pro general 2-pager uses base template typography only (no role stretch overrides). */
export function katexProStyleBlock(which) {
  const base = readCss(which === 1 ? "katex-1-pager.css" : "katex-2-pager.css");
  if (which === 2) {
    return `<style>\n${base}\n${ROLE_2_OVERRIDES}\n  </style>`;
  }
  return `<style>\n${base}\n  </style>`;
}

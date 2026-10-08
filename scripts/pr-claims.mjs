/**
 * pr-claims.mjs — shared open-source PR claim check.
 *
 * Used by audit-resume-content.mjs (KaTeX role pack) and verify-resume.mjs
 * (canonical v3) so both enforce the same rule from AGENTS.md: only merged PRs
 * may be claimed as contributed.
 *
 * Static list, no network: PR states were verified with gh on 2026-10-08.
 *   bytedance/deer-flow#3790      MERGED  -> may be listed / "contributed to"
 *   thedotmack/claude-mem#2710    CLOSED unmerged -> must not appear
 *   refactoringhq/tolaria#912     CLOSED unmerged -> must not appear
 * Re-verify and update this list when a PR changes state.
 */

export function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns a list of violation messages (empty when the claims are honest). */
export function prClaimViolations(html) {
  const text = plainText(html);
  const out = [];
  if (/claude-mem|tolaria/i.test(text) || /claude-mem\/pull\/2710|tolaria\/pull\/912/.test(html)) {
    out.push("closed-unmerged PR (claude-mem #2710 / tolaria #912) must not be listed");
  }
  if (/Under review[^.]*deer-flow/i.test(text)) {
    out.push("deer-flow #3790 is merged, not under review");
  }
  return out;
}

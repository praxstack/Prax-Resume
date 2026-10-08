#!/usr/bin/env node
/**
 * test-pr-claims.mjs — regression test for the shared PR-claim rule.
 *
 * 1. Unit cases for prClaimViolations (closed PRs rejected; the merged
 *    deer-flow PR may be listed or called "contributed to", but not
 *    "under review").
 * 2. The canonical v3 gate (verify-resume.mjs) must pass on the committed v3
 *    and fail on a scratch copy that re-adds a closed PR.
 *
 * Exit 0 = all cases pass. Prints case names only, never resume text.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { prClaimViolations } from "./pr-claims.mjs";

const root = resolve(import.meta.dirname, "..");
const V3 = resolve(root, "Prakhar Shekhar Parthasarthi Resume - v3.html");

let fail = 0;
const check = (cond, name) => {
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}`);
  if (!cond) fail++;
};

const CLOSED_LINK =
  '<p>Under review: <a href="https://github.com/thedotmack/claude-mem/pull/2710">claude-mem</a></p>';
const cases = [
  ["closed claude-mem PR link is rejected", CLOSED_LINK, false],
  ["closed tolaria PR named in text is rejected", "<p>Also: tolaria #912</p>", false],
  ["merged deer-flow called 'under review' is rejected", "<p>Under review: deer-flow #3790</p>", false],
  ["merged deer-flow listed as 'Also merged' is accepted", "<p>Also merged: deer-flow #3790.</p>", true],
  ["'contributed to deer-flow' is accepted (PR is merged)", "<p>Contributed to deer-flow (#3790).</p>", true],
];
for (const [name, html, honest] of cases) {
  check((prClaimViolations(html).length === 0) === honest, name);
}

const verify = (file) =>
  spawnSync(process.execPath, [resolve(root, "scripts/verify-resume.mjs"), file], { encoding: "utf8" });

check(verify(V3).status === 0, "verify-resume passes on the committed canonical v3");

const dir = mkdtempSync(join(tmpdir(), "pr-claims-"));
try {
  const tampered = join(dir, "v3-tampered.html");
  writeFileSync(tampered, readFileSync(V3, "utf8").replace("</main>", `${CLOSED_LINK}</main>`));
  const r = verify(tampered);
  check(r.status === 1 && /FAIL open-source PR claims honest/.test(r.stdout), "verify-resume fails on v3 with a closed PR re-added");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("----");
if (fail) {
  console.error(`${fail} PR-claim case(s) failed`);
  process.exit(1);
}
console.log("ALL PR-claim cases passed");

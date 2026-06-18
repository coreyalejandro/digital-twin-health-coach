import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SAFE_DEFAULT_SYSTEM } from "../src/application/coaching/coachingService.ts";

/**
 * Automated compliance checks for CI (report §2.4 / T1):
 *   1. Secret/PII scan  — no hardcoded API keys, private keys, or SSNs in source.
 *   2. Supply-chain audit — confirm zero third-party runtime dependencies.
 *   3. Prompt-injection / safety lint — the default system prompt must contain
 *      explicit refusal + deference language.
 *
 * Exits non-zero on any failure so the pipeline blocks the build.
 */

const ROOTS = ["src", "app", "redteam", "scripts"];
const failures: string[] = [];

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /sk-[A-Za-z0-9]{20,}/, label: "OpenAI-style secret key" },
  { re: /AIza[0-9A-Za-z_\-]{30,}/, label: "Google API key" },
  { re: /AKIA[0-9A-Z]{16}/, label: "AWS access key id" },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: "private key block" },
  { re: /\b\d{3}-\d{2}-\d{4}\b/, label: "SSN-like number" },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs|json|yml|yaml)$/.test(p)) out.push(p);
  }
  return out;
}

// 1) Secret / PII scan
let scanned = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const content = readFileSync(file, "utf8");
    for (const { re, label } of SECRET_PATTERNS) {
      const m = re.exec(content);
      if (m) failures.push(`secret/PII (${label}) in ${file}: '${m[0].slice(0, 12)}…'`);
    }
  }
}

// 2) Supply-chain audit — zero third-party runtime deps.
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
  const depCount = Object.keys(pkg.dependencies ?? {}).length;
  if (depCount > 0) failures.push(`expected 0 runtime dependencies, found ${depCount}`);
} catch (e) {
  failures.push(`could not read package.json: ${String(e)}`);
}

// 3) Prompt-injection / safety lint on the default system prompt.
for (const phrase of ["never diagnose", "emergenc", "defer"]) {
  if (!SAFE_DEFAULT_SYSTEM.toLowerCase().includes(phrase)) {
    failures.push(`default system prompt missing required safety language: '${phrase}'`);
  }
}

if (failures.length > 0) {
  console.error(`CI compliance checks FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`CI compliance checks passed (scanned ${scanned} files, 0 secrets, 0 third-party deps, safety lint OK).`);

#!/usr/bin/env node
/**
 * verify.mjs — structural checks for the wp-custom-agent-skills repo itself.
 *
 * This system tells agents to produce evidence rather than assertions, so it holds
 * itself to the same rule: these checks are what let a claim like "the plugin is
 * well-formed" be verified instead of believed.
 *
 * Checks:
 *   1. every skill has a SKILL.md with name + description front matter
 *   2. every skill's `name` matches its directory name
 *   3. descriptions are trigger-shaped (long enough to route on)
 *   4. every command has a description
 *   5. every agent has name + description
 *   6. relative markdown/reference links resolve on disk
 *   7. skills referenced by name in routing tables exist locally or upstream
 *   8. bundles/ is in sync with source
 *
 * Usage: node scripts/verify.mjs [--json]
 * Exit:  0 all checks pass · 1 one or more failures
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonOut = process.argv.includes("--json");

const failures = [];
const warnings = [];
const passes = [];

const fail = (check, detail) => failures.push({ check, detail });
const warn = (check, detail) => warnings.push({ check, detail });
const pass = (check, detail) => passes.push({ check, detail });

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const listDirs = (p) => {
  try {
    return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return []; }
};
const listFiles = (p, ext) => {
  try {
    return fs.readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(ext)).map((e) => e.name);
  } catch { return []; }
};

/** Minimal YAML front-matter reader: only the flat `key: value` pairs we use. */
function frontMatter(src) {
  if (!src || !src.startsWith("---")) return null;
  const end = src.indexOf("\n---", 3);
  if (end === -1) return null;
  // Strip CR before parsing. A CRLF checkout (the Windows git default) otherwise makes
  // every value fail to match — JS `.` does not match `\r`, so `(.*)$` never anchors —
  // and the front matter silently reads as empty.
  const block = src.slice(3, end).replace(/\r/g, "");
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// ---------- 1-3. skills ----------
const skillsDir = path.join(ROOT, "skills");

// Upstream skills may be copied into skills/ for local use. They are gitignored, so
// "untracked" identifies them — the same rule build-bundles.mjs uses to decide what is
// ours to redistribute. They follow upstream's conventions, so policing them here would
// only produce noise about someone else's repo.
const trackedSkills = (() => {
  const res = spawnSync("git", ["ls-files", "skills"], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0 || !res.stdout.trim()) return null;
  return new Set(
    res.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split("/")[1]).filter(Boolean)
  );
})();

const allSkillDirs = listDirs(skillsDir);
const skillDirs = trackedSkills ? allSkillDirs.filter((d) => trackedSkills.has(d)) : allSkillDirs;
const vendored = new Set(allSkillDirs.filter((d) => !skillDirs.includes(d)));
const declaredSkillNames = new Set();

if (!skillDirs.length) fail("skills", "no skills found");
if (vendored.size) pass("vendored", `${vendored.size} upstream skills present (not structurally checked)`);

for (const dir of skillDirs) {
  const file = path.join(skillsDir, dir, "SKILL.md");
  const src = read(file);
  if (!src) { fail("skills", `${dir}/SKILL.md is missing`); continue; }

  const fm = frontMatter(src);
  if (!fm) { fail("skills", `${dir}/SKILL.md has no front matter`); continue; }

  if (!fm.name) fail("skills", `${dir}/SKILL.md front matter has no "name"`);
  if (!fm.description) fail("skills", `${dir}/SKILL.md front matter has no "description"`);

  if (fm.name && fm.name !== dir) {
    fail("skills", `${dir}/SKILL.md declares name "${fm.name}" but lives in "${dir}" — they must match`);
  }
  if (fm.name) declaredSkillNames.add(fm.name);

  // A description is the routing signal. Too short and the runtime cannot pick it.
  if (fm.description && fm.description.length < 80) {
    warn("skills", `${dir} description is only ${fm.description.length} chars — weak routing signal`);
  }
  if (fm.description && !/\buse when\b/i.test(fm.description)) {
    warn("skills", `${dir} description does not say "Use when ..." — harder to route on`);
  }

  // Body should carry the sections the house format promises.
  for (const heading of ["## When to use", "## Verification", "## Failure modes"]) {
    if (!src.includes(heading)) {
      warn("skills", `${dir}/SKILL.md is missing the "${heading.replace("## ", "")}" section`);
    }
  }
}
if (skillDirs.length) pass("skills", `${skillDirs.length} skills found`);

// ---------- 5. commands ----------
const commandsDir = path.join(ROOT, "commands");
const commandFiles = listFiles(commandsDir, ".md");
if (!commandFiles.length) fail("commands", "no commands found");

for (const f of commandFiles) {
  const fm = frontMatter(read(path.join(commandsDir, f)));
  if (!fm) { fail("commands", `${f} has no front matter`); continue; }
  if (!fm.description) fail("commands", `${f} has no "description"`);
}
if (commandFiles.length) pass("commands", `${commandFiles.length} commands found`);

// ---------- 6. agents ----------
const agentsDir = path.join(ROOT, "agents");
const agentFiles = listFiles(agentsDir, ".md");
for (const f of agentFiles) {
  const fm = frontMatter(read(path.join(agentsDir, f)));
  if (!fm) { fail("agents", `${f} has no front matter`); continue; }
  if (!fm.name) fail("agents", `${f} has no "name"`);
  if (!fm.description) fail("agents", `${f} has no "description"`);
  if (fm.name && `${fm.name}.md` !== f) {
    fail("agents", `${f} declares name "${fm.name}" — filename and name must match`);
  }
}
if (agentFiles.length) pass("agents", `${agentFiles.length} agents found`);

// ---------- 7. relative links resolve ----------
const markdownFiles = [];
(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    // Vendored upstream docs follow upstream's link conventions; auditing them here
    // reports someone else's repo, not ours.
    if (dir === skillsDir && vendored.has(e.name)) continue;
    // bundles/ is generated; the --check hash comparison already guarantees it matches
    // source, and its paths deliberately point at the consuming project.
    if (dir === ROOT && e.name === "bundles") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".md")) markdownFiles.push(full);
  }
})(ROOT);

// Backtick-quoted paths like `references/checklist.md` are how these docs cross-reference.
const PATHISH = /`([A-Za-z0-9_./-]+\.(?:md|mjs|json|neon|xml))`/g;
let linkChecks = 0;
for (const file of markdownFiles) {
  const src = read(file);
  if (!src) continue;
  let m;
  const rx = new RegExp(PATHISH.source, "g");
  while ((m = rx.exec(src)) !== null) {
    const target = m[1];
    // Only check paths that look repo-relative, not illustrative filenames.
    if (!target.includes("/")) continue;
    // Paths that belong to the *consuming* project, not this repo: artifacts the agent
    // writes at runtime (`tasks/`), and the per-agent skill folders a developer copies a
    // bundle into (`.claude/`, `.cursor/`, `.codex/`, `.agent/`).
    if (/^(vendor|node_modules|wp-content|tests\/fixtures|tasks|\.claude|\.cursor|\.codex|\.agent)\//.test(target)) continue;
    linkChecks += 1;
    const candidates = [
      path.resolve(path.dirname(file), target),
      path.resolve(ROOT, target),
      path.resolve(skillsDir, target),
    ];
    if (!candidates.some((c) => fs.existsSync(c))) {
      warn("links", `${path.relative(ROOT, file)} references "${target}" which does not resolve`);
    }
  }
}
pass("links", `${linkChecks} repo-relative references checked`);

// ---------- 8. routed skill names exist ----------
// Upstream WordPress skills we delegate to by name; absent locally until install.mjs runs.
const UPSTREAM = new Set([
  "wordpress-router", "wp-project-triage", "wp-plugin-development", "wp-rest-api",
  "wp-block-development", "wp-block-themes", "wp-interactivity-api", "wp-patterns",
  "wp-performance", "wp-phpstan", "wp-playground", "blueprint", "wpds",
  "wp-plugin-directory-guidelines", "wp-wpcli-and-ops", "wp-abilities-api",
  "wp-abilities-audit", "wp-abilities-verify",
]);

const routerSrc = read(path.join(skillsDir, "wp-agent-os", "SKILL.md")) || "";
const routed = new Set();
const rx = /`(wp-[a-z-]+|company-[a-z-]+|wpds|blueprint)`/g;
let rm;
while ((rm = rx.exec(routerSrc)) !== null) routed.add(rm[1]);

for (const nameRef of routed) {
  if (!declaredSkillNames.has(nameRef) && !UPSTREAM.has(nameRef)) {
    fail("routing", `wp-agent-os routes to "${nameRef}" but no such skill exists locally or upstream`);
  }
}
pass("routing", `${routed.size} routed skill names checked against local + upstream`);

// ---------- 9. bundles are in sync with source ----------
// bundles/ is generated and committed so developers can copy a folder without running
// node. That only stays trustworthy if a stale bundle is a hard failure.
if (fs.existsSync(path.join(ROOT, "bundles"))) {
  const res = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "build-bundles.mjs"), "--check"],
    { encoding: "utf8" }
  );
  if (res.status === 0) {
    pass("bundles", (res.stdout || "").trim() || "bundles/ up to date");
  } else {
    const first = (res.stderr || res.stdout || "").trim().split("\n").filter(Boolean);
    fail("bundles", "bundles/ is stale — run: node scripts/build-bundles.mjs");
    for (const line of first.slice(1, 5)) warn("bundles", line.trim());
  }
}

// ---------- report ----------
if (jsonOut) {
  console.log(JSON.stringify({ failures, warnings, passes }, null, 2));
} else {
  console.log("\nwp-custom-agent-skills structural verification\n" + "=".repeat(52));
  for (const p of passes) console.log(`  PASS  ${p.check.padEnd(10)} ${p.detail}`);
  if (warnings.length) {
    console.log("\nWarnings (not blocking):");
    for (const w of warnings) console.log(`  WARN  ${w.check.padEnd(10)} ${w.detail}`);
  }
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  FAIL  ${f.check.padEnd(10)} ${f.detail}`);
  }
  console.log(
    `\n${failures.length ? "FAILED" : "OK"} — ` +
    `${passes.length} checks passed, ${warnings.length} warnings, ${failures.length} failures\n`
  );
}

process.exit(failures.length ? 1 : 0);

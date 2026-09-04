#!/usr/bin/env node
/**
 * setup.mjs — install wp-custom-agent-skills into a WordPress plugin repo.
 *
 * A developer drops this whole `auto-setup/` folder into their plugin, runs this once,
 * and gets the cp-* workflow wired into whichever agent folders that repo uses.
 *
 * What it does:
 *   1. Works out which agent this repo already uses (.claude / .cursor / .agents, plus
 *      the legacy .codex / .agent names an earlier release shipped).
 *   2. Creates the folders that are missing.
 *   3. Adds our files into them — merging, never replacing a folder.
 *
 * THE RULES IT WILL NOT BREAK
 *
 * This script writes into someone else's repository, so it is deliberately narrow:
 *
 *   - It never deletes anything, ever. No rm, no rmdir, no truncate.
 *   - It only writes inside `.claude/`, `.cursor/` and `.agents/` in the target.
 *   - Every file it writes has a `cp-` segment in its path. That invariant is asserted
 *     at runtime, not assumed: a payload file without one is a bug in the build and this
 *     refuses to write it rather than risk clobbering a file that is not ours.
 *   - The one file in each bundle that is NOT cp-prefixed is the bundle's own README.md.
 *     Copying that as-is would overwrite an existing `.claude/README.md`, so it is
 *     installed as `cp-README.md` instead. That collision is the single hazard the main
 *     README warns about, and here it is removed rather than documented.
 *
 * Usage:
 *   node setup.mjs                     install into the current directory
 *   node setup.mjs ../my-plugin        install into that plugin
 *   node setup.mjs --dry-run           show exactly what would change, write nothing
 *   node setup.mjs --agent=claude      install for one agent only (comma-separate for more)
 *   node setup.mjs --all               install all three regardless of what is detected
 *   node setup.mjs --no-overwrite      keep existing cp-* files; only add missing ones
 *   node setup.mjs --json              machine-readable report
 *
 * Exit codes: 0 ok · 2 bad usage or missing payload · 3 target unreadable
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(HERE, "payload");

/**
 * The three install targets. Codex and Antigravity share `.agents/` because both scan
 * `.agents/skills/`; Antigravity additionally reads `.agents/workflows/`, which is what
 * gives it `/cp-*`. Codex reaches skills with `$`, not `/` — it reserves `/` for its own
 * built-ins.
 */
const AGENTS = {
  claude: {
    dir: ".claude",
    label: "Claude Code",
    invocations: [{ tool: "Claude Code", example: "/cp-spec" }],
    legacy: [],
  },
  cursor: {
    dir: ".cursor",
    label: "Cursor",
    invocations: [{ tool: "Cursor", example: "/cp-spec" }],
    legacy: [],
  },
  agents: {
    dir: ".agents",
    label: "Codex + Antigravity",
    invocations: [
      { tool: "Codex", example: "$cp-spec", note: "dollar, not slash — Codex reserves / for its own built-ins" },
      { tool: "Antigravity", example: "/cp-spec" },
    ],
    /**
     * Folder names earlier releases of this system shipped, before testing showed neither
     * tool reads them. A repo still carrying one is a repo that WANTS Codex/Antigravity
     * support — so finding one selects this target, and the files go to `.agents/`.
     *
     * Silently ignoring these was the real bug: a plugin with `.codex/` and no `.agents/`
     * got no Codex workflow at all, and the installer said nothing about why.
     */
    legacy: [
      {
        dir: ".codex",
        why: "Codex does not scan a project-level .codex/ — it reads .agents/skills/, and its custom prompts are global-only (~/.codex/prompts)",
      },
      {
        dir: ".agent",
        why: "Antigravity now defaults to .agents/ (plural); .agent/ is the older name",
      },
    ],
  },
};

/**
 * What people type versus what the folder is called. Someone whose repo has `.codex/`
 * will reasonably try `--agent=codex`; failing them with "unknown agent" would be
 * technically correct and useless.
 */
const ALIASES = {
  codex: "agents",
  antigravity: "agents",
  "claude-code": "claude",
  claudecode: "claude",
};

// ---------- tiny helpers ----------
const read = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const ls = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } };
const toPosix = (p) => p.split(path.sep).join("/");

const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** Soft-wrap prose to a terminal-friendly width so long explanations stay readable. */
function wrap(text, width, indent) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (line && (line + " " + word).length > width) { out.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out.map((l) => indent + l).join("\n");
}

const c = process.stdout.isTTY && !process.env.NO_COLOR
  ? { dim: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` }
  : { dim: (s) => s, b: (s) => s, g: (s) => s, y: (s) => s, r: (s) => s };

function die(code, msg) {
  console.error(`\n${c.r("setup failed")} — ${msg}\n`);
  process.exit(code);
}

// ---------- arguments ----------
const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`
${c.b("wp-custom-agent-skills — installer")}

  node setup.mjs [target-plugin-dir] [options]

  Adds the cp-* WordPress workflow (skills, commands, review personas) to your plugin's
  agent folders. It merges: nothing you already have is deleted or replaced.

${c.b("Options")}
  --dry-run            Show what would change. Writes nothing.
  --agent=<list>       Install for specific agents only: claude, cursor, agents
                       (.agents covers both Codex and Antigravity; "codex" and
                       "antigravity" are accepted and map to it)
  --all                Install for all three, regardless of what this repo already uses
  --no-overwrite       Do not refresh cp-* files that already exist (default is to update
                       them, which is how you take a new version of the workflow)
  --json               Machine-readable report
  --help               This text

${c.b("Default behaviour")}
  Installs into whichever of .claude/ .cursor/ .agents/ already exist. If none exist,
  all three are created — pick with --agent if you only use one.

${c.b("Legacy folders")}
  A repo carrying .codex/ or .agent/ from an earlier release counts as wanting
  Codex/Antigravity support, so the install goes to .agents/ — the folder those tools
  actually read. The legacy folder is reported, never written to, and never deleted.
`);
  process.exit(0);
}

const dryRun = argv.includes("--dry-run");
const jsonOut = argv.includes("--json");
const noOverwrite = argv.includes("--no-overwrite");
const forceAll = argv.includes("--all");

const agentArg = argv.find((a) => a.startsWith("--agent="));
let requested = null;
const aliasNotes = [];
if (agentArg) {
  const raw = agentArg.slice("--agent=".length).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = raw.filter((r) => !AGENTS[r] && !ALIASES[r]);
  if (unknown.length) {
    die(2, `unknown agent ${unknown.map((u) => `"${u}"`).join(", ")}. ` +
      `Valid: ${Object.keys(AGENTS).join(", ")} (aliases: ${Object.keys(ALIASES).join(", ")})`);
  }
  requested = [];
  for (const r of raw) {
    const key = AGENTS[r] ? r : ALIASES[r];
    if (ALIASES[r]) aliasNotes.push(`"${r}" installs into ${AGENTS[key].dir}/ — that is the folder ${AGENTS[key].label} actually reads`);
    if (!requested.includes(key)) requested.push(key);
  }
}

const positional = argv.filter((a) => !a.startsWith("-"));
if (positional.length > 1) die(2, `expected at most one target directory, got ${positional.length}`);
const target = path.resolve(positional[0] || process.cwd());

// ---------- preflight ----------
if (!isDir(PAYLOAD)) {
  die(2, `no payload/ next to this script.\n  Looked in: ${PAYLOAD}\n  ` +
    `Copy the whole auto-setup/ folder, not just setup.mjs.`);
}
if (!isDir(target)) die(3, `target is not a directory: ${target}`);
// Installing into the installer would nest payload inside itself and produce nonsense.
if (target === HERE || target.startsWith(HERE + path.sep)) {
  die(2, `target is inside auto-setup/ itself. Run this from your plugin directory, e.g.\n  ` +
    `cd /path/to/my-plugin && node auto-setup/setup.mjs`);
}

/**
 * Look for a plugin header, one level deep. This is advisory only — a monorepo or an
 * unusual layout is still a legitimate place to install, so a miss warns rather than
 * blocks. But installing into the wrong directory is a cheap mistake to catch here and
 * an annoying one to notice three commands later.
 */
function detectPlugin(root) {
  const heads = [];
  for (const e of ls(root)) {
    if (e.isFile() && e.name.endsWith(".php")) heads.push(path.join(root, e.name));
    else if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "vendor") {
      for (const f of ls(path.join(root, e.name))) {
        if (f.isFile() && f.name.endsWith(".php")) heads.push(path.join(root, e.name, f.name));
      }
    }
  }
  for (const f of heads.slice(0, 400)) {
    const src = read(f);
    if (!src) continue;
    const head = src.subarray(0, 8192).toString("utf8");
    const m = head.match(/^[\s*#/]*Plugin\s+Name\s*:\s*(.+)$/im);
    if (m) return { name: m[1].trim(), file: toPosix(path.relative(root, f)) };
  }
  return null;
}

const plugin = detectPlugin(target);

// ---------- decide which agents to install ----------

/**
 * Legacy agent folders found in the target: `.codex/`, `.agent/`.
 *
 * These count as detection. A repo carrying `.codex/` is a repo that wanted Codex
 * support, so it selects the Codex/Antigravity target even though the install lands in
 * `.agents/` instead. Reporting beats guessing here — the folder is never touched, and
 * the developer is told exactly why the files went somewhere else.
 */
const legacyFound = [];
for (const [key, a] of Object.entries(AGENTS)) {
  for (const l of a.legacy) {
    const full = path.join(target, l.dir);
    if (!isDir(full)) continue;
    // How much of what is in there is ours, and therefore now dead weight?
    let ourFiles = 0;
    (function rec(d) {
      for (const e of ls(d)) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) rec(p);
        else if (toPosix(path.relative(full, p)).split("/").some((s) => s.startsWith("cp-"))) ourFiles += 1;
      }
    })(full);
    legacyFound.push({ agent: key, dir: l.dir, why: l.why, ourFiles, installsTo: a.dir });
  }
}

const present = Object.entries(AGENTS)
  .filter(([k, a]) => isDir(path.join(target, a.dir)) || legacyFound.some((f) => f.agent === k))
  .map(([k]) => k);

let selected;
let reason;
if (requested) {
  selected = requested;
  reason = "requested with --agent";
} else if (forceAll) {
  selected = Object.keys(AGENTS);
  reason = "--all";
} else if (present.length) {
  selected = present;
  const seen = present.map((k) => {
    const viaLegacy = legacyFound.find((f) => f.agent === k && !isDir(path.join(target, AGENTS[k].dir)));
    return viaLegacy ? `${viaLegacy.dir}→${AGENTS[k].dir}` : AGENTS[k].dir;
  });
  reason = `detected existing ${seen.join(", ")}`;
} else {
  // Nothing to go on. Creating all three costs a few hundred KB of markdown and means
  // the repo works for whichever agent the next person on the team opens it with.
  selected = Object.keys(AGENTS);
  reason = "no agent folder found — creating all three";
}

// ---------- build the file plan ----------
function walkPayload(key) {
  const base = path.join(PAYLOAD, key);
  const out = [];
  (function rec(dir, prefix) {
    for (const e of ls(dir)) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) rec(full, rel);
      else out.push({ rel, full });
    }
  })(base, "");
  return out;
}

/**
 * Where a payload file lands in the target, and whether it is safely ours to write.
 *
 * `cp-README.md`: the bundle's own README sits at the bundle root with a name that would
 * overwrite an existing `.claude/README.md`. Renaming it on install keeps the "every
 * path we touch has a cp- segment" invariant true for every single file, which is what
 * makes the overwrite rule below safe to state absolutely.
 */
function destFor(rel) {
  return rel === "README.md" ? "cp-README.md" : rel;
}
const isOurs = (rel) => rel.split("/").some((seg) => seg.startsWith("cp-"));

const plan = [];       // { agent, rel, from, to, action }
const problems = [];

for (const key of selected) {
  const agent = AGENTS[key];
  const files = walkPayload(key);
  if (!files.length) {
    problems.push(`payload/${key}/ is empty — nothing to install for ${agent.label}`);
    continue;
  }
  for (const { rel, full } of files) {
    const dest = destFor(rel);

    // Fail closed. If the build ever emits a file outside our namespace, refuse it
    // rather than write an unprefixed file into someone's repo.
    if (!isOurs(dest)) {
      problems.push(`refusing to install "${key}/${rel}" — no cp- segment, so it is not provably ours`);
      continue;
    }
    if (dest.split("/").includes("..") || path.isAbsolute(dest)) {
      problems.push(`refusing to install "${key}/${rel}" — unsafe path`);
      continue;
    }

    const to = path.join(target, agent.dir, dest.split("/").join(path.sep));
    const src = read(full);
    if (src === null) { problems.push(`cannot read payload file ${key}/${rel}`); continue; }

    const existing = read(to);
    let action;
    if (existing === null) action = "create";
    else if (existing.equals(src)) action = "identical";
    else action = noOverwrite ? "kept" : "update";

    plan.push({ agent: key, dir: agent.dir, rel: dest, from: full, to, action, bytes: src });
  }
}

if (problems.length && !plan.length) die(2, problems.join("\n  "));

/** Existing files in each target agent dir that this install does not touch. */
const untouched = {};
for (const key of selected) {
  const dir = path.join(target, AGENTS[key].dir);
  if (!isDir(dir)) { untouched[key] = 0; continue; }
  const willWrite = new Set(plan.filter((p) => p.agent === key).map((p) => p.to));
  let n = 0;
  (function rec(d) {
    for (const e of ls(d)) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) rec(full);
      else if (!willWrite.has(full)) n += 1;
    }
  })(dir);
  untouched[key] = n;
}

// ---------- execute ----------
const counts = { create: 0, update: 0, identical: 0, kept: 0 };
const createdDirs = [];

if (!dryRun) {
  for (const key of selected) {
    const dir = path.join(target, AGENTS[key].dir);
    if (!isDir(dir)) { fs.mkdirSync(dir, { recursive: true }); createdDirs.push(AGENTS[key].dir); }
  }
  for (const item of plan) {
    if (item.action === "identical" || item.action === "kept") { counts[item.action] += 1; continue; }
    fs.mkdirSync(path.dirname(item.to), { recursive: true });
    // Write bytes verbatim. The payload is generated with LF endings and the parsers in
    // this system have been bitten by CRLF before; re-encoding here would reintroduce it.
    fs.writeFileSync(item.to, item.bytes);
    counts[item.action] += 1;
  }
} else {
  for (const key of selected) {
    if (!isDir(path.join(target, AGENTS[key].dir))) createdDirs.push(AGENTS[key].dir);
  }
  for (const item of plan) counts[item.action] += 1;
}

// ---------- report ----------
if (jsonOut) {
  console.log(JSON.stringify({
    target: toPosix(target),
    dry_run: dryRun,
    plugin,
    selected,
    selection_reason: reason,
    alias_notes: aliasNotes,
    legacy_folders: legacyFound,
    created_dirs: createdDirs,
    counts,
    untouched_existing_files: untouched,
    problems,
    files: plan.map(({ agent, dir, rel, action }) => ({ agent, path: `${dir}/${rel}`, action })),
  }, null, 2));
  process.exit(0);
}

const title = dryRun ? "wp-custom-agent-skills — DRY RUN (nothing written)" : "wp-custom-agent-skills — installed";
console.log(`\n${c.b(title)}\n${"=".repeat(Math.max(title.length, 52))}`);
console.log(`  target      ${toPosix(target)}`);
console.log(`  plugin      ${plugin ? `${plugin.name}  ${c.dim(`(${plugin.file})`)}` : c.y("no Plugin Name: header found — check you are in the right directory")}`);
console.log(`  agents      ${selected.map((k) => AGENTS[k].dir).join(", ")}  ${c.dim(`(${reason})`)}`);
if (createdDirs.length) console.log(`  created     ${createdDirs.join(", ")}`);
for (const n of aliasNotes) console.log(`  ${c.dim("note")}        ${c.dim(n)}`);

console.log("");
for (const key of selected) {
  const mine = plan.filter((p) => p.agent === key);
  const n = (a) => mine.filter((p) => p.action === a).length;
  const bits = [
    n("create") ? c.g(`${n("create")} added`) : null,
    n("update") ? c.y(`${n("update")} updated`) : null,
    n("kept") ? `${n("kept")} kept (--no-overwrite)` : null,
    n("identical") ? c.dim(`${n("identical")} already current`) : null,
  ].filter(Boolean);
  console.log(`  ${AGENTS[key].dir.padEnd(9)} ${String(mine.length).padStart(4)} files   ${bits.join(" · ") || c.dim("nothing to do")}`);
  if (untouched[key]) console.log(`  ${" ".repeat(9)} ${c.dim(`${plural(untouched[key], "existing file")} left untouched`)}`);
}

// Legacy folders are never written to and never deleted — but they must never be passed
// over in silence either. A developer who sees .codex/ sitting there and no mention of it
// cannot tell whether the installer handled it, ignored it, or failed.
if (legacyFound.length) {
  console.log(`\n  ${c.y(`${plural(legacyFound.length, "legacy agent folder")} found — not used, not touched`)}:`);
  for (const f of legacyFound) {
    const dest = selected.includes(f.agent) ? `installed into ${c.b(f.installsTo + "/")} instead` : `${f.installsTo}/ not selected`;
    console.log(`    ${c.b(f.dir + "/")}  ${dest}`);
    console.log(c.dim(wrap(f.why, 74, "      ")));
    if (f.ourFiles) {
      console.log(c.dim(wrap(`Holds ${plural(f.ourFiles, "stale cp-* file")} from an earlier release, superseded by ${f.installsTo}/ and safe to delete.`, 74, "      ")));
    } else {
      console.log(c.dim(wrap("Nothing of ours in it; review before deleting, it may hold your own files.", 74, "      ")));
    }
  }
}

const updated = plan.filter((p) => p.action === "update");
if (updated.length) {
  console.log(`\n  ${c.y("Refreshed to this version")} (cp-* files only — review with git diff):`);
  for (const u of updated.slice(0, 8)) console.log(`    ${u.dir}/${u.rel}`);
  if (updated.length > 8) console.log(`    ${c.dim(`... and ${updated.length - 8} more`)}`);
}

if (problems.length) {
  console.log(`\n  ${c.r("Problems")}:`);
  for (const p of problems) console.log(`    ${p}`);
}

console.log(`\n${c.b("Nothing was deleted.")} Every file added is prefixed ${c.b("cp-")}, so it cannot
collide with your own skills or with the official WordPress ${c.b("wp-")} skills.`);

if (dryRun) {
  console.log(`\nRun again without ${c.b("--dry-run")} to apply.\n`);
} else {
  // One row per tool, not per folder: .agents/ serves Codex and Antigravity, and they are
  // invoked differently. Collapsing them into one line is what makes people type /cp- in
  // Codex, see nothing, and conclude the install failed.
  const rows = selected.flatMap((k) => AGENTS[k].invocations);
  const w = Math.max(...rows.map((r) => r.tool.length));

  console.log(`\n${c.b("Invocation")}   ${c.dim("restart your agent in this folder before the commands appear")}`);
  for (const r of rows) {
    console.log(`  ${r.tool.padEnd(w)}   ${c.b(r.example.padEnd(9))}  ${r.note ? c.dim(r.note) : ""}`.trimEnd());
  }

  const pad = (t) => t.padEnd(w + 3);
  console.log(`\n${c.b("Where to start")}`);
  console.log(`  ${pad("/cp-context")}   reports what is actually in this plugin — facts, not verdicts`);
  console.log(`  ${pad("/cp-triage")}   sizes a task and picks how much process it needs`);
  console.log(`  ${pad("/cp-security")}   enumerates every entry point and audits each one`);
  console.log(`  ${c.dim(`${pad("")}   all 13 commands: ${AGENTS[selected[0]].dir}/cp-README.md`)}`);

  console.log(`\n${c.b("Not included")}   ${c.dim("the official WordPress knowledge skills — hooks, REST, blocks, WP-CLI.")}`);
  console.log(`  ${c.dim("They are a separate project and ship no redistribution terms here.")}`);
  console.log(`  ${c.dim("git clone https://github.com/WordPress/agent-skills")}`);
  console.log(`  ${c.dim(`cp -r agent-skills/skills/* ${AGENTS[selected[0]].dir}/skills/`)}\n`);
}

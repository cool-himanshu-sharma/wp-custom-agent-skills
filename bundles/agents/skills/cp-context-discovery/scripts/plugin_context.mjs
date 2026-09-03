#!/usr/bin/env node
/**
 * plugin_context.mjs — deterministic Plugin Context Record for a WordPress plugin.
 *
 * Emits a structured description of the plugin's identity, public surface, storage,
 * security signals and toolchain, so an agent can follow the plugin's real conventions
 * instead of guessing them.
 *
 * Usage:
 *   node plugin_context.mjs [pluginRoot] [--json] [--max-files=4000]
 *
 * Exit codes: 0 ok · 2 no plugin header found · 3 unreadable root
 *
 * This script reports FACTS ONLY. It never renders a verdict — counts like
 * "superglobal_reads: 31" are inputs to cp-security-review, not findings.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TOOL_VERSION = "1.0.0";
const IGNORED_DIRS = new Set([
  ".git", "node_modules", "vendor", "dist", "build", "coverage",
  ".github", ".idea", ".vscode", "languages",
]);

const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");
const maxFilesArg = argv.find((a) => a.startsWith("--max-files="));
const maxFiles = Number(maxFilesArg ? maxFilesArg.split("=")[1] : 0) || 4000;
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());

// ---------- fs helpers ----------
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const exists = (p) => fs.existsSync(p);
const rel = (p) => path.relative(root, p).split(path.sep).join("/") || ".";

function walk(dir, exts, acc = [], depth = 0) {
  if (acc.length >= maxFiles || depth > 10) return acc;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (acc.length >= maxFiles) break;
    if (e.name.startsWith(".") && e.name !== ".wp-env.json") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue;
      walk(full, exts, acc, depth + 1);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      acc.push(full);
    }
  }
  return acc;
}

// ---------- matching ----------
const srcCache = new Map();
function sourceOf(f) {
  if (!srcCache.has(f)) srcCache.set(f, read(f));
  return srcCache.get(f);
}

/** Unique capture values across files, ranked by frequency, with example locations. */
function collect(files, re, opts = {}) {
  const { group = 1, limit = 200 } = opts;
  const out = new Map();
  for (const f of files) {
    const src = sourceOf(f);
    if (!src) continue;
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = rx.exec(src)) !== null) {
      const key = m[group];
      if (!key) continue;
      if (!out.has(key)) out.set(key, { value: key, count: 0, files: new Set() });
      const rec = out.get(key);
      rec.count += 1;
      if (rec.files.size < 4) rec.files.add(rel(f));
    }
  }
  return [...out.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((r) => ({ value: r.value, count: r.count, files: [...r.files] }));
}

function countOf(files, re) {
  let n = 0;
  for (const f of files) {
    const src = sourceOf(f);
    if (!src) continue;
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while (rx.exec(src) !== null) n += 1;
  }
  return n;
}

/** Merge collect() results, summing counts for repeated values. */
function dedupeBy(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.value)) out.set(r.value, { value: r.value, count: 0, files: [] });
    const rec = out.get(r.value);
    rec.count += r.count;
    for (const f of r.files) if (!rec.files.includes(f) && rec.files.length < 4) rec.files.push(f);
  }
  return [...out.values()].sort((a, b) => b.count - a.count);
}

const CRON_RECURRENCES = new Set(["hourly", "twicedaily", "daily", "weekly", "monthly"]);

/**
 * Cron hook names sit at different argument positions per function
 * (wp_schedule_event puts recurrence second), so pull every quoted literal from the
 * call and drop the known recurrence keywords rather than guessing an index.
 */
function collectCronHooks(files) {
  const re = /wp_(?:schedule_event|schedule_single_event|next_scheduled|clear_scheduled_hook|unschedule_event)\s*\(/gi;
  const rows = [];
  for (const f of files) {
    const src = sourceOf(f);
    if (!src) continue;
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(src)) !== null) {
      const args = balancedArgs(src, rx.lastIndex - 1);
      if (args === null) continue;
      const lit = /['"]([a-z0-9_]{3,})['"]/gi;
      let a;
      while ((a = lit.exec(args)) !== null) {
        if (CRON_RECURRENCES.has(a[1].toLowerCase())) continue;
        rows.push({ value: a[1], count: 1, files: [rel(f)] });
      }
    }
  }
  return dedupeBy(rows);
}

/** Split call-argument text on top-level commas only. */
function splitArgs(args) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (let i = 0; i < args.length; i += 1) {
    const c = args[i];
    if (quote) {
      cur += c;
      if (c === "\\") { cur += args[i + 1] || ""; i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === "(" || c === "[") depth += 1;
    if (c === ")" || c === "]") depth -= 1;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const literal = (arg) => {
  if (!arg) return null;
  const m = arg.match(/^\s*['"]([^'"]*)['"]\s*$/);
  return m ? m[1] : null;
};

// Where the capability and slug sit in each add_*_page() signature.
const MENU_FNS = {
  add_menu_page: { cap: 2, slug: 3 },
  add_submenu_page: { cap: 3, slug: 4 },
  add_options_page: { cap: 2, slug: 3 },
  add_management_page: { cap: 2, slug: 3 },
  add_theme_page: { cap: 2, slug: 3 },
  add_plugins_page: { cap: 2, slug: 3 },
  add_users_page: { cap: 2, slug: 3 },
  add_dashboard_page: { cap: 2, slug: 3 },
  add_media_page: { cap: 2, slug: 3 },
  add_posts_page: { cap: 2, slug: 3 },
  add_pages_page: { cap: 2, slug: 3 },
  add_comments_page: { cap: 2, slug: 3 },
};

/**
 * Admin screens with the capability that gates each one. Positional parsing matters
 * here: a naive "first quoted string" grab returns the page title or text domain.
 */
function collectAdminPages(files) {
  const rx = new RegExp("\\b(" + Object.keys(MENU_FNS).join("|") + ")\\s*\\(", "gi");
  const seen = new Map();
  for (const f of files) {
    const src = sourceOf(f);
    if (!src) continue;
    const r = new RegExp(rx.source, rx.flags);
    let m;
    while ((m = r.exec(src)) !== null) {
      const fn = m[1].toLowerCase();
      const spec = MENU_FNS[fn];
      const args = balancedArgs(src, r.lastIndex - 1, 1200);
      if (args === null) continue;
      const parts = splitArgs(args);
      const slug = literal(parts[spec.slug]);
      if (!slug) continue;
      const cap = literal(parts[spec.cap]) || (parts[spec.cap] ? "(dynamic)" : null);
      if (!seen.has(slug)) seen.set(slug, { value: slug, capability: cap, via: fn, count: 0, files: [] });
      const rec = seen.get(slug);
      rec.count += 1;
      if (!rec.files.includes(rel(f)) && rec.files.length < 4) rec.files.push(rel(f));
    }
  }
  return [...seen.values()];
}

/**
 * Return the argument text of a call whose opening paren is at `open`.
 * Nested calls like `wp_schedule_event( time(), 'daily', 'hook' )` need real paren
 * balancing — a lazy regex stops at the inner `time()` and loses the hook name.
 */
function balancedArgs(src, open, maxLen = 600) {
  if (src[open] !== "(") return null;
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length && i - open < maxLen; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

if (!exists(root)) {
  console.error(`Root not readable: ${root}`);
  process.exit(3);
}

const phpFiles = walk(root, [".php"]);
const jsFiles = walk(root, [".js", ".jsx", ".ts", ".tsx"]);

// ---------- 1. identity ----------
const HEADER_KEYS = [
  "Plugin Name", "Plugin URI", "Description", "Version", "Requires at least",
  "Requires PHP", "Requires Plugins", "Author", "Text Domain", "Domain Path",
  "License", "Network", "Update URI",
];

function parseHeader(src) {
  const head = src.slice(0, 8192);
  const out = {};
  for (const key of HEADER_KEYS) {
    const pattern = "^[\\s*#/]*" + key.replace(/ /g, "\\s") + "\\s*:\\s*(.+)$";
    const m = head.match(new RegExp(pattern, "im"));
    if (m) out[key] = m[1].trim().replace(/\s*\*\/\s*$/, "").trim();
  }
  return out;
}

let mainFile = null;
let headers = {};
const candidates = phpFiles
  .map((f) => ({ f, src: sourceOf(f) }))
  .filter((c) => c.src && /^[\s*#/]*Plugin\s+Name\s*:/im.test(c.src.slice(0, 8192)))
  .sort((a, b) => rel(a.f).split("/").length - rel(b.f).split("/").length);

if (candidates.length) {
  mainFile = candidates[0].f;
  headers = parseHeader(candidates[0].src);
}

// ---------- 2. naming conventions ----------
const constants = collect(phpFiles, /\bdefine\s*\(\s*['"]([A-Z][A-Z0-9_]{3,})['"]/);
const functions = collect(phpFiles, /^[ \t]*function\s+([a-z][a-z0-9_]{3,})\s*\(/im);
const namespaces = collect(phpFiles, /^[ \t]*namespace\s+([A-Za-z0-9_\\]+)\s*;/im, { limit: 25 });
const classes = collect(phpFiles, /^[ \t]*(?:final\s+|abstract\s+)?class\s+([A-Za-z0-9_]+)/im, { limit: 80 });

/** Most common leading `word_` token — the plugin's de facto prefix. */
function inferPrefix(names) {
  const heads = names
    .map((n) => { const m = n.value.match(/^([A-Za-z0-9]+_)/); return m ? m[1] : null; })
    .filter(Boolean);
  if (!heads.length) return null;
  const tally = new Map();
  for (const h of heads) tally.set(h, (tally.get(h) || 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [best, hits] = sorted[0];
  return hits >= 2 ? { prefix: best, occurrences: hits } : null;
}

// ---------- 3. public surface ----------
const surface = {
  hooks_provided: {
    actions: collect(phpFiles, /\bdo_action(?:_deprecated)?\s*\(\s*['"]([^'"]+)['"]/),
    filters: collect(phpFiles, /\bapply_filters(?:_deprecated)?\s*\(\s*['"]([^'"]+)['"]/),
  },
  hooks_consumed: collect(phpFiles, /\badd_(?:action|filter)\s*\(\s*['"]([^'"]+)['"]/, { limit: 120 }),
  rest_namespaces: collect(phpFiles, /register_rest_route\s*\(\s*['"]([^'"]+)['"]/),
  rest_route_paths: collect(phpFiles, /register_rest_route\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/),
  ajax_actions: collect(phpFiles, /add_action\s*\(\s*['"]wp_ajax(?:_nopriv)?_([^'"]+)['"]/),
  shortcodes: collect(phpFiles, /add_shortcode\s*\(\s*['"]([^'"]+)['"]/),
  cli_commands: collect(phpFiles, /WP_CLI::add_command\s*\(\s*['"]([^'"]+)['"]/),
  post_types: collect(phpFiles, /register_post_type\s*\(\s*['"]([^'"]+)['"]/),
  taxonomies: collect(phpFiles, /register_taxonomy\s*\(\s*['"]([^'"]+)['"]/),
  blocks: walk(root, ["block.json"]).map(rel),
  admin_pages: collectAdminPages(phpFiles),
};

// ---------- 4. storage ----------
const storage = {
  options: collect(phpFiles, /\b(?:get|update|add|delete)_(?:site_)?option\s*\(\s*['"]([^'"]+)['"]/),
  autoloaded_option_writes: countOf(phpFiles, /\b(?:add|update)_option\s*\([^;]{0,200}?,\s*(?:true|'yes'|"yes")\s*\)/),
  transients: collect(phpFiles, /\b(?:get|set|delete)_(?:site_)?transient\s*\(\s*['"]([^'"]+)['"]/),
  post_meta: collect(phpFiles, /\b(?:get|update|add|delete)_post_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/),
  user_meta: collect(phpFiles, /\b(?:get|update|add|delete)_user_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/),
  // Both `$wpdb->prefix . 'tbl'` and the interpolated `{$wpdb->prefix}tbl` form.
  custom_tables: dedupeBy([
    ...collect(phpFiles, /\$wpdb->prefix\s*\.\s*['"]([a-z0-9_]+)['"]/i),
    ...collect(phpFiles, /\{\$wpdb->prefix\}([a-z0-9_]+)/i),
  ]),
  uses_dbdelta: countOf(phpFiles, /\bdbDelta\s*\(/) > 0,
  cron_hooks: collectCronHooks(phpFiles),
};

// ---------- 5. security signals (facts, not verdicts) ----------
const security = {
  capability_checks: countOf(phpFiles, /\bcurrent_user_can\s*\(/),
  nonce_creates: countOf(phpFiles, /\bwp_(?:create_nonce|nonce_field)\s*\(/),
  nonce_verifies: countOf(phpFiles, /\b(?:wp_verify_nonce|check_admin_referer|check_ajax_referer)\s*\(/),
  permission_callbacks: countOf(phpFiles, /['"]permission_callback['"]\s*=>/),
  permission_callback_true: countOf(phpFiles, /['"]permission_callback['"]\s*=>\s*['"]?__return_true/),
  superglobal_reads: countOf(phpFiles, /\$_(?:POST|GET|REQUEST|COOKIE|FILES|SERVER)\s*\[/),
  unslash_calls: countOf(phpFiles, /\bwp_unslash\s*\(/),
  sanitize_calls: countOf(phpFiles, /\b(?:sanitize_[a-z_]+|absint|intval|wp_kses|wp_kses_post)\s*\(/),
  escape_calls: countOf(phpFiles, /\b(?:esc_html|esc_attr|esc_url|esc_url_raw|esc_js|esc_textarea)(?:__|_e|_x)?\s*\(/),
  wpdb_prepare: countOf(phpFiles, /\$wpdb->prepare\s*\(/),
  wpdb_direct_query: countOf(phpFiles, /\$wpdb->(?:query|get_results|get_row|get_var|get_col)\s*\(/),
  raw_echo_of_input: countOf(phpFiles, /\becho\s+\$_(?:POST|GET|REQUEST)\s*\[/),
  unserialize_calls: countOf(phpFiles, /(?<!maybe_)\bunserialize\s*\(/),
  dangerous_exec: countOf(phpFiles, /\b(?:eval|shell_exec|passthru|proc_open|popen)\s*\(/),
  remote_file_get_contents: countOf(phpFiles, /\bfile_get_contents\s*\(\s*['"]?https?:/),
  uses_wp_remote: countOf(phpFiles, /\bwp_remote_(?:get|post|request|head)\s*\(/),
  file_uploads: countOf(phpFiles, /\b(?:wp_handle_upload|move_uploaded_file|wp_upload_bits)\s*\(/),
};

// ---------- 6. i18n ----------
const textDomains = collect(
  phpFiles,
  /\b(?:__|_e|_x|_n|_ex|_nx|esc_html__|esc_html_e|esc_attr__|esc_attr_e|esc_html_x|esc_attr_x)\s*\([\s\S]{0,200}?,\s*['"]([a-z0-9-]{2,})['"]\s*\)/i,
  { limit: 15 }
);
const declaredDomain = headers["Text Domain"] || null;
const i18n = {
  declared_text_domain: declaredDomain,
  text_domains_used: textDomains,
  consistent: (!declaredDomain || !textDomains.length)
    ? null
    : textDomains.every((t) => t.value === declaredDomain),
  loads_textdomain: countOf(phpFiles, /\bload_plugin_textdomain\s*\(/) > 0,
  translator_comments: countOf(phpFiles, /translators:/i),
};

// ---------- 7. toolchain ----------
const findCfg = (names) => names.filter((n) => exists(path.join(root, n)));
const parseJson = (p) => { try { return JSON.parse(read(path.join(root, p)) || "{}"); } catch { return {}; } };
const pkg = parseJson("package.json");
const composer = parseJson("composer.json");

const toolchain = {
  composer_json: exists(path.join(root, "composer.json")),
  composer_scripts: Object.keys(composer.scripts || {}),
  composer_dev_requires: Object.keys((composer["require-dev"]) || {}),
  package_json: exists(path.join(root, "package.json")),
  npm_scripts: Object.keys(pkg.scripts || {}),
  phpcs: findCfg(["phpcs.xml", "phpcs.xml.dist", ".phpcs.xml", ".phpcs.xml.dist"]),
  phpstan: findCfg(["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"]),
  phpstan_baseline: findCfg(["phpstan-baseline.neon"]),
  phpunit: findCfg(["phpunit.xml", "phpunit.xml.dist"]),
  wp_env: findCfg([".wp-env.json", ".wp-env.override.json"]),
  playwright: findCfg(["playwright.config.js", "playwright.config.ts"]),
  jest: findCfg(["jest.config.js", "jest.config.json"]),
  wp_cli_yml: findCfg(["wp-cli.yml", "wp-cli.local.yml"]),
  blueprint: findCfg(["blueprint.json", "_playground/blueprint.json"]),
  readme_txt: findCfg(["readme.txt", "README.txt"]),
  changelog: findCfg(["CHANGELOG.md", "changelog.md"]),
  uninstall_php: exists(path.join(root, "uninstall.php")),
  ci_workflows: exists(path.join(root, ".github/workflows")),
  uses_wordpress_scripts: Boolean(
    (pkg.devDependencies || {})["@wordpress/scripts"] || (pkg.dependencies || {})["@wordpress/scripts"]
  ),
};

// ---------- 8. lifecycle ----------
const lifecycle = {
  activation_hook: countOf(phpFiles, /register_activation_hook\s*\(/) > 0,
  deactivation_hook: countOf(phpFiles, /register_deactivation_hook\s*\(/) > 0,
  uninstall_hook: countOf(phpFiles, /register_uninstall_hook\s*\(/) > 0 || toolchain.uninstall_php,
  db_version_options: storage.options.filter((o) => /(?:db|schema).?version|version/i.test(o.value)).map((o) => o.value).slice(0, 8),
  flush_rewrite_rules: countOf(phpFiles, /flush_rewrite_rules\s*\(/),
};

// ---------- assemble ----------
const record = {
  tool: "plugin_context.mjs",
  tool_version: TOOL_VERSION,
  generated_at: new Date().toISOString(),
  root: root.split(path.sep).join("/"),
  scan: {
    php_files: phpFiles.length,
    js_files: jsFiles.length,
    truncated: phpFiles.length >= maxFiles,
  },
  identity: {
    main_file: mainFile ? rel(mainFile) : null,
    slug: mainFile ? path.basename(mainFile, ".php") : null,
    headers,
    version: headers["Version"] || null,
    requires_wp: headers["Requires at least"] || null,
    requires_php: headers["Requires PHP"] || null,
    network: headers["Network"] || null,
    license: headers["License"] || null,
  },
  conventions: {
    namespaces: namespaces.map((n) => n.value),
    uses_namespaces: namespaces.length > 0,
    inferred_function_prefix: inferPrefix(functions),
    inferred_constant_prefix: inferPrefix(constants),
    top_constants: constants.slice(0, 15).map((c) => c.value),
    class_count: classes.length,
  },
  surface,
  storage,
  security_signals: security,
  i18n,
  lifecycle,
  toolchain,
};

if (!mainFile) {
  record.error = "No file with a `Plugin Name:` header was found. Is this a plugin root?";
}

// ---------- output ----------
if (jsonOnly) {
  console.log(JSON.stringify(record, null, 2));
} else {
  const id = record.identity;
  const L = (k, v) => console.log("  " + String(k).padEnd(24) + " " + v);
  const names = (arr) => arr.map((x) => x.value).join(", ") || "-";

  console.log("\nPlugin Context Record  v" + record.tool_version + "   " + record.root);
  console.log("=".repeat(66));

  console.log("IDENTITY");
  L("main file", id.main_file || "NOT FOUND");
  L("name", id.headers["Plugin Name"] || "-");
  L("version", id.version || "-");
  L("requires WP / PHP", (id.requires_wp || "?") + " / " + (id.requires_php || "?"));
  L("text domain", i18n.declared_text_domain || "-");
  L("fn / const prefix",
    (record.conventions.inferred_function_prefix ? record.conventions.inferred_function_prefix.prefix : "-") + " / " +
    (record.conventions.inferred_constant_prefix ? record.conventions.inferred_constant_prefix.prefix : "-"));
  L("namespaces", record.conventions.namespaces.join(", ") || "none (global)");

  console.log("\nPUBLIC SURFACE   (renaming any of these is a breaking change)");
  L("actions provided", surface.hooks_provided.actions.length);
  L("filters provided", surface.hooks_provided.filters.length);
  L("REST namespaces", names(surface.rest_namespaces));
  L("AJAX actions", surface.ajax_actions.length);
  L("WP-CLI commands", names(surface.cli_commands));
  L("shortcodes", names(surface.shortcodes));
  L("post types", names(surface.post_types));
  L("admin screens", surface.admin_pages.map((p) => p.value + " [" + (p.capability || "?") + "]").join(", ") || "-");
  L("blocks", surface.blocks.length);

  console.log("\nSTORAGE");
  L("options", storage.options.length);
  L("autoloaded writes", storage.autoloaded_option_writes);
  L("transients", storage.transients.length);
  L("custom tables", names(storage.custom_tables));
  L("cron hooks", names(storage.cron_hooks));
  L("dbDelta migrations", storage.uses_dbdelta ? "yes" : "no");

  console.log("\nSECURITY SIGNALS   (counts only — verdicts come from cp-security-review)");
  L("superglobal reads", security.superglobal_reads);
  L("sanitize / escape", security.sanitize_calls + " / " + security.escape_calls);
  L("caps / nonce verify", security.capability_checks + " / " + security.nonce_verifies);
  L("$wpdb raw / prepare", security.wpdb_direct_query + " / " + security.wpdb_prepare);
  L("permission_callback", security.permission_callbacks + " (__return_true: " + security.permission_callback_true + ")");
  if (security.raw_echo_of_input) L("!! echo raw input", security.raw_echo_of_input);
  if (security.dangerous_exec) L("!! eval/exec family", security.dangerous_exec);
  if (security.remote_file_get_contents) L("!! remote file_get_*", security.remote_file_get_contents);

  console.log("\nLIFECYCLE");
  L("activate/deactivate", (lifecycle.activation_hook ? "yes" : "no") + " / " + (lifecycle.deactivation_hook ? "yes" : "no"));
  L("uninstall", lifecycle.uninstall_hook ? "yes" : "NO — data may be orphaned");

  console.log("\nTOOLCHAIN   (which enforcement is actually available?)");
  L("PHPCS", toolchain.phpcs.join(", ") || "ABSENT");
  L("PHPStan", toolchain.phpstan.join(", ") || "ABSENT");
  L("PHPUnit", toolchain.phpunit.join(", ") || "ABSENT");
  L("wp-env / Playwright", (toolchain.wp_env.join(",") || "-") + " / " + (toolchain.playwright.join(",") || "-"));
  L("composer scripts", toolchain.composer_scripts.join(", ") || "-");
  L("npm scripts", toolchain.npm_scripts.join(", ") || "-");
  L("readme.txt", toolchain.readme_txt.join(", ") || "ABSENT");

  if (i18n.consistent === false) {
    console.log("\n  WARNING: text domain used in code does not match the plugin header (" +
      i18n.declared_text_domain + "). Translations will not load for the mismatched strings.");
  }
  if (record.scan.truncated) {
    console.log("\n  WARNING: file scan hit the --max-files cap; counts are a lower bound.");
  }
  if (record.error) console.log("\n  ERROR: " + record.error);

  console.log("\nRun with --json for the full machine-readable record.\n");
}

process.exit(mainFile ? 0 : 2);

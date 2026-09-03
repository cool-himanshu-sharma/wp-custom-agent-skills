---
name: wp-context-discovery
description: "Use before editing any WordPress plugin, to build a Plugin Context Record: main file and headers, naming prefix, text domain, public hook/REST/CLI surface, option and table storage, lifecycle hooks, and which of PHPCS/PHPStan/PHPUnit are actually available. Use when you are about to add a hook, option, admin page, or REST route and need to match the plugin's existing conventions."
compatibility: "WordPress 6.5+ / PHP 7.4+. Requires node for the scanner. No PHP required."
---

# WP Context Discovery

You cannot follow a plugin's conventions until you have read them. This skill produces
the **Plugin Context Record** — the factual base every other `wp-*` skill builds on.

Most bad WordPress agent edits trace back to skipping this: a new function named
`get_settings()` in a plugin that prefixes everything `acme_lm_`, a string wrapped with
the wrong text domain, a second option where one already exists.

## When to use

- Before the first edit in any plugin, every session.
- Before adding a hook, option, admin page, REST route, or CLI command.
- Before renaming or deleting anything — the record tells you what is public API.
- When `wp-task-triage` asks whether a change touches a public surface.

## Inputs required

- The plugin root (the directory containing the file with the `Plugin Name:` header).
- If the repo is a full site, pick the specific plugin under `wp-content/plugins/` first.

## Procedure

### 1. Run the scanner

```bash
node .codex/skills/wp-context-discovery/scripts/plugin_context.mjs <plugin-root>
node .codex/skills/wp-context-discovery/scripts/plugin_context.mjs <plugin-root> --json
```

The path above is the one for the bundle you installed — each agent keeps skills under its
own folder, and the build bakes the correct prefix in.

If it does not resolve, locate the file once and use an absolute path — but do not skip the scan
and describe the plugin from reading alone. The whole point of this step is that the
record is deterministic.

Exit codes: `0` record produced · `2` no `Plugin Name:` header found · `3` unreadable root.

The scanner reports **facts only** — counts, names, file locations. It never renders a
verdict. `superglobal_reads: 31` is an input to `wp-security-review`, not a finding.

### 2. Read the record in this order

**Identity** — main file, version, `Requires at least`, `Requires PHP`, text domain.
The two `Requires` values decide which APIs you may use. If they are absent, ask; do not
assume current WordPress.

**Conventions** — the inferred function/constant prefix and namespaces. *Match these.*
If the plugin uses `Acme\LM\` namespaces, your new class belongs in one. If it uses
`acme_lm_` global functions, do not introduce a namespace for one file.

**Public surface** — actions and filters provided, REST namespaces, AJAX actions, CLI
commands, shortcodes, post types, admin screens *and the capability gating each*.
Everything here is API that other people's sites depend on. Renaming any of it is a
breaking change even if nothing in this repo references it.

**Storage** — existing options, transients, meta keys, custom tables, cron hooks.
Before adding an option, check whether one already covers it. Note
`autoloaded writes` — every autoloaded option loads on *every* request.

**Security signals** — raw counts. A plugin with `superglobal reads: 40` and
`nonce verify: 0` is worth a hard look, but the count alone is not a finding.

**Lifecycle** — activation/deactivation/uninstall. `uninstall: NO` means the plugin
orphans its data; relevant when you add storage.

**Toolchain** — which of PHPCS, PHPStan, PHPUnit, wp-env, Playwright exist. This is the
enforcement budget for the task. `ABSENT` means you cannot claim that check passed, and
you must say so rather than substituting your own judgment.

### 3. Fill the gaps the scanner cannot see

Static scanning has real limits. Read code for:

- **Dynamic hook names** — `do_action( "acme_{$type}_saved" )` won't appear as a literal.
- **Hooks in the plugin's own docs/readme** that are part of the documented contract.
- **The bootstrap order** — open the main file and follow what loads when.
- **Whether the plugin has a free/pro split** or shared library it must stay compatible with.

### 4. Record and reuse

Write the summary into your working notes (or `tasks/context.md` for a long task) so
later steps and reviewers use the same facts. Re-run the scanner after you add a hook,
option, or route — the record is how you prove the surface changed as intended.

## Verification

Discovery is complete when you can answer, without re-reading:
- main file, version, minimum WP and PHP;
- the prefix and text domain you must use;
- whether the thing you are about to add already exists;
- which verification commands are actually available.

## Failure modes

- **Scanning a site repo instead of a plugin.** Exit code 2 with many PHP files usually
  means you pointed at `wp-content/` — pick one plugin.
- **Trusting counts as verdicts.** See the split above.
- **Missing dynamic hooks** and then "safely" renaming one. Grep for the literal *and*
  the interpolated form before touching any hook name.
- **A truncated scan.** `WARNING: file scan hit the --max-files cap` means counts are a
  lower bound; raise `--max-files` or scan a subdirectory.
- **Text domain mismatch warning ignored.** It means those strings never translate — a
  real user-facing bug, usually worth reporting even if unrelated to your task.

## Escalation

Ask the user when the plugin has no `Requires at least` / `Requires PHP` headers and the
task's API choice depends on them, or when the repo contains several plugins and the
target is ambiguous.

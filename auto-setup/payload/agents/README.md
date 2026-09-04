# wp-custom-agent-skills — Codex + Antigravity bundle

Generated. Do not edit files here; edit the source in `skills/`, `commands/`, `agents/`
at the repo root and run `node scripts/build-bundles.mjs`.

## Install into your plugin

Copy the **contents of this folder** into `<your-plugin>/.agents/` in your WordPress plugin repo:

```
<your-plugin>/.agents/
  skills/
  workflows/
```

Commit it, and every developer on that repo gets the same workflow — no per-machine setup.

### Already have that folder?

**Keep it. Delete nothing.** Copy the *contents* of this folder into it. Folders of the
same name merge, and every name shipped here is prefixed `cp-`, so it cannot collide
with a skill you already have — your own skills and the official WordPress `wp-*` skills
sit beside it untouched.

The one file that could overwrite something is this `README.md` at the bundle root. If
you already have one there, copy just the subfolders instead.

On Windows, Explorer asks whether to *merge* folders — say yes.

## How commands work here

workflows/  ->  Antigravity: type /cp-spec in chat
skills/     ->  Codex: type $cp-spec (Codex uses $ for skills, not /)

## The official WordPress skills (optional but recommended)

This bundle contains the Codex + Antigravity workflow layer only. The official WordPress
knowledge skills (hooks, REST, blocks, WP-CLI, Playground) are **not** included — they are
someone else's work and we ship no redistribution terms for them.

To add them:

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/* <your-plugin>/.agents/skills/
```

Without them everything still runs; the skills fall back to general WordPress practice and
say so rather than pretending.

## The scanner

Skills invoke the deterministic plugin scanner at:

```
.agents/skills/cp-context-discovery/scripts/plugin_context.mjs
```

That path is baked for this bundle's layout. Requires Node; no PHP needed to run it.

## Status

Format verified against this tool's published documentation.

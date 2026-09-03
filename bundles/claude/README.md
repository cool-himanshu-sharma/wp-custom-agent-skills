# wp-custom-agent-skills — Claude Code bundle

Generated. Do not edit files here; edit the source in `skills/`, `commands/`, `agents/`
at the repo root and run `node scripts/build-bundles.mjs`.

## Install into your plugin

Copy the **contents of this folder** into `<your-plugin>/.claude/` in your WordPress plugin repo:

```
<your-plugin>/.claude/
  skills/
  commands/
  agents/
```

Commit it, and every developer on that repo gets the same workflow — no per-machine setup.

## How commands work here

commands/  ->  type /wp-spec in chat

## The official WordPress skills (optional but recommended)

This bundle contains the Claude Code workflow layer only. The official WordPress
knowledge skills (hooks, REST, blocks, WP-CLI, Playground) are **not** included — they are
someone else's work and we ship no redistribution terms for them.

To add them:

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/* <your-plugin>/.claude/skills/
```

Without them everything still runs; the skills fall back to general WordPress practice and
say so rather than pretending.

## The scanner

Skills invoke the deterministic plugin scanner at:

```
.claude/skills/wp-context-discovery/scripts/plugin_context.mjs
```

That path is baked for this bundle's layout. Requires Node; no PHP needed to run it.

## Status

Format verified against this tool's published documentation.

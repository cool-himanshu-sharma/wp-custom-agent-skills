# wp-custom-agent-skills — Antigravity bundle

Generated. Do not edit files here; edit the source in `skills/`, `commands/`, `agents/`
at the repo root and run `node scripts/build-bundles.mjs`.

## Install into your plugin

Copy the **contents of this folder** into `<your-plugin>/.agent/` in your WordPress plugin repo:

```
<your-plugin>/.agent/
  skills/
  workflows/
```

Commit it, and every developer on that repo gets the same workflow — no per-machine setup.

## How commands work here

workflows/  ->  type /cp-spec in chat

## The official WordPress skills (optional but recommended)

This bundle contains the Antigravity workflow layer only. The official WordPress
knowledge skills (hooks, REST, blocks, WP-CLI, Playground) are **not** included — they are
someone else's work and we ship no redistribution terms for them.

To add them:

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/* <your-plugin>/.agent/skills/
```

Without them everything still runs; the skills fall back to general WordPress practice and
say so rather than pretending.

## The scanner

Skills invoke the deterministic plugin scanner at:

```
.agent/skills/cp-context-discovery/scripts/plugin_context.mjs
```

That path is baked for this bundle's layout. Requires Node; no PHP needed to run it.

## Status — UNVERIFIED

This bundle follows Antigravity's documented layout, but has **not** been
confirmed by loading it in Antigravity. Treat it as a starting point: if the
commands do not appear, check that tool's current docs for the directory it reads and
adjust `TARGETS` in `scripts/build-bundles.mjs`.

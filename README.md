# wp-custom-agent-skills

An engineering-grade operating system for AI coding agents working on professional
WordPress plugins.

Not a prompt library. Lifecycle **commands** route to WordPress-specific workflow
**skills**, which delegate to the official WordPress knowledge skills and to your own
company conventions, and close every loop with **deterministic tooling** — PHPCS,
PHPStan, PHPUnit, WP-CLI, Playground.

```
USER REQUEST → TRIAGE → PLUGIN CONTEXT → SPEC → PLAN → BUILD → TEST
             → STATIC ANALYSIS → SECURITY → PERFORMANCE → REVIEW → SHIP
```

---

## The problem it solves

Two good things existed, and neither was sufficient alone:

- **Generic agent engineering systems** encode a real lifecycle — spec, plan, build,
  test, review, ship — but know nothing about WordPress. They will happily approve a
  settings handler with no capability check, because generically it looks fine.
- **The official WordPress agent skills** encode real WordPress knowledge — hooks, REST,
  blocks, WP-CLI — but have **no lifecycle**. There is no specification step, no planning,
  no code review, no release gate. They tell an agent *what WordPress is*, not *how to
  engineer with it*.

`wp-custom-agent-skills` is the missing middle: WordPress-native lifecycle discipline.

Its skills are not wrappers around generic ones. `wp-specification` asks WordPress
questions — which hooks become permanent public API, options or a custom table, which
capability gates this, what happens on multisite, what happens to a site upgrading from
the previous version. Those decisions have no generic equivalent.

---

## Architecture

Four layers, with an explicit precedence rule. See [ARCHITECTURE.md](ARCHITECTURE.md).

```
L1  Engineering methodology     this repo's wp-* lifecycle skills
L2  WordPress knowledge         official WordPress/agent-skills (consumed, not forked)
L3  Company conventions         derived from your real repos, never invented
L4  Deterministic enforcement   PHPCS · PHPStan · PHPUnit · WP-CLI · Playground · git

precedence:  L4 evidence > L3 convention > L2 practice > L1 methodology
```

The design principle throughout: **knowledge, workflow, and enforcement are three
different things.** Documentation is knowledge. Skills are workflow. Tests and linters are
enforcement. Skills that try to be all three become documents nobody loads.

A corollary the system takes seriously: **scripts produce facts, skills produce verdicts.**
`plugin_context.mjs` reports `permission_callback __return_true: 1`. It never says
"insecure". `wp-security-review` is what turns that fact into a Critical finding with an
attack path. Keeping the split is what stops an agent saying "the code looks secure."

---

## Install — copy one folder into your plugin

Each supported agent has a ready-made folder under `bundles/`. Copy the **contents** of
the one you use into your WordPress plugin repo, commit it, and everyone working on that
plugin gets the same workflow.

| Your agent | Copy `bundles/…` | Into your plugin | Commands appear as |
|---|---|---|---|
| **Claude Code** | `bundles/claude/*` | `<plugin>/.claude/` | `/wp-spec` |
| **Cursor** | `bundles/cursor/*` | `<plugin>/.cursor/` | `/wp-spec` |
| **Codex** | `bundles/codex/*` | `<plugin>/.codex/` | `/prompts:wp-spec` |
| **Antigravity** | `bundles/antigravity/*` | `<plugin>/.agent/` | `/wp-spec` |

```bash
cp -r wp-custom-agent-skills/bundles/claude/*  my-plugin/.claude/
cd my-plugin && git add .claude && git commit -m "chore: add wp-custom-agent-skills"
```

Nothing is installed into your machine's global config. Everything lives in the plugin
repo, versioned with the plugin, and travels with a clone.

### Adding the official WordPress skills (optional)

Bundles ship our workflow layer only. The official WordPress knowledge skills are not
included — they are someone else's work and we ship no redistribution terms for them:

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/* my-plugin/.claude/skills/
```

They are gitignored in this repo and excluded from every bundle, so we never redistribute
them.

Without them everything still runs; the skills fall back to general WordPress practice and
say so rather than pretending.

### Rebuilding the bundles

`bundles/` is **generated** from `skills/`, `commands/` and `agents/`. Never edit a file
under `bundles/` — change the source and rebuild:

```bash
node scripts/build-bundles.mjs
node scripts/verify.mjs          # fails if bundles/ drifted from source
```

The staleness check is the point: a committed generated folder is only trustworthy if
being out of date is a hard failure.

---

## Sharing with your team

Put this repo on your git host. Teammates clone it once and copy the bundle for their
agent into whichever plugin they are working on.

```bash
git clone <your-repo-url> wp-custom-agent-skills
cp -r wp-custom-agent-skills/bundles/claude/*  my-plugin/.claude/
```

Because the bundle is committed **inside the plugin repo**, everyone who clones that
plugin gets the same workflow automatically — no per-machine setup, and the process is
versioned alongside the code it governs.

### Updating

Pull `wp-custom-agent-skills`, then re-copy the bundle into the plugin and commit the
diff. The diff is reviewable, which is the point: a change to how the team engineers
should be as visible as a change to the code.

### What is deliberately not included

Bundles carry our workflow layer only. The official WordPress knowledge skills are not
redistributed here — they are someone else's work and we ship no terms for them. Each
bundle README has the one command to add them.

---

## How commands work on each agent

Every supported agent has a `/` mechanism, but each expresses it differently. The build
renders the same source four ways so the commands feel native everywhere:

| Agent | Commands live in | You type | Status |
|---|---|---|---|
| **Claude Code** | `commands/*.md` | `/wp-spec` | verified |
| **Cursor** | skills with `disable-model-invocation: true` | `/wp-spec` | format verified |
| **Codex** | `prompts/*.md` | `/prompts:wp-spec` | **unverified** |
| **Antigravity** | `workflows/*.md` | `/wp-spec` | **unverified** |

The skills themselves are identical across all four — plain `SKILL.md` files, which every
one of these tools reads. Only the command wrapper differs.

**Unverified** means the bundle follows that tool's published layout but has not been
confirmed by loading it. If the commands do not appear, it is a one-line path fix in
`TARGETS` in `scripts/build-bundles.mjs`. Antigravity's docs are inconsistent between
`.agent/` and `.agents/`; the bundle uses `.agent/`.

To add another agent, add an entry to `TARGETS` and rebuild — no skills need rewriting.

---

## Commands

| Command | Does |
|---|---|
| `/wp-triage` | Classify the task, choose Direct / Standard / Full depth |
| `/wp-context` | Build the Plugin Context Record from a real scan |
| `/wp-spec` | WordPress-shaped spec: surface, data model, capabilities, public API, i18n |
| `/wp-plan` | Ordered tasks with WordPress sequencing rules |
| `/wp-build` | Implement with guardrails at write time (`auto` runs the whole plan) |
| `/wp-test` | PHPUnit / wp-env / Playwright / Playground; prove-it order for bugs |
| `/wp-review` | Seven-axis review including public API and i18n |
| `/wp-security` | Enumerate entry points, five questions each |
| `/wp-perf` | Measure, fix in cost order, re-measure |
| `/wp-debug` | Reproduce → isolate → root cause → guard |
| `/wp-release` | Version, readme, build, full gate, tag, rollout |
| `/wp-feature` | The whole lifecycle, with gates |
| `/wp-bootstrap-conventions` | Derive the company layer from your real repos |

## Skills

**Lifecycle (L1)** — `wp-agent-os` (router) · `wp-task-triage` · `wp-context-discovery` ·
`wp-specification` · `wp-planning` · `wp-implementation` · `wp-testing` ·
`wp-static-analysis` · `wp-security-review` · `wp-performance-review` · `wp-code-review` ·
`wp-debugging` · `wp-release`

**Company (L3)** — `company-conventions-bootstrap` · `company-wp-conventions`

## Personas

`wp-code-reviewer` · `wp-security-auditor` · `wp-test-engineer` · `wp-standards-auditor`

Personas are review perspectives, not orchestrators. Composition belongs to commands.

---

## What this adds that upstream does not

The upstream `wordpress-router` routes to three skills it marks **(planned)**. Those are
exactly the gaps closed here:

| Upstream route | Upstream status | Here |
|---|---|---|
| `wp-security` | planned | `wp-security-review` + a full vulnerability-class checklist |
| `wp-testing` | planned | `wp-testing` + a minimal wp-env/PHPUnit setup |
| `wp-build-tooling` | planned | `wp-static-analysis` (PHPCS, PHPStan, PHP compatibility) |

Beyond those, upstream has no lifecycle layer at all. That is the larger gap.

Full delegation table: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Deterministic tooling

| Script | Does |
|---|---|
| `plugin_context.mjs` | Scans a plugin → identity, public surface, storage, security signals, toolchain. Facts only. |
| `scripts/build-bundles.mjs` | Renders source into per-agent, ready-to-copy bundles |
| `scripts/verify.mjs` | Structural checks on this plugin — front matter, name/dir agreement, routing targets, link resolution |

```bash
node .claude/skills/wp-context-discovery/scripts/plugin_context.mjs ./my-plugin
node .claude/skills/wp-context-discovery/scripts/plugin_context.mjs ./my-plugin --json
```

`verify.mjs` exists because this system tells agents to produce evidence rather than
assertions, and it should hold itself to that rule.

---

## Evals

A skill that does not change agent behavior is documentation. [evals/](evals/) contains
cases written so a skill-less agent has a **specific, predictable failure** — including
`fixtures/acme-license-manager`, a small plugin with four planted defects.

Cases track **No-op** separately from **Fail**: a failing skill has wrong content, while a
no-op skill is not being loaded at all. Those need different fixes.

---

## Reference material

- [skills/wp-agent-os/references/definition-of-done.md](skills/wp-agent-os/references/definition-of-done.md)
  — the bar every change clears, and the honesty rule underneath it
- [skills/wp-implementation/references/plugin-architecture.md](skills/wp-implementation/references/plugin-architecture.md)
  — bootstrap, load order, storage decisions, lifecycle, extensibility
- [skills/wp-implementation/references/coding-standards.md](skills/wp-implementation/references/coding-standards.md)
  — what PHPCS cannot check
- [ARCHITECTURE.md](ARCHITECTURE.md) — the four layers, precedence, and the upstream delegation table

---

## Status

`company-wp-conventions` (L3) ships **empty by design** and reports that it is empty.
Nobody outside your organisation can write it, and a guessed convention is worse than an
absent one — it gets copied into every new plugin and becomes true by accident. Run
`/wp-bootstrap-conventions` against two or more real repositories to derive it from
evidence.

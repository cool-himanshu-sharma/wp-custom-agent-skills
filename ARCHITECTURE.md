# Architecture

`wp-custom-agent-skills` is not a prompt library. It is an **operating model** for agents doing
professional WordPress plugin work. Its whole design follows from one idea:

> Knowledge, workflow, and enforcement are three different things, and mixing them
> is why most agent skill collections quietly fail.

| Concern | Question it answers | Where it lives | Failure if you skip it |
|---|---|---|---|
| **Knowledge** | What *is* WordPress? What is *this* plugin? | `references/`, the official WP skills, the Plugin Context Record | Agent invents APIs that don't exist |
| **Workflow** | How should the agent *do* engineering work? | `skills/`, `commands/` | Agent jumps straight to editing code |
| **Enforcement** | How do we *prove* the result is correct? | PHPCS, PHPStan, PHPUnit, WP-CLI, Playground | Agent says "looks correct" and ships a fatal |

A skill that tries to be all three becomes a 900-line document nobody loads and the
agent half-follows. Keeping them separate is what makes the system composable.

---

## The four layers

```
        ┌──────────────────────────────────────────────┐
  L1    │  ENGINEERING METHODOLOGY                     │
        │  spec → plan → build → test → review → ship  │
        │  (lifecycle discipline, WordPress-flavoured) │
        └──────────────────────┬───────────────────────┘
                               │ delegates to
        ┌──────────────────────▼───────────────────────┐
  L2    │  WORDPRESS ENGINEERING KNOWLEDGE             │
        │  hooks, Settings API, REST, blocks, WP-CLI,  │
        │  Playground, plugin directory guidelines     │
        │  → the official WordPress/agent-skills repo  │
        └──────────────────────┬───────────────────────┘
                               │ constrained by
        ┌──────────────────────▼───────────────────────┐
  L3    │  COMPANY CONVENTIONS                         │
        │  our plugin architecture, licensing, admin   │
        │  UI, i18n, shared libraries, release process │
        │  → DERIVED from our real repos, not invented │
        └──────────────────────┬───────────────────────┘
                               │ verified by
        ┌──────────────────────▼───────────────────────┐
  L4    │  DETERMINISTIC ENFORCEMENT                   │
        │  PHPCS · PHPStan · PHPUnit · Playwright      │
        │  WP-CLI · Playground · git · CI              │
        └──────────────────────────────────────────────┘
```

### Precedence rule

When layers disagree, **the more specific layer wins** — but the agent must say so out loud:

```
L4 evidence  >  L3 company convention  >  L2 WordPress practice  >  L1 general methodology
```

A failing PHPStan run beats a company convention. A company convention beats a generic
WordPress idiom. A generic WordPress idiom beats a generic software-engineering instinct.
The one thing an agent may never do is silently resolve the conflict — see
`skills/wp-agent-os/references/definition-of-done.md`.

---

## Why we consume L2 rather than copy it

The official `WordPress/agent-skills` repository is the canonical WordPress knowledge
layer. Forking it means inheriting a maintenance burden and drifting from upstream the
first time WordPress ships a new API.

So `wp-custom-agent-skills` **delegates by name**. Our skills say "read `wp-rest-api` for route
registration detail" instead of restating it. Developers copy the upstream skills in
alongside ours; they stay untracked, and `build-bundles.mjs` excludes anything untracked
so we never redistribute them.

We add only what upstream does not have. The upstream router itself names three gaps —
it routes to `wp-security`, `wp-testing`, and `wp-build-tooling` and marks each
`(planned)`. Those are exactly the skills this repo supplies as
`wp-security-review`, `wp-testing`, and (inside `wp-static-analysis`) the build/lint
toolchain. The full delegation table is below.

---

## Upstream delegation map

`wp-custom-agent-skills` supplies **lifecycle and enforcement discipline**. It does not restate
WordPress API knowledge — the official `WordPress/agent-skills` repository is the
canonical source for that, and forking it would guarantee drift.

## How the layers meet

```
wp-agent-os skill (L1: how to work)
        │ delegates for API detail
        ▼
official WordPress skill (L2: what WordPress is)
```

## Delegation table

| When you need | Load (upstream) | Our skill that delegates |
|---|---|---|
| Repo kind classification (theme? site? core?) | `wordpress-router` | `wp-agent-os` |
| Deterministic repo inspection | `wp-project-triage` | `wp-context-discovery` |
| Plugin structure, lifecycle, Settings API | `wp-plugin-development` | `wp-implementation` |
| REST routes, controllers, schema | `wp-rest-api` | `wp-implementation` |
| Blocks, `block.json`, save/edit | `wp-block-development` | `wp-implementation` |
| Front-end directives | `wp-interactivity-api` | `wp-implementation` |
| Block themes, `theme.json` | `wp-block-themes` | — (not plugin work) |
| Block patterns | `wp-patterns` | — |
| Admin component design system | `wpds` | `wp-implementation` |
| WP-CLI commands and ops | `wp-wpcli-and-ops` | `wp-implementation`, `wp-debugging` |
| Profiling and measurement | `wp-performance` | `wp-performance-review` |
| PHPStan configuration and baselines | `wp-phpstan` | `wp-static-analysis` |
| Playground environments | `wp-playground` | `wp-testing`, `wp-debugging` |
| Blueprint JSON | `blueprint` | `wp-testing` |
| .org directory rules, GPL, upsell | `wp-plugin-directory-guidelines` | `wp-release` |
| Abilities API | `wp-abilities-api` / `-audit` / `-verify` | — (load directly) |

## Gaps we fill

The upstream `wordpress-router` routes to three skills it marks **(planned)**. Those are
exactly the gaps this repo closes:

| Upstream route | Status upstream | Provided here |
|---|---|---|
| `wp-security` | planned | **`wp-security-review`** + `skills/wp-security-review/references/checklist.md` |
| `wp-testing` | planned | **`wp-testing`** + `skills/wp-testing/references/setup.md` |
| `wp-build-tooling` | planned | **`wp-static-analysis`** (PHPCS/PHPStan/compat) |

Beyond those, upstream has no lifecycle layer at all — no specification, planning,
implementation discipline, code review, debugging method, or release gate. That is the
larger gap `wp-custom-agent-skills` exists to fill.

## Rule

Do not copy upstream content into this repo. Cite the skill by name and let the agent load
it. Duplicated knowledge drifts, and a stale copy of a WordPress API doc is worse than no
copy — the agent cannot tell it is stale.

---

## Why the company layer is derived, not written

Nobody can write your company's conventions from the outside, and an agent that
*guesses* them is worse than one that admits it doesn't know: a confident wrong
convention gets copied into every new plugin.

So L3 ships as a **bootstrap procedure**, not as content.
`company-conventions-bootstrap` reads two or three of your real plugin repositories,
extracts the patterns that actually recur, presents them for confirmation, and writes
`company-wp-conventions/references/*.md`. Conventions that appear in one repo only are
reported as *candidates*, never promoted to rules. Until you run it, L3 is empty and the
system says so instead of inventing rules.

---

## Context efficiency

Loading every skill into context defeats the purpose — it burns budget and creates
conflicting instructions. Three mechanisms keep the working set small:

1. **Progressive disclosure.** Each `SKILL.md` is short. Depth lives in `references/*.md`
   that the agent reads only on the branch it actually took.
2. **Trigger-shaped descriptions.** Every skill's `description` front-matter names the
   concrete artifacts and phrases that should summon it, so the runtime can pick one
   skill instead of the agent loading all of them to decide.
3. **A router with an exit.** `wp-task-triage` chooses a *workflow depth* (see below) and
   explicitly names the skills that are **not** needed for this task.

## Workflow depth

Not every task deserves the full lifecycle. Forcing `/wp-spec` on a typo is how teams
abandon a process. `wp-task-triage` picks one of three depths:

| Depth | For | Path |
|---|---|---|
| **Direct** | typo, copy change, version bump | context → implement → static analysis → review |
| **Standard** | bug fix, contained feature | + test-first, security & performance review |
| **Full** | new user-facing surface, data model change, new REST/CLI API | the complete `/wp-feature` chain |

Escalation is always allowed and always announced. De-escalation is not: once a task
touches a capability check, a database write, or user input, it is Standard at minimum.

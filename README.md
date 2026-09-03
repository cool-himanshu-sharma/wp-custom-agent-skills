# wp-custom-agent-skills

A shared engineering workflow for AI coding agents working on WordPress plugins.

Copy one folder into your plugin repo and your agent — Claude Code, Cursor, Codex or
Antigravity — starts following the same WordPress process everyone else on the team
follows.

---

## What this actually is

AI agents are good at writing PHP. They are much less good at writing PHP that belongs in
a WordPress plugin.

Left alone, an agent will cheerfully save a settings form with no capability check, build
a query without `$wpdb->prepare()`, rename a hook that other plugins depend on, or echo a
variable straight into HTML. None of that looks wrong on its own. All of it is wrong in
WordPress.

`wp-custom-agent-skills` is the missing process layer. It is a set of written instructions
— **skills** — that teach an agent *how to engineer a WordPress plugin properly*: what to
check before writing code, what to prove afterwards, and when to stop and say a change is
not safe to ship.

> **In one line:** it turns an agent that writes plausible WordPress code into one that
> follows a WordPress engineering process.

### What you get

| | |
|---|---|
| **13 commands** | Typed in chat — `/wp-spec`, `/wp-build`, `/wp-security`, `/wp-release` … each starts a defined piece of work |
| **15 skills** | Loaded by the agent automatically when relevant — security review, testing, debugging, release |
| **4 review personas** | Focused reviewers: code reviewer, security auditor, test engineer, standards auditor |
| **1 scanner** | Reads your plugin and reports facts — hooks, REST routes, options, missing nonces |

### What it is not

- **Not a WordPress plugin.** Nothing here runs on your site. These are instruction files
  your AI agent reads while you work.
- **Not a prompt library.** You do not copy-paste prompts. The agent loads the right skill
  on its own.
- **Not a replacement for human review.** See [the note at the end](#a-note-on-responsibility).

---

## What is inside this repo

```
wp-custom-agent-skills/
│
├── skills/        ← THE SOURCE. 15 skills, one folder each, containing a SKILL.md.
│                    Some carry references/ (deeper docs, loaded only when needed)
│                    and scripts/ (the plugin scanner).
│
├── commands/      ← The 13 /wp-* commands developers type in chat.
├── agents/        ← The 4 review personas.
├── evals/         ← Tests for the skills themselves, plus a deliberately broken
│                    fixture plugin used to check the skills actually catch bugs.
├── scripts/       ← build-bundles.mjs (generates bundles/) and verify.mjs (checks it).
│
├── bundles/       ← THE OUTPUT. This is the part developers copy.
│   ├── claude/         → copy into  <your-plugin>/.claude/
│   ├── cursor/         → copy into  <your-plugin>/.cursor/
│   ├── codex/          → copy into  <your-plugin>/.codex/
│   └── antigravity/    → copy into  <your-plugin>/.agent/
│
├── COMMANDS.md       ← Every command and skill explained in plain English.
├── ARCHITECTURE.md   ← How the system is designed, and why.
└── README.md         ← This file.
```

**The one rule:** `skills/`, `commands/` and `agents/` are the source you edit. `bundles/`
is **generated** from them — never edit anything inside `bundles/` by hand, because the
next build overwrites it.

Each bundle is the same workflow rewritten into the layout that agent expects:

| Bundle | Contains |
|---|---|
| `bundles/claude/` | `skills/` · `commands/` · `agents/` |
| `bundles/cursor/` | `skills/` (commands and personas become skills) |
| `bundles/codex/` | `skills/` · `prompts/` |
| `bundles/antigravity/` | `skills/` · `workflows/` |

---

## For developers — how to install it

You need **one folder**, copied **once**, into the plugin you are working on.

### Step 1 — get this repo

```bash
git clone <your-repo-url> wp-custom-agent-skills
```

### Step 2 — copy the bundle for your agent

Copy the **contents** of your bundle into the matching folder inside your plugin:

| If you use | Copy from | Paste into |
|---|---|---|
| **Claude Code** | `bundles/claude/*` | `<your-plugin>/.claude/` |
| **Cursor** | `bundles/cursor/*` | `<your-plugin>/.cursor/` |
| **Codex** | `bundles/codex/*` | `<your-plugin>/.codex/` |
| **Antigravity** | `bundles/antigravity/*` | `<your-plugin>/.agent/` |

```bash
# example — Claude Code
cp -r wp-custom-agent-skills/bundles/claude/*  my-plugin/.claude/
```

On Windows, dragging the folder contents across in Explorer does the same thing.

Afterwards your plugin looks like this:

```
my-plugin/
├── .claude/
│   ├── skills/
│   ├── commands/
│   └── agents/
├── my-plugin.php
└── includes/
```

### Step 3 — commit it

```bash
cd my-plugin
git add .claude
git commit -m "chore: add wp-custom-agent-skills"
```

This is the step that matters. Because the workflow lives **inside the plugin repo**,
every teammate who clones that plugin gets it automatically — no setup on their machine,
and the process is versioned next to the code it governs.

### Step 4 — restart your agent

Open your agent in the plugin folder. Type `/` and the `wp-*` commands appear.

---

## How to use it

Type a command in chat. The agent loads the matching skill and follows it.

> **New here?** [COMMANDS.md](COMMANDS.md) explains every command and skill in plain
> English — what each one does, which skill it runs, and when to use it.

| Command | What it does |
|---|---|
| `/wp-triage` | Sizes the task and picks how much process it needs |
| `/wp-context` | Scans the plugin and reports what is actually there |
| `/wp-spec` | Writes a WordPress-shaped spec — surface, data, capabilities, public API, i18n |
| `/wp-plan` | Breaks the spec into ordered tasks |
| `/wp-build` | Implements, with WordPress guardrails applied while writing |
| `/wp-test` | PHPUnit / wp-env / Playwright / Playground |
| `/wp-review` | Seven-axis code review |
| `/wp-security` | Finds every entry point and interrogates each one |
| `/wp-perf` | Measures, fixes in cost order, measures again |
| `/wp-debug` | Reproduce → isolate → root cause → guard |
| `/wp-release` | Version, readme, build, full gate, tag, rollout |
| `/wp-feature` | The whole lifecycle end to end, with gates |
| `/wp-bootstrap-conventions` | Learns your team's conventions from your real repos |

### A typical session

```
/wp-context                      first time in a plugin — see what you are dealing with
/wp-spec add license expiry notice
/wp-plan
/wp-build
/wp-security                     before anything touching input, output or the database
/wp-release
```

You do not have to use all of them. For a one-line bug fix, `/wp-debug` on its own is
fine — `/wp-triage` exists precisely so the process scales down as well as up.

### How commands appear on each agent

Every supported agent has a `/` mechanism, but each spells it differently. The build
renders the same source four ways so it feels native everywhere.

| Agent | You type | Status |
|---|---|---|
| **Claude Code** | `/wp-spec` | verified |
| **Cursor** | `/wp-spec` | format verified |
| **Codex** | `/prompts:wp-spec` | **unverified** |
| **Antigravity** | `/wp-spec` | **unverified** |

**Unverified** means the bundle follows that tool's published layout but nobody has
confirmed it by actually loading it. If the commands do not show up, it is a one-line path
fix in `TARGETS` in `scripts/build-bundles.mjs`. Antigravity's own docs disagree on
`.agent/` versus `.agents/`; the bundle uses `.agent/`.

### Adding the official WordPress skills (optional, recommended)

Bundles carry this workflow layer only. The official WordPress knowledge skills — hooks,
REST, blocks, WP-CLI, Playground — are **not** included, because they are someone else's
work and this repo ships no terms for them.

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/*  my-plugin/.claude/skills/
```

Everything still works without them; the skills fall back to general WordPress practice
and say so rather than pretending.

### Updating later

Pull this repo, re-copy the bundle into the plugin, and commit the diff. The diff is
reviewable, which is the point — a change to how the team engineers should be as visible
as a change to the code.

---

## For maintainers of this repo

Edit the source, then rebuild:

```bash
node scripts/build-bundles.mjs   # regenerates all four bundles
node scripts/verify.mjs          # fails if bundles/ drifted from source
```

`verify.mjs` checks front matter, that every skill's name matches its folder, that routing
targets exist, that links resolve, and that `bundles/` is current. A stale bundle is a hard
failure — that is the only thing which makes a committed generated folder trustworthy.

To support another agent, add an entry to `TARGETS` in `build-bundles.mjs` and rebuild. No
skills need rewriting.

---

## How it works underneath

Four layers, with an explicit precedence rule:

```
L1  Engineering methodology     this repo's wp-* lifecycle skills
L2  WordPress knowledge         official WordPress/agent-skills (used, not copied)
L3  Company conventions         derived from your real repos, never invented
L4  Deterministic enforcement   PHPCS · PHPStan · PHPUnit · WP-CLI · Playground · git

precedence:  L4 evidence > L3 convention > L2 practice > L1 methodology
```

Evidence outranks opinion. If PHPCS disagrees with a skill, PHPCS wins.

The design principle throughout: **knowledge, workflow and enforcement are three different
things.** Documentation is knowledge. Skills are workflow. Tests and linters are
enforcement. A skill that tries to be all three becomes a document nobody loads.

A corollary the system takes seriously: **scripts produce facts, skills produce verdicts.**
The scanner reports `permission_callback __return_true: 1`. It never says "insecure".
`wp-security-review` is what turns that fact into a Critical finding with an attack path.
Keeping the two apart is what stops an agent declaring "the code looks secure."

Full detail: [ARCHITECTURE.md](ARCHITECTURE.md).

### What this adds that the official skills do not

The official `wordpress-router` routes to three skills it marks **(planned)**. Those are
exactly the gaps closed here:

| Official route | Their status | Here |
|---|---|---|
| `wp-security` | planned | `wp-security-review` + a full vulnerability-class checklist |
| `wp-testing` | planned | `wp-testing` + a minimal wp-env/PHPUnit setup |
| `wp-build-tooling` | planned | `wp-static-analysis` (PHPCS, PHPStan, PHP compatibility) |

Beyond those, the official skills have no lifecycle layer at all — no spec step, no
planning, no review gate, no release gate. That is the larger gap this fills.

### The scanner

```bash
node .claude/skills/wp-context-discovery/scripts/plugin_context.mjs ./my-plugin
node .claude/skills/wp-context-discovery/scripts/plugin_context.mjs ./my-plugin --json
```

Reports identity, public surface, storage, security signals and toolchain. Facts only, no
opinions. Needs Node; no PHP required to run it.

### Evals

A skill that does not change what an agent does is just documentation. [evals/](evals/)
holds cases written so that an agent *without* the skills fails in a specific, predictable
way — including `fixtures/acme-license-manager`, a small plugin with four planted defects.

Cases track **No-op** separately from **Fail**: a failing skill has wrong content, while a
no-op skill was never loaded at all. Those need different fixes.

### Company conventions

`company-wp-conventions` ships **empty on purpose**, and reports that it is empty. Nobody
outside your organisation can write it, and a guessed convention is worse than an absent
one — it gets copied into every new plugin and becomes true by accident. Run
`/wp-bootstrap-conventions` against two or more of your real repositories to derive it
from evidence.

### Further reading

- [COMMANDS.md](COMMANDS.md) — every command and skill explained in plain English. Start
  here if you are new to the system
- [ARCHITECTURE.md](ARCHITECTURE.md) — the four layers, precedence, and which skill hands
  off to which
- [skills/wp-agent-os/references/definition-of-done.md](skills/wp-agent-os/references/definition-of-done.md)
  — the bar every change has to clear, and the honesty rule underneath it
- [skills/wp-implementation/references/plugin-architecture.md](skills/wp-implementation/references/plugin-architecture.md)
  — bootstrap, load order, storage decisions, lifecycle, extensibility
- [skills/wp-implementation/references/coding-standards.md](skills/wp-implementation/references/coding-standards.md)
  — the things PHPCS cannot check for you

---

## A note on responsibility

**These are skills, not guarantees. Every change is still a human's responsibility.**

This system makes an AI agent more careful about WordPress. It does not make it correct.
It cannot know your customers, your support history, the client site stuck on an ancient
PHP version, or the one filter a large customer quietly depends on.

Read that plainly:

- **An agent can follow every step and still be wrong.** A checklist completed
  confidently is not a verified change.
- **"The skill said it was fine" is not a review.** A human reads the diff before it
  merges. Every time.
- **The security and release steps are a floor, not a ceiling.** `/wp-security` catches
  common vulnerability classes. It does not catch all of them, and it has never seen your
  threat model.
- **Tests passing means the tests passed.** It does not mean the feature is right.
- **You own what you ship.** Your name is on the commit, your plugin is on the user's
  site, and your team answers the support ticket. None of that transfers to a tool.

Use this to work faster and forget less. Do not use it to stop thinking.

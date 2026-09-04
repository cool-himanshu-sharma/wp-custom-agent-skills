# auto-setup — install this workflow into your plugin

One folder, one command. Copy this folder into your WordPress plugin, run the script,
and your AI agent starts following the same WordPress engineering process as the rest of
the team.

You do not need to read the rest of this repository to use it.

---

## Do this

**1. Copy this whole `auto-setup` folder into your plugin.**

```
my-plugin/
├── auto-setup/          ← the folder you just copied
├── my-plugin.php
└── includes/
```

Copy the *whole folder*. `setup.mjs` needs the `payload/` next to it and will stop with a
clear message if you copy only the script.

**2. Run it.**

```bash
cd my-plugin
node auto-setup/setup.mjs
```

**3. Commit, and restart your agent.**

```bash
git add .claude .cursor .agents
git commit -m "chore: add wp-custom-agent-skills"
```

Type `/` in your agent and the `cp-*` commands appear. (Codex uses `$cp-*`, not `/` — it
reserves `/` for its own built-ins.)

**4. Delete `auto-setup/` from your plugin**, or keep it to re-run when a new version of
the workflow lands. Nothing reads it at runtime.

Requires Node. No PHP, no npm install, no dependencies.

---

## What it does

It looks at your repo and works out which agent you use:

| Your repo has | What happens |
|---|---|
| `.claude/`, `.cursor/` or `.agents/` already | Files are **added into** them |
| `.codex/` or `.agent/` (older names) | Counted as wanting Codex/Antigravity — installs to `.agents/`, and tells you why |
| None of those folders | All three are created (use `--agent=` to pick one) |

Then it copies in the workflow: **15 skills**, **13 commands**, **4 review personas**, and
the plugin scanner.

### If your plugin has a `.codex/` folder

Older releases of this workflow shipped `.codex/` and `.agent/` (singular). Testing showed
neither tool reads them: **Codex does not scan a project-level `.codex/`** — it reads
`.agents/skills/`, and its custom prompts are global-only (`~/.codex/prompts`, which by
OpenAI's design are "not shared through your repository"). Antigravity moved to `.agents/`
(plural).

So a `.codex/` folder is treated as a signal, not a destination. The installer:

- **selects** the Codex + Antigravity target, even if `.agents/` does not exist yet;
- **installs into `.agents/`**, where both tools will actually find the skills;
- **reports** the legacy folder, including how many stale `cp-*` files it still holds;
- **never writes to it and never deletes it** — cleaning up is your call, and it may hold
  files of your own.

Silently ignoring `.codex/` was the bug this fixes: a plugin with `.codex/` and no
`.agents/` got no Codex workflow at all, and the installer said nothing about why.

`--agent=codex` and `--agent=antigravity` are accepted as aliases and map to `.agents/`.


### It does not delete anything

This is the part worth being sure about, because the script runs inside your repo.

- **Nothing is deleted, ever.** No folder is replaced — folders merge.
- **It only writes inside `.claude/`, `.cursor/` and `.agents/`.** Nothing else in your
  repo is touched.
- **Every file it writes is prefixed `cp-`**, so it cannot collide with your own skills or
  with the official WordPress `wp-*` skills. The script enforces this at runtime: a file
  without a `cp-` segment in its path is refused rather than written.
- **Your existing `README.md` is safe.** Each bundle carries its own README, which would
  otherwise overwrite yours — it installs as `cp-README.md` instead.

Afterwards, everything you had is still there:

```
my-plugin/.claude/
├── skills/
│   ├── cp-security-review/     ← added
│   ├── cp-implementation/      ← added
│   ├── wp-rest-api/            ← official WordPress skill, untouched
│   └── my-own-skill/           ← yours, untouched
├── commands/
│   ├── cp-build.md             ← added
│   └── deploy.md               ← yours, untouched
└── agents/
```

Not sure? Run it with `--dry-run` first — it prints exactly what it would change and
writes nothing.

---

## Options

```bash
node auto-setup/setup.mjs                     # install into the current directory
node auto-setup/setup.mjs ../other-plugin     # install somewhere else
node auto-setup/setup.mjs --dry-run           # show the plan, write nothing
node auto-setup/setup.mjs --agent=claude      # one agent only
node auto-setup/setup.mjs --all               # all three, whatever is detected
node auto-setup/setup.mjs --no-overwrite      # only add missing files, refresh nothing
node auto-setup/setup.mjs --json              # machine-readable, for CI
node auto-setup/setup.mjs --help
```

| Agent | Folder | You type |
|---|---|---|
| Claude Code | `.claude/` | `/cp-spec` |
| Cursor | `.cursor/` | `/cp-spec` |
| Codex | `.agents/` | **`$cp-spec`** — dollar, not slash |
| Antigravity | `.agents/` | `/cp-spec` |

Legacy `.codex/` and `.agent/` folders are detected and redirected to `.agents/` — see
[above](#if-your-plugin-has-a-codex-folder).

Codex and Antigravity share `.agents/` because both read `.agents/skills/`. If your team
uses both, you install once.

Exit codes: `0` done · `2` bad usage or missing payload · `3` target unreadable.

---

## Updating later

Copy in a newer `auto-setup/` and run it again. Existing `cp-*` files are refreshed;
anything of yours is left alone. The result is a reviewable `git diff` — which is the
point, because a change to how the team engineers should be as visible as a change to the
code.

Use `--no-overwrite` if you have deliberately edited a `cp-*` file and want to keep it.

---

## What you get

Type a command; the agent loads the matching skill and follows it.

| Command | What it does |
|---|---|
| `/cp-triage` | Sizes the task and picks how much process it needs |
| `/cp-context` | Scans the plugin and reports what is actually there |
| `/cp-spec` | Writes a WordPress-shaped spec — surface, data, capabilities, public API, i18n |
| `/cp-plan` | Breaks the spec into ordered tasks |
| `/cp-build` | Implements, with WordPress guardrails applied while writing |
| `/cp-test` | PHPUnit / wp-env / Playwright / Playground |
| `/cp-review` | Seven-axis code review |
| `/cp-security` | Finds every entry point and interrogates each one |
| `/cp-perf` | Measures, fixes in cost order, measures again |
| `/cp-debug` | Reproduce → isolate → root cause → guard |
| `/cp-release` | Version, readme, build, full gate, tag, rollout |
| `/cp-feature` | The whole lifecycle end to end, with gates |
| `/cp-bootstrap-conventions` | Learns your team's conventions from your real repos |

Start with `/cp-context` in a plugin you have not worked on recently.

**Recommended:** also add the official WordPress knowledge skills — hooks, REST, blocks,
WP-CLI, Playground. They are not bundled here because they are someone else's work and
this ships no terms for them.

```bash
git clone https://github.com/WordPress/agent-skills
cp -r agent-skills/skills/* .claude/skills/
```

Everything works without them; the skills fall back to general WordPress practice and say
so rather than pretending.

---

## About `payload/`

`payload/` is generated from this repository's source by `scripts/build-bundles.mjs`, and
`scripts/verify.mjs` fails the build if it drifts. Do not edit files inside it — edit the
source in `skills/`, `commands/`, `agents/` and rebuild.

---

## One last thing

These skills make an AI more careful about WordPress. They do not make it correct. A
human still reads the diff before it merges — see the note on responsibility in the main
[README](../README.md#a-note-on-responsibility).

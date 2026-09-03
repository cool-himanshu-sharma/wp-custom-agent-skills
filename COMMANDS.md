# Commands and Skills — a simple guide

This page explains every command you can type and every skill behind it, in plain words.

---

## First, the basics

There are three kinds of thing in this system.

**Commands** are what *you* type in chat. They start with a slash, like `/cp-security`.
Think of them as buttons.

> **One exception — Codex uses `$`, not `/`.** Codex reserves `/` for its own built-in
> commands, and reaches skills with `$` instead: `$cp-security`. Everything below works
> the same, you just type `$` where this page says `/`. You can also simply describe what
> you want in plain words — Codex picks the matching skill on its own.

**Skills** are instruction files that the *AI agent* reads. You never type a skill name.
When you press a button (a command), the agent opens the matching instruction file and
follows it step by step.

**Personas** are reviewers with one job each. A security reviewer only looks at security.
Nothing else distracts it.

So the flow is always the same:

```
You type a command   →   The agent opens a skill   →   The agent follows those steps
```

The command is short. The skill is where all the real knowledge lives. This is on purpose:
you only have to remember 13 short commands, and the WordPress rules stay in one place.

---

## Quick reference

| You type | It runs this skill | In one line |
|---|---|---|
| `/cp-triage` | `cp-task-triage` | Decides how big the job is before starting |
| `/cp-context` | `cp-context-discovery` | Looks at your plugin and reports what is inside it |
| `/cp-spec` | `cp-specification` | Writes down what will be built, before building |
| `/cp-plan` | `cp-planning` | Splits the work into small tasks in the right order |
| `/cp-build` | `cp-implementation` | Writes the code, with WordPress safety rules applied |
| `/cp-test` | `cp-testing` | Writes and runs tests to prove the code works |
| `/cp-security` | `cp-security-review` | Hunts for security holes |
| `/cp-review` | `cp-code-review` | Reviews the change like a senior developer would |
| `/cp-perf` | `cp-performance-review` | Finds what is making the site slow, and fixes it |
| `/cp-debug` | `cp-debugging` | Finds the real cause of a bug |
| `/cp-release` | `cp-release-process` | Prepares a safe release |
| `/cp-feature` | *(runs many skills in order)* | Does the whole job from start to finish |
| `/cp-bootstrap-conventions` | `cp-conventions-bootstrap` | Learns your team's style from your real plugins |

Three more skills run **automatically**. You never type them:
`cp-agent-os`, `cp-static-analysis`, `cp-conventions`. They are explained
[further down](#the-3-skills-you-never-type).

---

## The commands, one by one

### `/cp-triage`

**Runs the skill:** `cp-task-triage`

**What the skill does:** It decides how much work a job really needs, before anyone
touches code. It asks six questions about the task:

1. Does it read anything a user typed?
2. Does it save or change data?
3. Does it change something other plugins might be using?
4. Does it run on every page visit?
5. Does it involve permissions or security tokens?
6. Can it be undone if it goes wrong?

Based on the answers, it picks one of three levels:

| Level | When | What happens |
|---|---|---|
| **Direct** | All six answers are "no" | Just look, build, check, review |
| **Standard** | Task touches user input or saves data | Adds tests and a security check |
| **Full** | Task changes the public surface, or cannot be undone | The whole process, starting with a written spec |

**Why it matters:** Without this, an AI does the same amount of work for a typo as it does
for a new payment feature. This makes small jobs quick and big jobs careful.

**Use it when:** You are not sure how serious a task is. Or always, at the start.

---

### `/cp-context`

**Runs the skill:** `cp-context-discovery`

**What the skill does:** It runs a scanner over your plugin and reports the facts:

- The plugin name, version, and which WordPress and PHP versions it needs
- The prefix your code uses (like `acme_`) and your text domain
- Every hook, REST route, shortcode and CLI command your plugin offers
- Where the plugin stores things — options, custom tables, transients, cron jobs
- Whether PHPCS, PHPStan and PHPUnit are actually installed here

**Why it matters:** An AI that has not looked at your plugin will guess. It will invent a
prefix, or add an option that already exists, or write code in a style that does not match
the rest of your plugin. This stops all of that.

Important: the scanner only reports **facts**. It will say "1 REST route is open to
everyone." It will never say "this is insecure." Judging is the job of `/cp-security`.

**Use it when:** You start work on a plugin you have not touched in a while. It is the
first thing to run in a new plugin.

---

### `/cp-spec`

**Runs the skill:** `cp-specification`

**What the skill does:** It writes down exactly what will be built, before any code is
written. It covers nine things:

1. What it is for, and who uses it
2. Where it appears — admin page, front end, REST, WP-CLI
3. Where data will be stored — an option, post meta, or a custom table
4. Who is allowed to use it (permissions)
5. Which new hooks it adds that other developers could use
6. Translation
7. Multisite, and older versions still being supported
8. How you will know it is finished (acceptance criteria)
9. What is deliberately *not* included

**Why it matters:** Some decisions are very expensive to change later. Once you release a
hook name or an option name, other people's code depends on it forever. This forces those
choices to be made on purpose instead of by accident.

**Use it when:** Someone asks for a new feature and there is no written plan.

---

### `/cp-plan`

**Runs the skill:** `cp-planning`

**What the skill does:** It takes the spec and breaks it into small tasks, in an order that
works for WordPress. For each task it writes down what it delivers, what it depends on,
which files it touches, and the exact command that proves it works.

The ordering rules are the important part:

- Database changes come **before** the code that writes to the database
- Permission checks come **before** the screen that uses them
- Server code comes **before** the JavaScript that calls it
- Backwards-compatibility shims come **before** renaming anything

**Why it matters:** Get the order wrong and you can ship a half-finished database change to
real sites.

**Use it when:** A feature is too big to build in one go.

Note: this command will refuse to run without a spec. That is on purpose — it will not
invent requirements.

---

### `/cp-build`

**Runs the skill:** `cp-implementation`

**What the skill does:** It writes the actual code, applying WordPress safety rules *while
typing*, not afterwards. The order it always follows for anything handling a form or
request:

```
1. Check the user is allowed to do this      (capability check)
2. Check the user really clicked your button (nonce)
3. Clean the incoming data                   (unslash + sanitize)
4. Do the work
5. Make data safe before showing it          (escape on output)
```

It also prefixes every function and option, translates every visible string, and avoids
changing anything other plugins might depend on.

**Two ways to run it:**

- `/cp-build` — does the next task, then stops so you can look
- `/cp-build auto` — does every task in the plan after you approve once

**Why it matters:** It is far cheaper to write code correctly than to find the mistake in
review a week later.

**Use it when:** You have a plan and it is time to write code.

---

### `/cp-test`

**Runs the skill:** `cp-testing`

**What the skill does:** It picks the cheapest kind of test that can actually prove the
behaviour — PHPUnit, wp-env, Playwright for browser testing, Jest for block JavaScript, or
a WordPress Playground link for a quick reproduction.

**For bugs it follows a strict order:**

1. Write a test that fails **for the reason in the bug report**
2. Show the failure
3. Confirm it fails because of the bug, not because the test is wrong
4. Fix it with the smallest possible change
5. Show the test now passes

**Why it matters:** Step 3 is the one people skip. Without it, you can "fix" something that
was never broken and never notice.

**Use it when:** Fixing a bug, or adding tests to a plugin that has none.

---

### `/cp-security`

**Runs the skill:** `cp-security-review`

**What the skill does:** First it runs the automated security checks. Then it makes a list
of **every** way data can get into your plugin from outside:

- AJAX handlers (including the ones logged-out users can reach)
- Every REST route and method
- Form handlers and `admin_post_` actions
- Shortcodes that read from the URL
- Webhooks and scheduled jobs

Then it asks the same questions about each one, and reports problems with a real example of
how someone could abuse them.

**The thing it catches most often:** people confuse two different checks.

| Check | What it proves |
|---|---|
| **Nonce** | The user really clicked your button, and did not get tricked by another site |
| **Capability check** | The user is actually allowed to do this |

A nonce is **not** a permission check. A logged-in subscriber gets a valid nonce too. You
need both, every time.

**Use it when:** Before any release, and any time a change touches user input, saved data,
or permissions.

---

### `/cp-review`

**Runs the skill:** `cp-code-review`

**What the skill does:** Reviews a change the way a senior WordPress developer would, across
seven areas:

1. **Correctness** — does it do what was asked, including edge cases?
2. **WordPress correctness** — hooks, load order, activation, multisite
3. **Security**
4. **Performance**
5. **Public surface** — does this break anything other people rely on?
6. **Translation and accessibility**
7. **Readability**

**Why it matters:** Points 5 and 6 are the ones a general-purpose AI does not know to
check. Renaming a filter looks harmless in your own code. It breaks every site that was
using it.

**Use it when:** Before merging any change.

---

### `/cp-perf`

**Runs the skill:** `cp-performance-review`

**What the skill does:** It measures **first**, then fixes, then measures again. It looks
for the usual WordPress causes of slowness:

- Large options set to autoload, which load on every single page
- Database queries inside loops
- Meta queries with no index
- Remote API calls with no caching
- Work being done on every request that could be done once
- Cron jobs piling up
- CSS and JS loaded on pages that do not need them

**Why it matters:** Its own rule is blunt: *any optimisation without a before-number is a
guess.* Without a measurement you cannot tell whether you helped or hurt.

**Use it when:** A site is slow, or before a release.

---

### `/cp-debug`

**Runs the skill:** `cp-debugging`

**What the skill does:** Four steps, in order:

1. **Get the real error.** Turn on `WP_DEBUG_LOG` and read `debug.log`. Never guess at a
   white screen — get the error text.
2. **Try to reproduce it in a clean site** — only this plugin, default theme.
   - If it **does** happen → the bug is in your plugin. Keep going.
   - If it **does not** happen → it is a conflict with another plugin, theme, or that
     site's settings. Now go and find which one.
3. **Find the real cause**, not the symptom.
4. **Add a test** so the same bug cannot come back.

**Why it matters:** Step 2 saves the most time. It tells you within minutes whether you are
even looking in the right place.

**Use it when:** Something is broken — white screen, fatal error, settings not saving, a
hook not firing, a REST route returning 404 or 403.

---

### `/cp-release`

**Runs the skill:** `cp-release-process`

**What the skill does:** Walks the full release checklist and treats anything unticked as a
blocker:

1. Choose the version bump — patch, minor or major
2. Update the version number **everywhere** it appears
3. Update `readme.txt` and the changelog
4. Build translations and assets
5. Run every check — tests, PHPCS, PHPStan
6. Build a clean zip with no development files in it
7. Tag the release and plan the rollout

**Two mistakes it exists to catch:**

- The version number lives in about six places (plugin header, a PHP constant,
  `readme.txt`, `package.json`, `composer.json`, `@since` tags). If `Stable tag` in
  `readme.txt` is wrong, **WordPress.org ships the wrong version to every user.**
- Raising "Requires at least" or "Requires PHP" is always a **major** change, even if the
  code change was tiny. Sites on older versions stop receiving your updates.

**Why it matters:** A plugin update installs itself on sites you do not control and cannot
roll back.

**Use it when:** Publishing any release.

---

### `/cp-feature`

**Runs:** all of the above, in order, with a checkpoint between each.

```
/cp-triage  →  /cp-context  →  /cp-spec  →  /cp-plan
     →  /cp-build  →  /cp-test  →  /cp-security  →  /cp-review
```

It stops at each step and waits for you. Its whole purpose is written into the command
itself: *do not skip ahead to writing code.*

**Use it when:** Building a complete new feature and you want the full process.

---

### `/cp-bootstrap-conventions`

**Runs the skill:** `cp-conventions-bootstrap`

**What the skill does:** You point it at two or more of your existing plugin repositories.
It scans them all and compares how they do things — naming, folder structure, licensing,
admin screens, shared libraries, storage, translation, build and release.

Then it sorts what it found:

| Found in | Becomes |
|---|---|
| All the repos | A **rule** — new code must follow it |
| Some repos | A **preference** — mentioned, not enforced |
| Repos disagree | **Flagged** for a human to decide |

Give it three or more repos if you can. With only two you cannot tell a real convention
from a coincidence.

**Why it matters:** It fills in your house style from your real code, instead of an AI
guessing what your team probably does.

**Use it when:** Setting this system up for your company. You run it once, not per project.

---

## The 3 skills you never type

These load by themselves when needed.

### `cp-agent-os` — the traffic controller

The agent reads this one first, every time. It decides which other skill applies, how
careful to be, and what counts as "finished."

It also settles arguments. When two sources disagree, this order wins:

```
1. Real evidence   (a test result, a PHPCS error)   ← strongest
2. Your company convention
3. General WordPress practice
4. This system's own method                          ← weakest
```

In short: if a tool says the code is wrong, the tool is right.

### `cp-static-analysis` — the automated checkers

Runs PHPCS with the WordPress coding standards, PHPStan, a PHP syntax check, and a
compatibility check against the oldest PHP version you support.

It has no command because it is not something you do on its own — it runs *inside*
`/cp-build`, `/cp-review` and `/cp-release`. When it reports problems it sorts them by
importance: security issues first, formatting last.

### `cp-conventions` — your house style

**This ships empty on purpose, and it says so when asked.**

Nobody outside your company can write it. A guessed convention is worse than none, because
it gets copied into every new plugin and quietly becomes "the way we do things."

`/cp-bootstrap-conventions` is what fills it in, from your real code.

---

## The 4 reviewers

These are used by the review commands. Each one has a single job, so it never trades one
concern against another.

| Reviewer | Looks at |
|---|---|
| `cp-code-reviewer` | The whole change, especially anything that breaks other people's code |
| `cp-security-auditor` | Security only, and reports how an attack would actually work |
| `cp-test-engineer` | Tests, including permission cases and empty states |
| `cp-standards-auditor` | Coding standards and static analysis, sorted by severity |

---

## In practice

Most days you will type three commands:

```
/cp-context      when you open a plugin you have not worked on recently
/cp-build        or /cp-debug, depending on the job
/cp-security     before anything touching input, saved data, or permissions
```

Everything else happens on its own. `/cp-triage` decides how much process a task needs, so
a small fix stays a small fix.

---

## One last thing

These skills make an AI more careful. They do not make it correct.

A human still reads the change before it ships. See
[the note on responsibility](README.md#a-note-on-responsibility) in the README.

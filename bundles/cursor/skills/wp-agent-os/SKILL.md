---
name: wp-agent-os
description: "The routing and operating-model skill for WordPress plugin engineering. Use at the start of any WordPress plugin task to pick the right workflow depth and the right skills, and whenever you are unsure which wp-* skill applies. Also use when a WordPress instruction conflicts with a company convention, or when deciding whether a change is done."
compatibility: "WordPress 6.5+ / PHP 7.4+. Filesystem agent with bash + node. PHPCS, PHPStan, PHPUnit, WP-CLI used where present."
---

# WP Agent OS

The operating model for professional WordPress plugin work. Read this first; it tells
you which other skill to load, and it defines the behaviors that hold across all of them.

## When to use

- At the start of any task touching a WordPress plugin.
- When you don't know which `wp-*` skill applies.
- When two sources of guidance disagree.
- When you think you are finished and need the bar for "done".

## The four layers

You are always working inside a stack. Know which layer a claim comes from:

- **L1 methodology** — this repo's `wp-*` lifecycle skills. *How* to do the work.
- **L2 WordPress knowledge** — the official WordPress skills (`wp-plugin-development`,
  `wp-rest-api`, `wp-block-development`, `wp-performance`, `wp-phpstan`,
  `wp-wpcli-and-ops`, `wp-playground`, `wp-plugin-directory-guidelines`, …). *What*
  WordPress is.
- **L3 company conventions** — `company-wp-conventions`. How *we* build plugins.
- **L4 enforcement** — PHPCS, PHPStan, PHPUnit, WP-CLI, Playground, git. *Proof.*

**Precedence when they conflict:**

```
L4 evidence  >  L3 company convention  >  L2 WordPress practice  >  L1 general methodology
```

Never resolve a conflict silently. State it in one line and proceed:
> "WordPress docs suggest X; our convention in the company conventions layer is Y.
> Following Y (L3 > L2). Say the word if this case should be an exception."

If L3 is empty because `company-conventions-bootstrap` hasn't been run, say that rather
than inventing a company rule.

## Procedure

### 1. Triage before anything else

Load `wp-task-triage`. It classifies the request and picks a **workflow depth**
(Direct / Standard / Full). Do not skip to implementation because the task "looks small" —
triage is cheap and it is what catches the small task that touches a capability check.

### 2. Discover the plugin before changing it

Load `wp-context-discovery` and produce (or reuse) the **Plugin Context Record**. You
cannot follow a plugin's conventions before you have read them. Nearly every bad
WordPress agent edit traces back to skipping this step.

### 3. Route by intent

| The task is about… | Load (L1) | Which delegates to (L2) |
|---|---|---|
| Deciding what to build | `wp-specification` | — |
| Ordering the work | `wp-planning` | — |
| Writing plugin code | `wp-implementation` | `wp-plugin-development` |
| Admin screens, settings | `wp-implementation` | `wp-plugin-development`, `wpds` |
| REST routes | `wp-implementation` | `wp-rest-api` |
| Blocks, editor UI | `wp-implementation` | `wp-block-development`, `wp-interactivity-api` |
| WP-CLI commands, ops | `wp-implementation` | `wp-wpcli-and-ops` |
| Tests, wp-env, Playwright | `wp-testing` | `wp-playground` |
| PHPCS / PHPStan / lint | `wp-static-analysis` | `wp-phpstan` |
| Nonces, caps, escaping, SQL | `wp-security-review` | — *(fills an upstream gap)* |
| Slow queries, autoload, cron | `wp-performance-review` | `wp-performance` |
| Reviewing a change | `wp-code-review` | — |
| Something is broken | `wp-debugging` | — |
| Versioning, readme, packaging | `wp-release` | `wp-plugin-directory-guidelines` |
| Our own house rules | `company-wp-conventions` | — |

When the repo kind is unclear (theme? block theme? site?), defer to the upstream
`wordpress-router` — that is its job, and this skill does not duplicate it.

### 4. Close the loop

A task ends at `references/definition-of-done.md`, not when the code looks right.

## Core operating behaviors

These hold in every skill and are not optional.

1. **Discover before you edit.** Read the plugin's existing hook names, prefixes, text
   domain, and file layout, and match them. Consistency with the codebase beats
   consistency with a tutorial.

2. **Never invent a WordPress API.** If you are not certain a function, hook, or
   parameter exists in the target WP version, check it. WordPress has thirty years of
   near-miss function names (`esc_html` / `esc_html__` / `esc_html_e`) and a plausible
   guess is a fatal error. Prefer grepping core or asking over guessing.

3. **Security is not a review stage.** Capability checks, nonces, sanitization, and
   escaping are written *with* the code, not audited onto it afterwards.
   `wp-security-review` verifies; it does not retrofit.

4. **Produce evidence, not adjectives.** "The query is fine" is worthless. Paste the
   PHPStan output, the failing-then-passing test, the `wp profile` row. If a tool isn't
   available in the environment, say which one and what you did instead.

5. **Backward compatibility is a user-facing feature.** A plugin runs on sites you will
   never see. Renaming a hook, an option key, a REST route, or a public method is a
   breaking change even when nothing in this repo calls it. Treat it as one.

6. **Respect the blast radius.** Plugin code runs on other people's production sites.
   Prefer the boring, reversible change. Flag anything you cannot undo with `git revert` —
   database migrations, option deletions, scheduled-event changes — before doing it.

7. **Scope discipline.** Touch what the task requires. Do not "fix" adjacent escaping,
   reformat files, or bump dependencies as a side effect — that noise is what makes a
   diff unreviewable and hides the actual change.

## Verification

You have used this skill correctly when, before your first edit, you can state:
- the task type and workflow depth,
- the plugin's main file, text domain, and prefix,
- which skills you loaded and which you deliberately did not,
- the commands that will prove the change works.

## Failure modes

- **Skipping triage on a "quick fix."** The quick fix touches `$_POST`. Now it's a CVE.
- **Loading every skill.** Context fills with conflicting instructions and the agent
  follows none of them. Load the branch you took.
- **Copying a tutorial's conventions** over the plugin's own. See behavior 1.
- **Treating an empty L3 as "no conventions exist."** It means they aren't captured yet.

## Escalation

Ask the user when — and only when — proceeding either way would be unsafe or would waste
the work if wrong:
- target WordPress / PHP minimum versions are undetectable and the API choice depends on them,
- the change is destructive to site data,
- a company convention appears to conflict with a WordPress.org plugin directory rule.

---
name: wp-task-triage
description: "Use at the very start of any WordPress plugin request to classify the task (bug, feature, refactor, security, performance, release, support escalation) and choose a workflow depth before any code is read or written. Use when a request sounds small but you have not yet confirmed what it touches."
compatibility: "WordPress 6.5+ / PHP 7.4+. Filesystem agent with bash + node."
---

# WP Task Triage

Decide *what kind of work this is* and *how much process it deserves* — before opening
an editor. Triage costs one minute and is the step that catches the "one-line fix" that
happens to write an option from an AJAX handler.

## When to use

- First step of every WordPress plugin task.
- When a request arrives as a bug report, support ticket, or one-line Slack message.
- When you notice mid-task that the work is larger than triage assumed (re-triage).

## Inputs required

- The request in the user's own words.
- The repo root. If it isn't a plugin, hand off to the upstream `wordpress-router`.

## Procedure

### 1. Classify the task

Pick exactly one primary type. If two fit, pick the one with the larger blast radius.

| Type | Signals | Primary skill after triage |
|---|---|---|
| **Bug** | "broken", "fatal", "not saving", a stack trace, a version that regressed | `wp-debugging` |
| **Feature** | "add", "support", a new screen / route / block / column | `wp-specification` |
| **Refactor** | "clean up", "extract", "rename" — no behavior change intended | `wp-implementation` |
| **Security** | CVE, disclosure report, "unauthenticated", "escalation", audit finding | `wp-security-review` |
| **Performance** | "slow", "timeout", "high TTFB", "memory", a slow-query log | `wp-performance-review` |
| **Compatibility** | new WP/PHP version, conflict with another plugin or theme | `wp-debugging` |
| **Release** | "ship", "tag", "bump", "readme", "deploy to .org" | `wp-release` |
| **Support escalation** | a specific site misbehaving; may not be a code defect at all | `wp-debugging` |

### 2. Answer the blast-radius questions

Answer all six from the request plus a quick look — not from assumption:

1. Does it read **untrusted input** (`$_GET/$_POST/$_REQUEST/$_FILES`, REST params, webhooks)?
2. Does it **write** anything (options, meta, custom tables, files, transients)?
3. Does it change a **public surface** (hook name, REST route, CLI command, shortcode,
   option key, public method/class)?
4. Does it run on the **front end** or on every admin page load?
5. Does it touch **capabilities, nonces, or user identity**?
6. Is it **irreversible** on a live site (migration, deletion, scheduled-event change)?

### 3. Choose the workflow depth

| Answers | Depth | Path |
|---|---|---|
| All six "no" | **Direct** | `wp-context-discovery` → `wp-implementation` → `wp-static-analysis` → `wp-code-review` |
| Any of 1, 2, 4, 5 | **Standard** | Direct **plus** `wp-testing` (test first) and `wp-security-review` |
| Any of 3 or 6, or the task is a new user-facing surface | **Full** | The complete `/wp-feature` chain, starting at `wp-specification` |

Rules:
- **Escalation is free and always allowed.** De-escalation is not. Once a task is
  Standard, it stays Standard even if the diff turns out to be two lines.
- A **Direct** task that turns out to touch untrusted input is re-triaged on the spot.
  Say so in one line and continue at the higher depth.
- Questions 3 and 6 are the ones agents most often answer wrong. Renaming a hook nobody
  in *this* repo calls is still a breaking change — other people's sites call it.

### 4. Announce the plan

Before any edit, state — briefly, four lines is plenty:

```
Type:    Bug (regression since 1.4.0)
Depth:   Standard  (reads $_POST, writes an option)
Route:   wp-context-discovery → wp-debugging → wp-testing → wp-security-review → wp-code-review
Skipped: wp-specification (no new surface), wp-release (not shipping today)
Proof:   composer test, composer phpcs, failing-then-passing test for the reported input
```

Naming what you skipped matters as much as what you loaded — it is how the user catches
a wrong route before the work is done, and it keeps context lean.

## Verification

Triage is correct when the announced depth still holds at the end of the task. If you
had to escalate mid-way, that is a *successful* catch — note it — but if you finished at
Direct having touched a capability check, triage failed.

## Failure modes

- **Anchoring on the user's framing.** "Just change the label" often means changing the
  label *and* the option it writes. Check before accepting the framing.
- **Treating a support ticket as a bug.** Many escalations are configuration or a
  conflicting plugin. Confirm the defect reproduces in a clean environment first
  (`wp-debugging` covers this) before changing plugin code.
- **Skipping triage on a hotfix.** Hotfixes ship fastest and are reviewed least — they
  need the depth decision *more*, not less.

## Escalation

Ask the user when the type is genuinely ambiguous *and* the depths differ — most often
"is this a bug or is this the feature working as specified?" Getting that wrong wastes
the entire task, so it is worth one question.

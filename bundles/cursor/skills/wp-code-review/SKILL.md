---
name: wp-code-review
description: "Review a WordPress plugin change before merge across seven axes: correctness, WordPress correctness (hooks, APIs, lifecycle), security, performance, public API and back-compat, i18n and accessibility, and readability. Use when reviewing a diff, a branch, or a pull request, and before merging any plugin change."
compatibility: "WordPress 6.5+ / PHP 7.4+."
---

# WP Code Review

Generic five-axis review misses the things that actually break WordPress plugins:
a renamed hook, a string that will never translate, an option that now autoloads, an
activation routine that is not idempotent. This adds the two axes that matter most in a
plugin — **public API/back-compat** and **i18n** — and makes WordPress correctness its
own axis rather than a footnote under "correctness".

## When to use

- Before merging any change.
- On a pull request, a branch, or the working diff.
- After `wp-implementation`, alongside `wp-static-analysis` and `wp-security-review`.

## Inputs required

- The diff (`git diff origin/main...`), the spec or task, and the Plugin Context Record.
- The results of static analysis, tests, and security review — a review that has not seen
  those is guessing.

## Procedure

### 1. Read in this order

1. **The spec or task** — what was this supposed to do?
2. **The tests** — they reveal intent and coverage better than the code.
3. **The diff.**
4. **The surrounding code** the diff touches, for consistency.

### 2. Review the seven axes

**1 · Correctness.** Does it do what the task says? Empty, null, and boundary cases?
Error paths? Does it handle the value being absent on a site that never configured it?

**2 · WordPress correctness.**
- Right hook, right priority, right argument count?
- Registration on the proper hook (`init`, `rest_api_init`, `admin_menu`)?
- Activation/deactivation registered at main-file top level, and **idempotent**?
- Does it use a core function that exists in the declared minimum WP version?
- Deprecated core functions?
- Multisite: `get_option` vs `get_site_option` used deliberately?
- Options vs meta vs custom table — appropriate to the shape and volume?

**3 · Security.** See `wp-security-review` for the full pass. In review, confirm every
new entry point has capability → nonce → sanitize, and every output is escaped. Do not
approve a change that adds an entry point without them.

**4 · Performance.** New autoloaded option? Query in a loop? Uncached remote call?
Assets enqueued globally? See `wp-performance-review`.

**5 · Public API and back-compat.** *The axis generic review does not have.*
- Does the diff rename or remove a hook, filter, REST route, CLI command, shortcode,
  option key, public class or public method?
- If yes: is there a shim in the **same** commit
  (`apply_filters_deprecated()`, `do_action_deprecated()`, old option still read)?
- Are new hooks named consistently with the plugin's existing ones? They are permanent.
- Does the data shape change without a migration?

Assume every public name is used by someone whose site you cannot see. That assumption is
correct often enough that the alternative is not worth the support load.

**6 · i18n and accessibility.**
- Every user-facing string translated, with the **literal** text domain?
- `translators:` comments where placeholders could reorder? `_n()` for plurals?
- Admin markup: labels tied to inputs, buttons that are buttons, focus states, colour not
  the sole signal? Notices using the standard `notice notice-warning` pattern so screen
  readers announce them?

**7 · Readability.** Names matching plugin convention. Straightforward control flow.
No cleverness that a maintainer in two years will misread. Comments explain *why*, not what.

### 3. Categorise findings

| Label | Meaning |
|---|---|
| **Critical** | Blocks merge — vulnerability, data loss, fatal, breaking API change with no shim |
| **Required** | Must fix before merge — missing test, missing escaping, missing i18n |
| **Optional** | Worth considering — a simpler design, a useful extraction |
| **Nit** | Take it or leave it — naming, formatting |

Every Critical and Required carries `file:line` and a concrete fix. A finding the author
cannot act on is noise.

### 4. Output

```markdown
## Review — <branch/PR>

**Verdict:** APPROVE | REQUEST CHANGES

**Change:** [1–2 sentences on what it does]

**Evidence seen:** PHPCS clean · PHPStan +0 · PHPUnit 34 passed · security review done

### Critical
- `includes/class-rest.php:19` — `permission_callback => __return_true` on a write route.
  Any visitor can overwrite the licence. Fix: `current_user_can( 'manage_options' )`.

### Required
- `includes/class-admin.php:31` — `$key` echoed unescaped. Use `esc_attr()`.
- No test covers the Subscriber-denied path (AC-2).

### Optional
- `class-license.php:70` — the two branches differ only in the message; consider merging.

### Nits
- `class-admin.php:12` — `$exp` reads better as `$expiry`.

### Done well
- Migration is idempotent and the schema version bump ships in the same commit.

### Not verified
- Playwright suite not run (no Docker in this environment).
```

The **Evidence seen** and **Not verified** lines are what separate a review from an
opinion. State what you actually ran.

## Verification

- All seven axes considered, not just the ones the diff makes obvious.
- Every Critical/Required has file:line and a fix.
- At least one thing done well is named — specific praise is how good patterns spread.
- What you could not verify is stated rather than silently omitted.

## Failure modes

- **Reviewing only the diff.** A hunk can be correct and still break the entry point it
  sits in. Read the surrounding function.
- **Missing the back-compat axis.** The most expensive WordPress review miss, because the
  breakage lands on other people's sites, not in CI.
- **Approving without evidence.** If tests and lint were not run, the review is a reading.
- **Rubber-stamping your own work.** If you wrote the code, review it as an adversary or
  hand it to the `wp-code-reviewer` persona with fresh context.
- **All findings marked Critical.** Nobody triages a report where everything is urgent.

## Escalation

Ask the user when a change requires a breaking API change with no viable shim, or when
the review finds that the spec itself is wrong — that is a product decision, not a code
comment.

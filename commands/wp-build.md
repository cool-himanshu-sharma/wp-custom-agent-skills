---
description: Implement the next task with WordPress guardrails, then verify it. Add "auto" to run the whole plan.
---

Invoke the `wp-implementation` skill, with `wp-testing` for anything at Standard depth or
above.

## Modes

- **`/wp-build`** — implement the next pending task, then stop.
- **`/wp-build auto`** — implement every task in the plan after a single approval.

`$ARGUMENTS` selects the mode; treat `auto` or `all` as autonomous.

## Loop (per task)

1. Read the task's acceptance criteria and confirm the Plugin Context Record is current.
2. For Standard/Full depth: write the failing test first and paste the failure.
3. Implement, applying the guardrails as you write — capability, then nonce, then
   `wp_unslash` + sanitize, then act; escape at output; prefix everything; translate
   every string with the literal text domain.
4. Run the verify command. Then `php -l`, PHPCS, and the test suite.
5. Re-run `plugin_context.mjs` and confirm the public surface changed exactly as intended
   and no unintended autoloaded option appeared.
6. Update `uninstall.php` if this task added storage.
7. Commit with a descriptive message. Mark the task complete.

## Autonomous mode

Require a spec and a plan, establish a clean git baseline, get one explicit approval, then
run every task in dependency order with the full loop above — one commit per task, so any
point is a clean rollback.

Stop and ask the user, rather than pushing through, when: a test cannot be made to pass;
the spec is ambiguous; or a task is irreversible on a live site (migration, deletion,
scheduled-event change, anything you cannot undo with `git revert`).

Never silence a PHPCS security sniff or regenerate a PHPStan baseline to reach green.

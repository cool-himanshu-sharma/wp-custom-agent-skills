---
name: wp-planning
description: "Use after a WordPress spec exists to break the work into ordered, independently verifiable tasks with WordPress-aware sequencing — schema and migration before writers, capability gates before UI, server before client, back-compat shims before renames. Use when a feature is too large to implement in one pass."
compatibility: "WordPress 6.5+ / PHP 7.4+."
---

# WP Planning

Turn a spec into tasks that can each be built, tested, and committed on their own.
WordPress adds ordering constraints that generic planning misses — get them wrong and
you end up with a half-migrated database on a live site.

## When to use

- After `wp-specification`, before `wp-implementation`.
- When a task would touch more than two or three files.
- When work must be split across people or sessions.

## Inputs required

- The spec, with numbered acceptance criteria.
- The Plugin Context Record.

## Procedure

### 1. Slice vertically, never horizontally

A task must deliver a working, testable behavior end to end.

- **Wrong:** "add all the option handling", then "add all the admin UI".
- **Right:** "store and read the licence expiry date, with a test", then "show the
  banner when it is near".

Horizontal slices cannot be verified until the last one lands, so nothing is provable
until everything is done — which is when the plan stops helping.

### 2. Apply the WordPress ordering rules

These are the sequencing constraints that are specific to WordPress. Violating them
produces bugs that only appear on upgrade or on someone else's site.

1. **Schema and migration before anything writes to it.** The upgrade routine and the
   stored schema-version bump land first, and are idempotent. A writer that ships before
   its migration corrupts existing sites.
2. **Capability and nonce gates before the UI that needs them.** Never ship the form and
   add authorization "next task" — that ordering has shipped real vulnerabilities.
3. **Server before client.** The REST route and its `permission_callback` land and are
   tested before the JS that calls it.
4. **Registration before use.** CPTs, taxonomies, blocks, settings, and REST routes are
   registered on their proper hooks before code depends on them existing.
5. **Back-compat shim before rename.** If a hook, option, or route is being renamed, the
   shim that keeps the old name working ships in the *same* task as the rename — never later.
6. **Uninstall alongside new storage.** A task that adds an option or table updates
   `uninstall.php` in the same commit, or the plugin permanently orphans data.
7. **Text domain from the first string.** Retrofitting i18n across a feature is
   error-prone and reviewers stop catching it.

### 3. Write the task list

`tasks/plan.md`, each task with:

```markdown
### T3 — Store licence expiry
- **Delivers:** AC-1 (partial), AC-3
- **Depends on:** T1 (option schema + migration)
- **Touches:** includes/class-acme-lm-license.php, uninstall.php
- **Public API added:** filter `acme_lm_expiry_threshold_days`
- **Verify:** `composer test -- --filter LicenseStorage`; `composer phpcs`
- **Done when:** expiry round-trips through the option; absent licence returns null,
  emits no notice, and adds no autoloaded row.
```

Every task names the acceptance criteria it delivers. Any AC not claimed by a task is a
gap in the plan — that check catches missing work better than re-reading the spec.

### 4. Size and sequence

- A task should be one focused commit. If "Touches" lists five files across three
  concerns, split it.
- Order by dependency, then by risk: land the risky, structural task early while there
  is room to change approach.
- Mark tasks that are **irreversible on a live site** (migrations, deletions, cron
  changes). Those get explicit sign-off in `wp-implementation`, not a silent commit.

### 5. Plan the verification, not just the work

For each task state the exact command that proves it. "Test it" is not a plan. If the
toolchain lacks PHPUnit, say what you will do instead (a Playground reproduction, a
WP-CLI eval) — decided now, not improvised later.

## Verification

The plan is sound when:
- every acceptance criterion maps to at least one task;
- every task has a command that proves it;
- no task depends on one listed after it;
- no task both adds storage and leaves `uninstall.php` untouched;
- each task could be reverted alone without breaking the ones before it.

## Failure modes

- **Horizontal slicing.** See §1.
- **"Add security" as a late task.** Authorization is part of the task that needs it.
- **Migration after writer.** The classic WordPress data-loss ordering bug.
- **Tasks with no verify command.** They become "looks right" commits.
- **A plan longer than the feature.** If planning takes longer than building, the task
  was Direct depth and should have skipped this skill.

## Escalation

Ask the user before planning any task that migrates or deletes existing site data, and
when a rename cannot preserve back-compat — dropping an old hook is a product decision
with a support cost.

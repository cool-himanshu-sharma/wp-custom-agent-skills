---
name: cp-testing
description: "Use when writing or running tests for a WordPress plugin: PHPUnit with the WordPress test suite, wp-env, Playwright end-to-end, Jest for block JS, and WordPress Playground for reproductions. Use when fixing a bug (write the failing test first) or when a plugin has no test setup and needs one."
compatibility: "WordPress 6.5+ / PHP 7.4+. Needs Docker for wp-env; falls back to Playground or WP-CLI when unavailable."
---

# WP Testing

Fills a gap the upstream WordPress router names but does not yet provide. Testing a
plugin is not testing a library: most plugin logic only means anything with WordPress
loaded, so the interesting question is always *which layer can prove this cheapest*.

## When to use

- Any bug fix — the failing test comes first.
- Any Standard or Full depth task.
- When a plugin has no test infrastructure and the task warrants adding it.

## Inputs required

- The acceptance criteria to prove.
- The Plugin Context Record toolchain section — what actually exists.

## Procedure

### 1. Pick the cheapest layer that can prove it

| Layer | Proves | Cost | Use when |
|---|---|---|---|
| **Plain PHPUnit** | Pure functions — parsing, formatting, date maths, validation | Seconds, no WordPress | The logic has no WordPress dependency. Extract it so this is possible. |
| **WP PHPUnit** (`WP_UnitTestCase`) | Hooks fired, options stored, caps enforced, queries, REST via `WP_REST_Request` | Needs the WP test suite | Most plugin logic. The default. |
| **Jest** (`@wordpress/scripts`) | Block edit/save, JS state | Fast | Block or editor JS. |
| **Playwright** | Real admin flows, editor interaction | Slow, needs wp-env | Only what genuinely needs a browser. |
| **Playground / WP-CLI** | Reproduction, upgrade paths, clean-install behavior | Manual | No test suite available, or verifying an upgrade. |

Push logic down. A test that needs a browser to check a date calculation is a design
signal — extract the calculation and test it in milliseconds.

### 2. Bug fix: prove it before you fix it

Never fix first. The order is not negotiable:

1. **Reproduce** — write a test that fails *for the reported reason*. Paste the failure.
2. **Confirm the failure is the bug** — not a typo in the test. A test that fails for the
   wrong reason will pass after an unrelated change and hide the defect.
3. **Fix** — minimum change.
4. **Confirm** — the test passes, the suite is still green.
5. **Guard** — keep the test, named after the behavior it protects.

This is the only way to know the fix addressed the actual defect rather than a symptom.

### 3. Write WordPress-shaped tests

Test through WordPress, not around it:

```php
class Test_License_Notice extends WP_UnitTestCase {

    public function test_subscriber_cannot_update_licence() {
        wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

        $request  = new WP_REST_Request( 'POST', '/acme-lm/v1/license' );
        $response = rest_do_request( $request );

        $this->assertSame( 403, $response->get_status() );
    }
}
```

- Use `self::factory()` for users, posts and terms — never hand-built fixtures.
- Set the current user explicitly whenever capabilities matter. Tests default to no user,
  so a capability bug can pass unnoticed.
- Assert on **behavior**, not implementation: that the option holds the right value and
  the notice renders, not that a private method was called.
- `WP_UnitTestCase` rolls back the database per test. Do not write your own cleanup.

### 4. Cover the cases that actually break

For every feature, at minimum:

- **Happy path** — the acceptance criterion.
- **No permission** — a lower role gets 403 or no UI. *(Most-skipped, most-exploited.)*
- **Empty state** — never configured: no notice, no fatal, no autoloaded row.
- **Bad input** — wrong type, absurd length, hostile string.
- **Upgrade** — a site with the *old* data shape still works. Simulate by writing the old
  value, running the migration, asserting the new shape.

### 5. Run them, and show the output

```bash
composer test                          # prefer the repo's own script
vendor/bin/phpunit --filter LicenseNotice
npx wp-env start
npx wp-env run tests-cli --env-cwd=wp-content/plugins/SLUG vendor/bin/phpunit
npm run test:unit                      # Jest
npx playwright test
```

Paste the real result. "Tests pass" without output is not evidence.

### 6. When there is no test infrastructure

Say so plainly, then pick the honest fallback rather than claiming a check you did not run:

- Reproduce in **Playground** with a Blueprint (see the `wp-playground` and `blueprint`
  skills) and describe the observed behavior.
- Use `wp eval` or `wp eval-file` against a dev site to exercise the code path.
- If the task warrants it, propose adding PHPUnit and wp-env as its own task — but do not
  silently expand the current one.

See `references/setup.md` for a minimal PHPUnit and wp-env setup.

## Verification

- The new test failed before the change and passes after — both observed, not assumed.
- The full suite is green, with no new skips.
- Permission and empty-state cases exist for anything user-facing.
- Test names describe behavior, so a future failure is self-explaining.

## Failure modes

- **Fixing before reproducing.** You cannot know what you fixed.
- **Tests that never set a user.** Capability regressions pass silently.
- **Asserting on internals.** The test breaks on every refactor and proves nothing.
- **Browser tests for logic.** Slow, flaky, and they hide a design problem.
- **Mocking WordPress core functions** instead of loading the test suite. The mock drifts
  from reality and the test starts lying.
- **Claiming a suite passed when it was never run.** Saying "PHPUnit is not configured
  here" is a useful, honest result.

## Escalation

Ask the user before adding Docker or wp-env to a repo that has deliberately avoided it,
and when a bug cannot be reproduced in a clean environment — that usually means a
site-specific conflict, which is `cp-debugging` territory, not a code change.

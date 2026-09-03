# Definition of Done

The bar that applies to **every** WordPress plugin change, whatever skill produced it.
It complements each task's acceptance criteria; it does not replace them.

A change is done when all of the following are true — and you can show it.

## Correct

- [ ] Does what the task or spec says, including the never-configured state
- [ ] Edge cases handled: empty, null, absent, wrong type, boundary
- [ ] Error paths return or render something sensible, not a fatal

## Verified

- [ ] Every changed PHP file parses (`php -l`)
- [ ] PHPCS run: no `WordPress.Security.*` or `PreparedSQL*` violations in changed code
- [ ] PHPStan run: no new errors above the baseline, baseline not regenerated
- [ ] Tests run: the new test failed before the change and passes after
- [ ] Full suite green, no new skips
- [ ] **Any tool that could not run is named**, with what you did instead

The last item is not optional. A silent gap in verification reads as a passing check.

## Secure

- [ ] Every new entry point: capability → nonce → `wp_unslash` + sanitize, in that order
- [ ] Every output escaped at print with the context-correct function
- [ ] Every query `prepare()`d with correct placeholders
- [ ] No security sniff silenced to reach green
- [ ] No secret, key or absolute path in code, markup, or logs

## Compatible

- [ ] Every core API used exists in the declared `Requires at least` / `Requires PHP`
- [ ] No public hook, filter, REST route, CLI command, option key, public class or method
      renamed or removed **without a back-compat shim in the same commit**
- [ ] Data shape changes ship with an idempotent migration and a schema-version bump
- [ ] Multisite behavior deliberate (`get_option` vs `get_site_option`)

## Complete

- [ ] `uninstall.php` updated if storage was added
- [ ] Every user-facing string translated with the **literal** text domain
- [ ] `translators:` comments where placeholders can reorder
- [ ] No new autoloaded option unless deliberate and small
- [ ] Public surface re-checked with `plugin_context.mjs` — it changed exactly as intended

## Clean

- [ ] No debug code, `var_dump`, stray `error_log()`, or commented-out blocks
- [ ] No unrelated reformatting or drive-by "fixes" in the diff
- [ ] Commit message explains why, not just what

---

## The honesty rule

If you cannot tick an item, **say which one and why**. An unticked box with a reason is a
useful engineering result. A ticked box that was not verified is the single failure that
destroys trust in every other claim the agent makes — including the true ones.

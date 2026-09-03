# Eval 01 — Full security audit finds every planted defect

**Skill under test:** `cp-security-review`
**Command:** `/cp-security`

## Prompt

> Audit `evals/fixtures/acme-license-manager` for security issues.

## Baseline failure (no skill)

An agent without the skill typically reads the files top to bottom and reports the two
*visually obvious* problems — the unescaped `echo` and the concatenated SQL — because
those look wrong on the page. It commonly misses the missing capability check (there *is*
a `check_ajax_referer` call, which reads as "security is handled") and often does not
enumerate the REST route separately at all. It also tends to report findings without an
attack path.

## Pass criteria

**Must** find all four:

1. `class-acme-lm-admin.php` — `save_key()` verifies a nonce but has **no capability
   check**. Must state that the nonce is not authorization, and that any logged-in
   Subscriber can therefore overwrite the licence key.
2. `class-acme-lm-admin.php` — `render()` echoes `$key` into a `value=""` attribute with
   no escaping. Must name `esc_attr()`.
3. `class-acme-lm-rest.php` — `permission_callback => '__return_true'` on a POST route.
   Must rate **Critical** and note it is reachable unauthenticated.
4. `class-acme-lm-rest.php` — `$site` concatenated into SQL. Must name `$wpdb->prepare()`
   with a `%s` placeholder.

**Must** also:

- Enumerate entry points *before* analysing them.
- Give every Critical/High finding a concrete attack path, not just a description.
- Rate finding 1 and finding 3 as Critical.

**Should:**

- Note the absent `uninstall.php` despite created options and a custom table.
- Note `add_option( 'acme_lm_settings', array(), '', true )` autoloads unnecessarily.
- Run or attempt the PHPCS security sniffs and state the result or their absence.

## Fail signals

- Reports "the code looks secure" for any file.
- Treats `check_ajax_referer` as satisfying authorization.
- Rates every finding Critical, or none of them.
- Claims PHPCS passed when PHP is not installed in the environment.

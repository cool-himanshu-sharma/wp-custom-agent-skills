---
name: wp-debugging
description: "Use when a WordPress plugin is broken: white screen, fatal error, hook not firing, settings not saving, REST route 404 or 403, cron not running, or a conflict with another plugin or theme. Reproduce in a clean environment, isolate by bisecting plugins and themes, then fix the root cause with a guarding test."
compatibility: "WordPress 6.5+ / PHP 7.4+. Uses WP_DEBUG, Query Monitor, WP-CLI and Playground."
---

# WP Debugging

Most WordPress "bugs" reported against a plugin are one of three things: an actual defect,
a conflict with another plugin or theme, or a site configuration problem. They need
different responses, and guessing which one you have is how hours disappear.

Reproduce first. Always.

## When to use

- A fatal, a white screen, or unexpected behavior.
- A support escalation about one specific site.
- A hook, setting, route or cron job that is not doing what it should.

## Inputs required

- The exact symptom, the WordPress and PHP versions, the plugin version, and — critically
  — whether it worked before and what changed.
- Whether it reproduces on a clean site.

## Procedure

### 1. Turn the lights on

```php
// wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );    // logs to wp-content/debug.log
define( 'WP_DEBUG_DISPLAY', false );
define( 'SCRIPT_DEBUG', true );
```

```bash
tail -f wp-content/debug.log
wp plugin list --status=active
wp option get acme_lm_settings --format=json
wp eval 'var_dump( has_action( "init", "acme_lm_boot" ) );'
```

A white screen is almost always a fatal being hidden. Get the actual error before
theorising — never debug a symptom you have not seen the error text for.

### 2. Reproduce in a clean environment

This step decides everything that follows.

```bash
npx wp-env start          # or a Playground Blueprint — see the wp-playground skill
```

Install *only* this plugin on a default theme, then try the reported steps.

- **Reproduces clean** → it is a plugin defect. Continue to §3.
- **Does not reproduce** → it is a conflict or a site configuration issue. Go to §4.

Skipping this step is the most expensive mistake in WordPress debugging: you can spend a
day fixing a plugin that was never at fault.

### 3. Localise it

Narrow before changing anything.

- **Bisect by version.** `git log --oneline` between the last working release and now;
  `git bisect` if the range is large. Knowing the commit usually reveals the cause.
- **Bisect by hook.** Is the callback registered at all (`has_action()`)? Is it firing
  (log inside it)? Is it firing too early or too late (priority, or registered after the
  hook already ran)?
- **Check the load order.** Code that runs at file-load time in the main plugin file runs
  before WordPress is ready. `plugins_loaded`, `init`, and `admin_init` fire in that order.

Common causes, matched to symptom:

| Symptom | Usual cause |
|---|---|
| Activation hook never fires | Registered inside another hook, or not in the main file |
| Settings do not save | Setting not registered, wrong option group, capability, or nonce failure |
| REST route 404 | Not registered on `rest_api_init`, or permalinks need flushing |
| REST route 403 | `permission_callback` returning false — often correct behavior |
| Hook not firing | Registered after the hook ran; wrong priority; wrong arg count |
| Fatal on some sites only | A PHP version feature above the declared `Requires PHP` |
| Works for admin, not editor | A capability check that is stricter than intended |
| Cron never runs | `DISABLE_WP_CRON`, or the event was never scheduled |
| Undefined function | A plugin dependency that is not active, or a load-order assumption |

### 4. When it does not reproduce clean — isolate the conflict

```bash
wp plugin deactivate --all
# reactivate one at a time, testing each
wp theme activate twentytwentyfour
```

If a conflict is confirmed, the fix is often still yours: an unprefixed global, a hook
priority assumption, a shared library version clash. Report *which* plugin and *why* they
collide — "conflicts with X" without a mechanism is not a diagnosis.

### 5. Fix the root cause, and guard it

Write the failing test **before** the fix (`wp-testing` §2). Then fix the cause, not the
symptom: suppressing a notice, adding `isset()` around a value that should always exist,
or `@`-silencing an error hides the defect and it returns.

Ask "why was that value missing?" before adding a guard for it being missing.

### 6. Report the diagnosis

```
Symptom     Settings page fatals for Editors on 1.4.1+
Root cause  class-admin.php:31 calls acme_lm_get_expiry(), which is defined in the
            admin-only include loaded behind is_admin() — but the AJAX handler runs
            with is_admin() true and the include skipped for non-admin capability paths.
Introduced  a9665cd ("refactor: move helpers into admin include")
Fix         move the helper into the always-loaded include
Guard       test_expiry_helper_available_during_ajax
Verified    PHPUnit 35 passed; reproduced on wp-env before, clean after
```

## Verification

- The failure was observed, not inferred.
- It reproduced in a clean environment (or was proven to be a conflict).
- A test fails before the fix and passes after.
- The root cause is named — not just the line changed.

## Failure modes

- **Debugging without reproducing.** You end up fixing an imagined bug.
- **Fixing the symptom.** `isset()` around a value that should exist converts a loud bug
  into a silent one.
- **Skipping the clean-environment check** and rewriting plugin code to work around
  another plugin's behavior.
- **Trusting the reporter's diagnosis.** Their symptom is data; their explanation is a
  hypothesis.
- **Changing several things at once.** Then you cannot tell which one worked.
- **Leaving `WP_DEBUG` or `error_log()` calls in the shipped diff.**

## Escalation

Ask the user when the bug only reproduces on a site you cannot access — you need logs,
the plugin/theme list, and versions before guessing. Ask before any workaround that
degrades behavior for all sites to fix one, and before touching data on a live site to
diagnose.

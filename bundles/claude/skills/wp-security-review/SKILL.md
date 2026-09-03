---
name: wp-security-review
description: "Audit WordPress plugin code for security defects: missing capability checks, nonce-without-authorization, unescaped output, unsanitized input, SQL injection via unprepared queries, open REST permission_callbacks, unauthenticated AJAX, insecure file uploads, SSRF, object injection, and privilege escalation. Use when a change touches untrusted input, authorization or storage, before any release, and when responding to a disclosure report."
compatibility: "WordPress 6.5+ / PHP 7.4+. Pairs with PHPCS WordPress.Security sniffs for deterministic coverage."
---

# WP Security Review

The upstream WordPress router routes security work to a `wp-security` skill it marks
*(planned)*. This is that skill.

WordPress plugin vulnerabilities are overwhelmingly not exotic. Year after year the same
handful dominate disclosure feeds, and nearly all are visible by reading entry points in
a fixed order. The discipline is to enumerate **every** entry point, not to read the code
that looks interesting.

## When to use

- Any task at Standard or Full depth.
- Before every release.
- On any change touching `$_GET/$_POST/$_REQUEST/$_FILES`, REST, AJAX, capabilities,
  file operations, or SQL.
- When responding to a disclosure report.

## Inputs required

- The Plugin Context Record — its `security_signals` and `surface` sections list the
  entry points to audit.
- The diff under review, or the whole plugin for a full audit.

## Procedure

### 1. Run the deterministic pass first

Machines find these faster and more completely than reading does:

```bash
vendor/bin/phpcs -s --standard=WordPress --sniffs=\
WordPress.Security.EscapeOutput,\
WordPress.Security.ValidatedSanitizedInput,\
WordPress.Security.NonceVerification,\
WordPress.DB.PreparedSQL,\
WordPress.DB.PreparedSQLPlaceholders .
```

Then generate the entry-point inventory:

```bash
node .claude/skills/wp-context-discovery/scripts/plugin_context.mjs . --json
```

Reading replaces neither. Reading finds what the sniffs cannot: a capability check that
is *present but wrong*.

### 2. Enumerate every entry point

Build the list before analysing any of it. An entry point is anywhere an outside actor
reaches plugin code:

- `add_action( 'wp_ajax_*' )` and **`wp_ajax_nopriv_*`** (unauthenticated!)
- `register_rest_route()` — every route, every method
- `admin_post_*` and `admin_post_nopriv_*`
- Form handlers on `admin_init`, `init`, `template_redirect`
- Shortcodes and block render callbacks that read request data
- Webhook endpoints, `wp-cron` callbacks acting on stored input
- Anything reading `$_GET` on a public page

Missing an entry point is how audits fail. Enumerate first; analyse second.

### 3. For each entry point, ask the five questions

In this order. The first two are where the severe bugs live.

1. **Authorization** — is there a `current_user_can()` with the *right* capability?
   - Absent → **Critical** if it changes state.
   - Present but too weak (`read` on a settings write) → **Critical**.
   - `is_user_logged_in()` alone → **Critical**. Being logged in is not permission;
     Subscriber is a logged-in user, and on many sites anyone can register.
2. **Intent** — is there a nonce (`check_admin_referer`, `check_ajax_referer`,
   `wp_verify_nonce`)?
   - Absent on a state change → **High** (CSRF).
   - **A nonce is not authorization.** Both are required, and neither substitutes.
3. **Input** — is every value `wp_unslash()`ed then sanitized to its expected shape?
   Array input walked recursively? Type-checked before use as an ID or callback?
4. **Output** — is every value escaped at print, with the context-correct function?
   Including values read back from your own options.
5. **Query** — is every SQL statement `$wpdb->prepare()`d with correct placeholders?

`references/checklist.md` has the full per-class checklist and the WordPress-specific
traps within each.

### 4. Sweep the high-severity classes

Beyond entry points, check for:

- **Privilege escalation** — user meta or role written from request data; `wp_update_user()`
  with unfiltered input; anything letting a user set their own `role` or capabilities.
- **Object injection** — `unserialize()` on stored or request data. Use `maybe_unserialize()`
  only on trusted values; prefer `wp_json_encode()`/`json_decode()`.
- **SSRF** — `wp_remote_get()` on a user-supplied URL; validate scheme and host against
  an allow-list.
- **Arbitrary file access** — path built from input without `realpath()` containment;
  `file_get_contents()`, `unlink()`, `include` on a request-derived path.
- **Insecure uploads** — always `wp_handle_upload()` with `wp_check_filetype_and_ext()`;
  never trust `$_FILES['name']` or the client MIME type.
- **Information disclosure** — licence keys, API tokens or paths echoed into HTML/JS,
  logged, or returned by a REST route readable by lower roles.
- **Missing `ABSPATH` guard** at the top of directly-reachable PHP files.

### 5. Rate honestly and report with evidence

| Severity | Meaning |
|---|---|
| **Critical** | Unauthenticated or low-privilege user can change state, read protected data, or execute code. Blocks release. |
| **High** | Requires some privilege or user interaction (CSRF, stored XSS by a contributor). Blocks release. |
| **Medium** | Needs an unusual configuration or high privilege; still a real defect. |
| **Low / Hardening** | Defence in depth; no demonstrated path. |

Every finding needs **file:line, the concrete attack path, and the fix**:

```
CRITICAL  includes/class-acme-lm-rest.php:19
  permission_callback is __return_true on POST /acme-lm/v1/license.
  Path: any unauthenticated visitor can POST and overwrite the stored licence.
  Fix:  'permission_callback' => static fn() => current_user_can( 'manage_options' )

CRITICAL  includes/class-acme-lm-rest.php:29
  $site is concatenated into SQL with no prepare().
  Path: POST site=' UNION SELECT user_pass FROM wp_users -- dumps password hashes.
  Fix:  $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}acme_licenses WHERE site = %s", $site ) )
```

"This could be exploited" without a path is not a finding — it is a guess, and it trains
people to ignore the report. If you are unsure, say so and say what would settle it.

## Verification

- Every entry point from §2 is accounted for — audited or explicitly ruled out.
- Every Critical and High has a named attack path and a concrete fix.
- The PHPCS security sniffs were run, or their absence is stated.
- No security sniff was silenced to reach green.
- Fixes are verified by a test where possible — a Subscriber getting 403 is a test, not a
  claim (see `wp-testing` §4).

## Failure modes

- **Reading only the diff.** A change is often safe in isolation and unsafe because an
  adjacent entry point lacks a gate. Audit the entry point, not the hunk.
- **Accepting a nonce as authorization.** The single most common WordPress plugin CVE.
- **Forgetting `wp_ajax_nopriv_*`.** It is unauthenticated by definition and is
  repeatedly the highest-severity finding in a plugin.
- **Trusting your own options.** They may hold data written by an older, vulnerable
  version. Escape on output regardless of origin.
- **`sanitize_text_field()` as a universal answer.** It is not escaping, does not make a
  URL safe, and does not validate a value against an allow-list.
- **Rating everything Critical.** It destroys the signal and the report stops being read.
- **Declaring code secure.** You can report what you audited and found; you cannot certify
  absence. Say what you checked.

## Escalation

Tell the user immediately, before continuing other work, if you find a Critical issue in
released code — that is a disclosure and release decision, not a code change. Do not
publish details anywhere public. For plugins on WordPress.org, coordinate with the Plugin
Review team through their security process.

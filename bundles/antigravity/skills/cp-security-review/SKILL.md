---
name: cp-security-review
description: "Audit WordPress plugin code for security defects: missing capability checks, nonce-without-authorization, unescaped output, unsanitized input, SQL injection via unprepared queries, open REST permission_callbacks, unauthenticated AJAX, insecure file uploads, SSRF, object injection, and privilege escalation. Use when a change touches untrusted input, authorization or storage, before any release, and when responding to a disclosure report."
compatibility: "WordPress 6.5+ / PHP 7.4+. Pairs with PHPCS WordPress.Security sniffs for deterministic coverage."
---

# WP Security Review

The upstream WordPress router routes security work to a `cp-security` skill it marks
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
node .agent/skills/cp-context-discovery/scripts/plugin_context.mjs . --json
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

### 5. Confirm each finding before you report it

An unconfirmed finding is a guess with a severity label on it. Most WordPress false
positives come from reading one hunk in isolation when the protection lives one level up,
so trace every candidate before writing it down.

**Before declaring a check missing, follow the actual execution path** from the entry
point to the line you are worried about, and find out what really runs in between.

The three places below are where protection *most often* turns out to live. They are
examples to prompt the search, **not a checklist that completes it** — a plugin can guard
a call anywhere: a shared `verify_request()` helper, an `admin_init` gate, an early
`return` in a bootstrap, a base class method, a trait. Read this plugin's real code path.

1. **The registration call.** `add_menu_page()`, `add_submenu_page()` and
   `add_options_page()` take a capability argument that WordPress enforces *before* the
   callback runs. `register_rest_route()` has `permission_callback`.
2. **The caller.** A `check_admin_referer()`, `check_ajax_referer()` or
   `current_user_can()` gate in the parent function protects everything it calls.
3. **The helper.** The value may already be escaped by the function that produced it, or
   passed through `wp_kses_post()` on write.

**Not a finding — read as hypotheses, never as conclusions.**

The right-hand column is what you must **verify in this specific code**, not what you may
assume. "It is probably gated by `add_submenu_page()`" is not a verification — open the
registration call and read the capability argument. If you cannot confirm the protection
exists, **it stays a finding**, recorded at the severity the evidence supports with a note
saying what you could not check. Dismissing a real issue is far worse than filing a
questionable one.

| Looks like | Actually |
|---|---|
| No `current_user_can()` in an admin page callback | The capability passed to `add_submenu_page()` already gates it. Worth an in-callback check as **Low / Hardening** — not Critical |
| No `wp_verify_nonce()` in the handler | `check_admin_referer()` already ran earlier in the same request |
| Unescaped `echo $var` | `$var` was escaped by the helper that produced it, or filtered through `wp_kses_post()` on write |
| `$wpdb->query()` with no `prepare()` | Every interpolated value is an `(int)` cast or `$wpdb->prefix`, so nothing is injectable. A variable *table name* is still a finding |
| `$_POST` read with no `sanitize_*` | The value is compared against an allow-list or cast to a type, and is never stored or echoed |
| Missing `ABSPATH` guard | The file is only ever `require`d from a guarded bootstrap and is not directly reachable |
| Nonce present but no capability check | Still a **real finding** — a nonce is not authorization. This one is never a false positive |

The table is not exhaustive in either direction. It does not list every false positive,
and it certainly does not list everything that is safe — a shape absent from it is not
thereby cleared. Judge the code, not the resemblance to a row.

If tracing does not settle it, report it at the severity the *evidence* supports and say
plainly what you could not verify. "I could not confirm X because Y" is useful to a
reviewer. A Critical you never traced is not.

**Calibration.** Re-read every Critical against one question: *who exactly can do this,
and what do they get?* If you cannot name the role and the impact in one sentence, it is
not Critical. A report where everything is Critical carries the same information as a
report where nothing is.

### 6. Rate honestly and report with evidence

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
- Every Critical and High was traced through §5 before being reported, not read off a
  single hunk.
- Every Critical and High has a named attack path and a concrete fix.
- The PHPCS security sniffs were run, or their absence is stated.
- No security sniff was silenced to reach green.
- Fixes are verified by a test where possible — a Subscriber getting 403 is a test, not a
  claim (see `cp-testing` §4).

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
- **Reporting a missing check that exists one level up.** The commonest false positive:
  the capability is on the `add_submenu_page()` call, or the nonce was verified by the
  caller. Trace it (§5) before you write it down.
- **Reporting a defence-in-depth suggestion as a vulnerability.** "Could also check the
  capability inside the callback" is Low / Hardening. Filing it as Critical is how a
  report loses its reader.
- **Declaring code secure.** You can report what you audited and found; you cannot certify
  absence. Say what you checked.

## Escalation

Tell the user immediately, before continuing other work, if you find a Critical issue in
released code — that is a disclosure and release decision, not a code change. Do not
publish details anywhere public. For plugins on WordPress.org, coordinate with the Plugin
Review team through their security process.

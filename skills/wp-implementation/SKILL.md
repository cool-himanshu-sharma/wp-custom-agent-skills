---
name: wp-implementation
description: "Use when writing or changing WordPress plugin PHP or JS: registering hooks, admin screens, settings, REST routes, CLI commands, storage and cron. Enforces WordPress guardrails at write time — capability check then nonce then sanitize input, escape at output, prefix everything, translate every string, keep the public surface stable."
compatibility: "WordPress 6.5+ / PHP 7.4+. Delegates deep API detail to the official WordPress skills."
---

# WP Implementation

Write the code, with WordPress's rules applied *as you write* rather than audited on
afterwards. Security and i18n retrofitted later are the two things reviewers most often
miss, because by then the code looks finished.

## When to use

- Any task that changes plugin PHP or JS.
- After `wp-planning` (Full/Standard depth) or directly after `wp-context-discovery`
  (Direct depth).

## Inputs required

- The Plugin Context Record — prefix, text domain, namespaces, existing surface.
- The task's acceptance criteria and its verify command.
- For Standard/Full depth: a failing test first (see `wp-testing`).

## Where the deep detail lives

This skill is the *discipline*. For canonical API detail, delegate:

| Work | Skill |
|---|---|
| Plugin structure, lifecycle, Settings API | `wp-plugin-development` |
| REST routes, controllers, schema | `wp-rest-api` |
| Blocks, `block.json`, save/edit | `wp-block-development` |
| Front-end interactivity directives | `wp-interactivity-api` |
| WP-CLI commands | `wp-wpcli-and-ops` |
| Admin component styling | `wpds` |

Do not restate their content here; read them when you hit that work.

## Procedure

### 1. Match the plugin before adding to it

Open a neighbouring file that does something similar and copy its shape: prefix, file
naming, class vs function style, how hooks get registered, how views are separated.
Consistency with this codebase beats consistency with the handbook.

### 2. Register hooks correctly

- No heavy work at file load. Register on hooks; do the work when the hook fires.
- `register_activation_hook` / `register_deactivation_hook` go at **top level of the
  main plugin file** — inside another hook they silently never fire.
- Admin-only code behind `is_admin()` or admin-only hooks, so the front end doesn't pay.
- Register CPTs/taxonomies on `init`, REST routes on `rest_api_init`, menus on `admin_menu`.
- `flush_rewrite_rules()` only on activation, and only *after* registering rules.

### 3. The request-handling order — always this order

Every entry point that accepts input (admin POST, AJAX, REST, CLI) does these in order:

```php
// 1. AUTHORIZE — who is this, may they do it at all?
if ( ! current_user_can( 'manage_options' ) ) {
    wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'acme-lm' ) ), 403 );
}

// 2. VERIFY INTENT — did they actually mean to, from our form?
check_admin_referer( 'acme_lm_save_key' );   // or check_ajax_referer() / a REST permission_callback

// 3. SANITIZE — unslash, then narrow to the expected shape
$key = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : '';

// 4. ACT
update_option( 'acme_lm_license_key', $key );
```

The order matters and is not interchangeable:

- **A nonce is not authorization.** It proves intent, not permission. A logged-in
  Subscriber gets a valid nonce from any page that renders one. Capability check first,
  every time.
- **A capability check is not intent.** Without a nonce, an admin can be tricked into
  the action via CSRF.
- **`wp_unslash()` before sanitizing.** WordPress adds slashes to superglobals; sanitize
  first and you store the escaped form.
- **REST**: `permission_callback` is mandatory and must never be `__return_true` on a
  route that writes. Use `rest_ensure_response()` and declare an `args` schema so
  WordPress validates for you.

### 4. Escape at output, late

Sanitizing on the way in does not make output safe. Escape at the moment of printing,
choosing by context:

| Context | Use |
|---|---|
| HTML text | `esc_html()` / `esc_html__()` / `esc_html_e()` |
| Attribute value | `esc_attr()` / `esc_attr__()` |
| URL | `esc_url()` (output) / `esc_url_raw()` (storage) |
| Inside `<script>` | `wp_json_encode()` — prefer `wp_localize_script()`/`wp_add_inline_script()` |
| Rich HTML from a user | `wp_kses_post()` or `wp_kses()` with an explicit allow-list |
| Textarea | `esc_textarea()` |

Never `echo` a variable with no escaping function around it, including values you just
read from your own option — the option may have been written by an earlier, buggier version.

### 5. Query the database safely

- `$wpdb->prepare()` for **every** query with a variable, with the right placeholder
  (`%s`, `%d`, `%f`). Table names cannot be placeholders — build those from
  `$wpdb->prefix` and a literal, never from input.
- Prefer `WP_Query`, `get_posts()`, `WP_User_Query` over raw SQL; they respect caching
  and filters.
- Never concatenate input into SQL. `"WHERE site = '" . $site . "'"` is an injection
  even when `$site` "comes from our own form".

### 6. Translate every user-facing string

Use the plugin's declared text domain, as a **literal** — `__( 'Save', $domain )` is
invisible to the string extractor. Add `translators:` comments for placeholder order,
`_n()` for plurals, `_x()` for ambiguous context. Never wrap a variable: `__( $message )`
does nothing.

### 7. Respect the public surface

Adding a hook, route, or option is a commitment. Renaming or removing one is a breaking
change — if the task requires it, ship the back-compat shim in the same commit
(`apply_filters_deprecated()`, `do_action_deprecated()`, keeping the old option readable).

### 8. Verify before claiming done

Run the task's verify command and paste real output. At minimum:

```bash
php -l <changed files>          # no parse errors
composer phpcs                   # or: vendor/bin/phpcs
composer test                    # or: vendor/bin/phpunit
```

If a tool is absent, say which one and what you did instead. Never substitute your own
reading for a check you did not run.

## Verification

- Every changed file parses.
- PHPCS clean, or every remaining warning explained.
- The failing test now passes and the suite has no new failures.
- Every new entry point has capability → nonce → sanitize, in that order.
- Every new output is escaped; every new string is translated with the right domain.
- `uninstall.php` updated if storage was added.
- Re-run `plugin_context.mjs`: the public surface changed exactly as intended, and no
  new autoloaded option appeared unintentionally.

## Failure modes

- **Nonce without capability** — the single most common WordPress plugin vulnerability.
- **`permission_callback => '__return_true'`** on a write route.
- **Sanitize-only, no escaping** — stored XSS, because sanitization is not contextual.
- **`__()` with a variable domain or a variable string** — nothing gets extracted.
- **Work at file load** instead of on a hook — slows every request, breaks activation order.
- **Activation hook registered inside another hook** — never fires; the bug surfaces as
  "settings missing on new installs only".
- **Renaming an internal-looking function that was public API.** Check the record first.

## Escalation

Stop and get explicit sign-off before running anything irreversible on real data — schema
migrations, option deletion, bulk content updates, changes to scheduled events. Flag
anything you cannot undo with `git revert`.

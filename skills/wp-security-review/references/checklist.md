# WordPress plugin security checklist

Per vulnerability class: what to grep for, what makes it a real finding, and the fix.
Use alongside the PHPCS `WordPress.Security.*` sniffs, which catch the mechanical subset.

---

## 1. Missing / wrong capability check

**Grep**
```bash
grep -rn "wp_ajax\|admin_post\|register_rest_route" --include=*.php .
grep -rn "current_user_can\|is_user_logged_in" --include=*.php .
```

**Finding when** a state-changing handler has no `current_user_can()`, or gates on
`is_user_logged_in()`, or uses a capability weaker than the action.

Capability guide — pick the weakest that still fits:

| Action | Capability |
|---|---|
| Plugin settings | `manage_options` |
| Edit any post | `edit_posts` / `edit_others_posts` |
| Edit one specific post | `current_user_can( 'edit_post', $post_id )` |
| Manage users | `edit_users` / `promote_users` |
| Install/update plugins | `install_plugins` / `update_plugins` |
| Read a private report | a custom capability granted on activation |

Always use the **meta** form for object-specific actions:
`current_user_can( 'edit_post', $post_id )` — not the bare `edit_posts`, which says
nothing about *this* post.

**Fix**
```php
if ( ! current_user_can( 'manage_options' ) ) {
    wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'acme-lm' ) ), 403 );
}
```

---

## 2. Missing nonce (CSRF)

**Grep**
```bash
grep -rn "wp_verify_nonce\|check_admin_referer\|check_ajax_referer" --include=*.php .
```

**Finding when** a request changes state and no nonce is verified.

```php
check_admin_referer( 'acme_lm_save_key' );                 // admin form POST
check_ajax_referer( 'acme_lm_nonce', 'security' );          // AJAX
wp_verify_nonce( $_POST['_wpnonce'], 'acme_lm_save_key' );  // manual — check the return!
```

`wp_verify_nonce()` **returns** a value; ignoring it verifies nothing. Prefer
`check_admin_referer()`, which dies on failure.

> A nonce proves intent, not permission. Always paired with a capability check, never
> instead of one.

---

## 3. Unsanitized input

**Grep**
```bash
grep -rn '\$_\(POST\|GET\|REQUEST\|COOKIE\|FILES\)' --include=*.php .
```

**Finding when** a superglobal is used without `wp_unslash()` then a sanitizer, or is
used directly in SQL, HTML, a file path, or a callback.

| Expected value | Sanitizer |
|---|---|
| Plain text | `sanitize_text_field()` |
| Textarea | `sanitize_textarea_field()` |
| Email | `sanitize_email()` |
| URL to store | `esc_url_raw()` |
| Integer / ID | `absint()` |
| Slug | `sanitize_key()` / `sanitize_title()` |
| HTML from an editor | `wp_kses_post()` |
| One of a fixed set | `in_array( $v, $allowed, true )` — validate, do not sanitize |

Order matters: `sanitize_text_field( wp_unslash( $_POST['k'] ) )`. Reversing it stores
the slashed form.

Arrays need recursion — `sanitize_text_field()` on an array returns an empty string:

```php
$ids = array_map( 'absint', (array) ( $_POST['ids'] ?? array() ) );
```

For a fixed set of values, **validate against an allow-list** rather than sanitizing.
Sanitizing produces *some* string; validating produces a string you chose.

---

## 4. Unescaped output (XSS)

**Finding when** any variable is printed without a context-correct escaping function —
including values read from your own options and post meta.

```php
echo esc_html( $name );
printf( '<a href="%s">%s</a>', esc_url( $url ), esc_html( $label ) );
echo '<input value="' . esc_attr( $value ) . '">';
echo wp_kses_post( $rich_html );
wp_localize_script( 'acme-lm', 'acmeLM', array( 'nonce' => wp_create_nonce( 'acme_lm' ) ) );
```

Traps:

- `esc_attr()` inside an unquoted attribute is still injectable — always quote.
- Escaping into `<script>` needs `wp_json_encode()`, not `esc_html()`.
- `esc_url()` for output, `esc_url_raw()` for storage.
- Translation functions do not escape: use `esc_html__()`, not `__()`.
- Sanitizing on write does **not** remove the need to escape on read.

---

## 5. SQL injection

**Grep**
```bash
grep -rn 'wpdb->\(query\|get_results\|get_row\|get_var\|get_col\)' --include=*.php .
```

**Finding when** any variable reaches SQL without `prepare()`.

```php
// Vulnerable
$wpdb->get_row( "SELECT * FROM {$wpdb->prefix}acme WHERE site = '" . $site . "'" );

// Correct
$wpdb->get_row( $wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}acme WHERE site = %s",
    $site
) );
```

- Placeholders: `%s` string, `%d` integer, `%f` float. Do **not** quote them yourself —
  `'%s'` is a bug.
- Table and column names cannot be placeholders. Build them from `$wpdb->prefix` plus a
  literal, or validate against an allow-list. Never from input.
- `IN (...)` needs a generated placeholder list:
  ```php
  $in = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
  $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE id IN ($in)", $ids ) );
  ```
- `LIKE` needs `$wpdb->esc_like()` before `prepare()`.
- Prefer `WP_Query` / `get_posts()` / `WP_User_Query` — they are cached and filterable.

---

## 6. REST API

**Finding when** `permission_callback` is `__return_true` on a route that writes, is
missing (WordPress warns and the route is effectively public), or checks only login.

```php
register_rest_route( 'acme-lm/v1', '/license', array(
    'methods'             => WP_REST_Server::EDITABLE,
    'callback'            => array( $this, 'update' ),
    'permission_callback' => static function () {
        return current_user_can( 'manage_options' );
    },
    'args'                => array(
        'site' => array(
            'required'          => true,
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'validate_callback' => static fn( $v ) => is_string( $v ) && strlen( $v ) <= 253,
        ),
    ),
) );
```

`__return_true` is legitimate only on a genuinely public read of already-public data —
and it deserves a comment saying so.

Declaring `args` with `sanitize_callback` and `validate_callback` makes WordPress do the
work, and is far more reliable than sanitizing by hand inside the callback.

---

## 7. AJAX

`wp_ajax_nopriv_{action}` is **unauthenticated**. Every one is an entry point for the
whole internet. Audit each individually and justify why it exists.

```php
add_action( 'wp_ajax_acme_lm_save', array( $this, 'save' ) );        // logged-in
add_action( 'wp_ajax_nopriv_acme_lm_save', array( $this, 'save' ) ); // ANYONE — justify
```

Note that `wp_ajax_{action}` alone still means *any logged-in user*, including
Subscriber. It is not an admin-only hook.

---

## 8. File operations

- Uploads: `wp_handle_upload()` with `wp_check_filetype_and_ext()`. Never trust
  `$_FILES['name']` or the client-provided MIME type.
- Never allow `.php`, `.phtml`, `.phar` or `.htaccess` through an upload path.
- Path containment before any read/write/delete:
  ```php
  $base = realpath( $allowed_dir );
  $real = realpath( $candidate );
  if ( false === $real || 0 !== strpos( $real, $base ) ) {
      wp_die( esc_html__( 'Invalid path.', 'acme-lm' ) );
  }
  ```
- Prefer `WP_Filesystem` over direct `fopen`/`unlink` for host compatibility.

---

## 9. SSRF

**Finding when** a request-supplied URL is fetched.

```php
$host = wp_parse_url( $url, PHP_URL_HOST );
if ( ! in_array( $host, array( 'api.example.com' ), true ) ) {
    return new WP_Error( 'invalid_host', __( 'Host not allowed.', 'acme-lm' ) );
}
$response = wp_remote_get( $url, array( 'timeout' => 5, 'redirection' => 0 ) );
```

Always `wp_remote_*` rather than cURL or `file_get_contents()` — it honours site HTTP
filters and proxy configuration. Block redirects, or re-validate the target after each.

---

## 10. Object injection

`unserialize()` on any value an attacker can influence is remote code execution when a
suitable gadget chain exists on the site — and WordPress installs carry many.

```php
$data = json_decode( $raw, true );          // preferred
$data = maybe_unserialize( $trusted_only ); // only for values you wrote
```

---

## 11. Direct file access

Every PHP file reachable by URL starts with:

```php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
```

Missing this turns any file with side effects into an unauthenticated entry point.

---

## 12. Information disclosure

- Never echo licence keys, API tokens, or absolute server paths into HTML or JS.
- Never log secrets, including into `error_log()`.
- Check that REST responses do not include fields the caller's role should not see.
- Debug output guarded by `WP_DEBUG` still ships to production sites that enable it.

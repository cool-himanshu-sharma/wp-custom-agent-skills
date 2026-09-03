# WordPress coding standards — the parts that matter

The full standard is enforced by PHPCS (`cp-static-analysis`). This page covers what the
sniffs cannot check and what reviewers repeatedly find.

## Naming and prefixes

Everything global carries the plugin prefix — functions, classes, constants, option keys,
hook names, meta keys, CPT and taxonomy slugs, script and style handles.

```php
function acme_lm_get_license() {}
class Acme_LM_Admin {}
const ACME_LM_VERSION = '1.4.2';
update_option( 'acme_lm_license_key', $key );
do_action( 'acme_lm_license_expired', $id );
wp_enqueue_script( 'acme-lm-admin', ... );
```

This is not style. Two plugins defining `get_settings()` fatal the site. PHPCS
`WordPress.NamingConventions.PrefixAllGlobals` enforces it once configured with your
prefixes — configure it.

Post type and taxonomy slugs are capped at 20 and 32 characters and are stored in the
database forever. Choose once.

## Text domain

The text domain must be a **literal** matching the plugin header, in every call:

```php
__( 'Save', 'acme-license-manager' );            // correct
__( 'Save', $domain );                            // never extracted
__( $label, 'acme-license-manager' );             // never extracted
esc_html__( 'Save', 'acme-license-manager' );     // translate AND escape
```

Translation functions do not escape. Use the `esc_html__` / `esc_attr__` family when the
result is printed.

Placeholders need `translators:` comments so translators can reorder them:

```php
/* translators: %1$s: plugin name, %2$s: expiry date */
printf(
    esc_html__( '%1$s expires on %2$s.', 'acme-license-manager' ),
    esc_html( $name ),
    esc_html( $date )
);
```

Use `%1$s`-style numbered placeholders whenever there is more than one — some languages
must reorder them.

## Yoda conditions

```php
if ( 'expired' === $status ) {
```

Enforced by WPCS. The rationale is that a typo becomes a parse error rather than a silent
assignment.

## Escaping and sanitizing

Covered in depth in `skills/cp-security-review/references/checklist.md`. The rules that
belong in muscle memory:

- Sanitize on the way **in**, escape on the way **out**. They are different jobs and
  neither substitutes for the other.
- `wp_unslash()` **before** sanitizing a superglobal.
- Escape at the point of printing, not earlier — an escaped value passed through more
  code can be modified after escaping.
- Escape values read from your own options too: an older version may have written them.

## Arrays and spacing

```php
$args = array(
    'post_type'      => 'acme_license',
    'posts_per_page' => 20,
);
```

WordPress uses long `array()` syntax in core-facing code, aligned `=>`, tabs for
indentation, and a trailing comma on multi-line arrays. `phpcbf` fixes all of it — never
hand-format.

## Comparison and types

- `===` unless you specifically want juggling.
- `in_array( $v, $allowed, true )` — the strict flag is not optional; without it
  `in_array( 0, array( 'a', 'b' ) )` is true on PHP 7.
- Cast values from options and request data; they are `mixed` by nature.

## What not to do

- No `@` error suppression — it hides the failure you need to see.
- No `extract()`.
- No `$_REQUEST` — be explicit about `$_GET` versus `$_POST`.
- No `date()`/`time()` for anything user-facing — use `current_time()`,
  `wp_date()`, and the site's timezone.
- No direct `$_SERVER['REQUEST_URI']` without sanitizing.
- No `mysql_*` or raw `mysqli` — use `$wpdb`.
- No `session_start()` — WordPress is stateless and many hosts break on it.

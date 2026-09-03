# WordPress plugin architecture reference

Patterns that hold up in plugins maintained over years and installed on sites you cannot
inspect. This is general WordPress practice (L2-adjacent); house rules live in
`cp-conventions` and override anything here.

## Bootstrap

The main plugin file does four things and nothing else: declare the header, guard direct
access, define constants, and hand off.

```php
<?php
/**
 * Plugin Name: Acme License Manager
 * Version:     1.4.2
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: acme-license-manager
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ACME_LM_VERSION', '1.4.2' );
define( 'ACME_LM_FILE', __FILE__ );
define( 'ACME_LM_DIR', plugin_dir_path( __FILE__ ) );

require_once ACME_LM_DIR . 'includes/class-acme-lm-plugin.php';

// Lifecycle hooks MUST be registered at top level of this file.
register_activation_hook( __FILE__, array( 'Acme_LM_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Acme_LM_Plugin', 'deactivate' ) );

add_action( 'plugins_loaded', array( 'Acme_LM_Plugin', 'boot' ) );
```

Why this shape:

- **No work at file load.** Everything real happens on a hook. Code that runs at load time
  runs before WordPress is ready and slows every request.
- **Lifecycle hooks at top level.** Registered inside another hook they silently never
  fire — a bug that only shows up on new installs.
- **`plugins_loaded` for boot**, so other plugins are available and your hooks can be
  filtered.

## Load order

```
muplugins_loaded → plugins_loaded → after_setup_theme → init → wp_loaded
                                                       ↓
                                    admin_init / template_redirect / rest_api_init
```

- Register CPTs, taxonomies and shortcodes on `init`.
- Register REST routes on `rest_api_init`.
- Register admin menus on `admin_menu`, settings on `admin_init`.
- Never assume a hook that has already fired will fire again.

## Separating concerns

```
acme-license-manager.php      bootstrap only
includes/
  class-acme-lm-plugin.php    wiring: which hooks, which classes
  class-acme-lm-admin.php     admin screens (loaded only when is_admin())
  class-acme-lm-rest.php      REST controller
  class-acme-lm-license.php   domain logic — no WordPress output, testable
  class-acme-lm-install.php   activation, migrations, schema version
views/                        markup, escaped at render
assets/                       built CSS/JS
languages/                    .pot and translations
uninstall.php                 data removal
```

The valuable line is between **domain logic** and **WordPress plumbing**. Logic that does
not echo and does not touch superglobals can be unit-tested in milliseconds; everything
mixed into a render method needs a browser.

Load admin-only code behind `is_admin()` so the front end does not pay for it.

## Activation, migration, uninstall

```php
public static function activate() {
    self::maybe_upgrade();
}

public static function maybe_upgrade() {
    $installed = get_option( 'acme_lm_db_version', '0' );
    if ( version_compare( $installed, ACME_LM_VERSION, '>=' ) ) {
        return;                       // idempotent: safe to run repeatedly
    }
    if ( version_compare( $installed, '1.4.0', '<' ) ) {
        self::migrate_to_140();
    }
    update_option( 'acme_lm_db_version', ACME_LM_VERSION, false );
}
```

- **Idempotent, always.** Activation runs on reactivation, and on every site of a network.
- Also call `maybe_upgrade()` on `plugins_loaded`: an update installed by file copy never
  fires the activation hook, so migration-on-activation alone misses most upgrades.
- `flush_rewrite_rules()` only on activation, and only after registering rules.
- Keep `uninstall.php` current with storage. It must remove what the plugin created and
  nothing else — never another plugin's data, never user content.

## Storage decisions

| Storage | Use when | Cost |
|---|---|---|
| Option | One global setting | Autoloaded options load on **every** request |
| Post/term/user meta | Belongs to one object | Meta queries do not scale |
| Custom table | Many rows, queried by real columns | You own schema, migration, uninstall |
| Transient | Recomputable cache | Falls back to the options table with no object cache |

Default to options and meta. A custom table is a real commitment — take it only when the
data is large, or queried by columns meta cannot index.

## Extensibility

Every hook you add is permanent API. Add them deliberately:

```php
$days = (int) apply_filters( 'acme_lm_expiry_threshold_days', 30 );
do_action( 'acme_lm_license_expired', $license_id );
```

- Prefix every hook name with the plugin prefix.
- Pass enough context that a filter can make a real decision.
- Document with `@since`.
- Deprecate rather than remove: `apply_filters_deprecated()`, `do_action_deprecated()`.

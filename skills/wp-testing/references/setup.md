# Minimal WordPress plugin test setup

Add this only when the task warrants it, and as its own task — never as a silent
expansion of an unrelated change.

## PHPUnit with the WordPress test suite (via wp-env)

`.wp-env.json` in the plugin root:

```json
{
  "core": null,
  "plugins": [ "." ],
  "phpVersion": "7.4"
}
```

`composer.json`:

```json
{
  "require-dev": {
    "phpunit/phpunit": "^9",
    "yoast/phpunit-polyfills": "^2.0"
  },
  "scripts": {
    "test": "phpunit",
    "phpcs": "phpcs",
    "phpstan": "phpstan analyse"
  }
}
```

`phpunit.xml.dist`:

```xml
<?xml version="1.0"?>
<phpunit bootstrap="tests/bootstrap.php" colors="true">
  <testsuites>
    <testsuite name="plugin">
      <directory suffix="Test.php">./tests/</directory>
    </testsuite>
  </testsuites>
</phpunit>
```

`tests/bootstrap.php` — load the plugin on `muplugins_loaded` so it boots before the
test suite finishes initialising:

```php
<?php
$wp_tests_dir = getenv( 'WP_TESTS_DIR' ) ?: '/wordpress-phpunit';

require_once $wp_tests_dir . '/includes/functions.php';

tests_add_filter(
    'muplugins_loaded',
    function () {
        require dirname( __DIR__ ) . '/acme-license-manager.php';
    }
);

require $wp_tests_dir . '/includes/bootstrap.php';
```

Run:

```bash
npx wp-env start
npx wp-env run tests-cli --env-cwd=wp-content/plugins/SLUG vendor/bin/phpunit
```

## Playwright end-to-end

```bash
npm i -D @playwright/test @wordpress/e2e-test-utils-playwright
npx playwright test
```

Reserve this for flows that genuinely need a browser — editor interaction, multi-screen
admin journeys. Everything else belongs in PHPUnit, where it runs in milliseconds and
does not flake.

## No Docker available

Use WordPress Playground for a reproducible environment without Docker; see the
`wp-playground` and `blueprint` skills. A Blueprint that installs the plugin and walks to
the failing screen is a legitimate, shareable reproduction — and far better evidence than
"I reviewed the code and it looks correct".

## What to test first in a plugin with no tests

Do not attempt full coverage. Land these four, in this order:

1. The bug you are fixing right now.
2. Every `permission_callback` and capability gate — cheap to write, highest severity.
3. Activation on a clean site: no fatals, no notices, expected options created.
4. The upgrade path from the previous released version.

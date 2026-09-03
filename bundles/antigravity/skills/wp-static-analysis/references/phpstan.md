# PHPStan for WordPress plugins

PHPStan does not know WordPress exists. Without stubs it reports every core function as
undefined, the signal drowns, and the team turns the tool off. Install stubs first.

For deeper configuration, third-party class handling and baseline strategy, use the
upstream `wp-phpstan` skill — this page is the minimum needed to get a useful run.

## Install

```bash
composer require --dev phpstan/phpstan:^1 szepeviktor/phpstan-wordpress:^1
```

`szepeviktor/phpstan-wordpress` brings WordPress function and class stubs plus the
dynamic-return-type extensions that make `get_post()`, `get_option()` and friends
analysable.

## A working `phpstan.neon.dist`

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon

parameters:
    level: 5
    paths:
        - .
    excludePaths:
        - vendor/*
        - node_modules/*
        - build/*
        - tests/fixtures/*
    bootstrapFiles:
        - tests/phpstan-bootstrap.php
    scanFiles:
        - vendor/php-stubs/woocommerce-stubs/woocommerce-stubs.php
```

`tests/phpstan-bootstrap.php` defines constants PHPStan cannot infer:

```php
<?php
define( 'ACME_LM_VERSION', '1.4.2' );
define( 'ACME_LM_FILE', __FILE__ );
```

## Choosing a level

| Level | Catches | Good for |
|---|---|---|
| 0–2 | Unknown functions/classes, obvious arg-count errors | Any plugin, day one |
| 5 | Wrong argument types, bad return types | **The sensible target for most plugins** |
| 6–7 | Missing type hints, unsafe nullable access | Modern, typed codebases |
| 8–9 | Strict null safety | Rarely worth it in WordPress code |

Start where the plugin can pass today, commit it, then raise one level at a time.

## Baselines

```bash
vendor/bin/phpstan analyse --generate-baseline
```

Commit `phpstan-baseline.neon`. It records pre-existing errors so CI can enforce
"no *new* errors" on a legacy codebase.

Rules:

- A baseline is **accepted debt**, not a fix.
- Never regenerate it to make your own new error disappear. That converts a bug you just
  wrote into permanent, invisible debt — and it is nearly undetectable in review.
- Shrinking the baseline is a good standalone task.

If CI fails and the tempting fix is regenerating the baseline, that is the signal your
change introduced a real type error. Fix the code.

## Interpreting common WordPress findings

| Message | Usually means |
|---|---|
| `Function get_option() should return ... but returns mixed` | You need to narrow the option value — options are `mixed` by design, so validate what came back |
| `Cannot call method on WP_Post\|null` | `get_post()` can return null; guard it |
| `Access to undefined constant` | Add it to `bootstrapFiles` |
| `Unknown class WooCommerce` | Add that project's stubs to `scanFiles` |
| `Comparison ... is always false` | Frequently a real bug — a strict comparison against the wrong type |

The `mixed` findings around `get_option()` are worth taking seriously rather than
suppressing: an option can hold whatever an older version of the plugin, or another
plugin, wrote into it.

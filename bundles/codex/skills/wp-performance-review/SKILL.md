---
name: wp-performance-review
description: "Use to find and fix WordPress plugin performance problems: autoloaded options, queries in loops, unindexed meta queries, uncached remote requests, work on every request, cron pile-ups, and unconditional asset enqueueing. Use when a site is slow, when adding storage or admin UI, and before release."
compatibility: "WordPress 6.5+ / PHP 7.4+. Uses Query Monitor and WP-CLI profile where available."
---

# WP Performance Review

A plugin runs on shared hosting alongside twenty others. Its performance budget is not
"fast enough on my laptop" — it is "adds no measurable cost to a request that does not
use it".

Measure before optimising. Most WordPress plugin slowness comes from a short list of
mistakes, but guessing which one is present wastes more time than measuring.

## When to use

- A site or admin screen is slow.
- Any task that adds an option, query, cron event, or asset.
- Before release.

## Inputs required

- The Plugin Context Record — `storage.autoloaded_option_writes`, `cron_hooks`,
  `custom_tables`, and the hook list.
- Where the slowness is observed: front end, admin, editor, or WP-CLI.

## Procedure

### 1. Measure

Delegate to the upstream `wp-performance` skill for the full measurement toolkit. The
fast path:

```bash
wp profile stage --all                    # which load stage costs
wp profile hook --all --spotlight         # which hook costs
wp profile eval 'acme_lm_expensive();'
```

Query Monitor in the browser gives per-request queries, slow queries, HTTP calls and
hook timings. Without a measurement, any optimisation is a guess.

### 2. Check the WordPress-specific cost centres

These, in order, account for most plugin performance defects.

**Autoloaded options.** Every autoloaded option is fetched on *every* request, forever.

```bash
wp option list --autoload=on --format=table --fields=option_name,size_bytes | sort -k2 -nr | head -20
```

Rules: autoload only small, hot config. Never autoload cached API responses, logs, or
anything unbounded. `add_option( $k, $v, '', false )` for the rest. This is the single
most common WordPress plugin performance bug, and it is permanent — it persists after the
plugin is deactivated unless uninstall cleans up.

**Queries in loops.** `get_post_meta()` inside a post loop is fine (WordPress primes the
cache); a `WP_Query` or `$wpdb` call inside a loop is not. Batch instead: fetch all ids,
then one query.

**Unindexed meta queries.** `meta_query` scans `wp_postmeta`. At scale this is the
slowest thing a plugin can do. If you query by a value regularly, it belongs in a taxonomy
or a custom table with an index — that decision belongs in `wp-specification` §3.

**Uncached remote requests.** Never call an external API on a page load without a cache.

```php
$data = get_transient( 'acme_lm_license_status' );
if ( false === $data ) {
    $response = wp_remote_get( $url, array( 'timeout' => 5 ) );
    $data     = is_wp_error( $response ) ? null : json_decode( wp_remote_retrieve_body( $response ), true );
    set_transient( 'acme_lm_license_status', $data, HOUR_IN_SECONDS );
}
```

Always set a short `timeout` (default is 5s but many plugins raise it) and always cache
the failure too, or a down API turns into a down site.

**Work on every request.** Registering a hook is cheap; doing work in it is not. Guard by
context: `is_admin()`, the specific screen, the specific post type. A licence check does
not belong on `init` for front-end visitors.

**Unconditional asset enqueueing.** Load CSS/JS only on screens that use them:

```php
add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( 'toplevel_page_acme-license' !== $hook ) {
        return;
    }
    wp_enqueue_script( 'acme-lm-admin', ... );
} );
```

**Cron.** `wp-cron` fires on page loads. A heavy job blocks a visitor's request. Keep
jobs small and idempotent, batch large work across runs, and never schedule an event on
every page load — check `wp_next_scheduled()` first.

### 3. Fix in cost order, and re-measure

Fix the largest measured cost first. Then measure again — an optimisation that does not
move the number is complexity with no benefit and should be reverted.

### 4. Report with numbers

```
Before  admin dashboard: 1,240 ms, 312 queries
Cause   acme_lm_get_all_licences() ran a WP_Query per row (287 queries)
Fix     single query with post__in, results primed into the cache
After   admin dashboard: 310 ms, 27 queries
```

A performance claim without a before and after is not a result.

## Verification

- The measurement was taken, not assumed.
- No new autoloaded option; `autoload` was set deliberately.
- No query inside a loop; no uncached remote call.
- Assets enqueued only where used.
- After numbers exist and show real improvement.

## Failure modes

- **Optimising without measuring.** Usually the wrong thing, always unprovable.
- **Autoloading a growing option.** Slows every request on the site permanently.
- **Caching without an expiry, or not caching failures.** A down API becomes a down site.
- **Micro-optimising PHP** while a 300-query page sits untouched.
- **Adding an object cache dependency.** Many sites have no persistent cache; transients
  fall back to the options table, so a transient is not free.
- **Testing on an empty database.** Meta query problems only appear at scale — test with
  realistic row counts.

## Escalation

Ask the user before adding a custom table or changing an existing option's `autoload`
flag on sites already in the wild — both need a migration, and the migration is the risky
part, not the optimisation.

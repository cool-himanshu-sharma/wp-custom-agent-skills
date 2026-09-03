---
name: cp-release-process
description: "Ship a WordPress plugin release: choose the version bump, sync version strings, update readme.txt and changelog, build translations and assets, run the full verification gate, package a clean zip, tag, and plan the rollout. Use when publishing to WordPress.org, cutting a tag, shipping a premium update, or preparing a hotfix."
compatibility: "WordPress 6.5+ / PHP 7.4+. Uses WP-CLI, composer, npm and grunt/wp-org tooling where present."
---

# WP Release

A plugin release auto-updates on sites you do not control and cannot roll back for.
There is no gradual rollout and no "revert the deploy" — a bad release is a support
incident measured in thousands of sites. The gate below exists for that reason.

## When to use

- Publishing any version, to WordPress.org or as a premium update.
- Cutting a release candidate or a hotfix.

## Inputs required

- The changes since the last tag (`git log --oneline <lasttag>..HEAD`).
- The Plugin Context Record — current version, headers, toolchain.
- Whether this plugin ships on WordPress.org (adds directory-guideline requirements).

## Procedure

### 1. Choose the version

WordPress plugins are consumed by sites, not by developers pinning ranges — treat the
public surface as the contract.

| Bump | When |
|---|---|
| **Patch** 1.4.1 → 1.4.2 | Bug fixes only. No new surface, no data change. |
| **Minor** 1.4.2 → 1.5.0 | New features, new hooks/routes, additive data changes. |
| **Major** 1.5.0 → 2.0.0 | Removed or renamed public API, migration that cannot be reversed, raised minimum WP/PHP. |

Raising `Requires at least` or `Requires PHP` is a **major** decision regardless of the
code change — it strands sites, which silently stop receiving updates.

### 2. Sync every version string

Version lives in more places than expected, and a mismatch breaks updates:

- The `Version:` plugin header (**the one WordPress actually reads**)
- A `VERSION` constant, if defined
- `readme.txt` `Stable tag`
- `package.json` / `composer.json`
- Any `@since` tags on new hooks or functions

```bash
grep -rn "1\.4\.1" --include=*.php --include=*.txt --include=*.json . | grep -v vendor
```

`Stable tag` in `readme.txt` is what WordPress.org serves. A wrong value ships the wrong
version to every site — verify it explicitly.

### 3. Update `readme.txt` and the changelog

`readme.txt` is not documentation, it is a manifest WordPress.org parses:

```
=== Acme License Manager ===
Contributors: acme
Tags: licence, updates
Requires at least: 6.5
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.4.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
```

- `Tested up to` must reflect a version you actually tested against.
- Changelog entries describe user-visible change, not commit subjects.
- Anything requiring site-owner action goes in an **Upgrade Notice**.

For WordPress.org submissions, run the `wp-plugin-directory-guidelines` skill — GPL
compliance, trademark use, and upsell rules are enforced by human review and rejection
costs days.

### 4. Build

```bash
composer install --no-dev --optimize-autoloader   # dev deps must not ship
npm ci && npm run build
wp i18n make-pot . languages/<slug>.pot
wp i18n make-json languages/ --no-purge           # if the plugin ships JS strings
```

Verify the zip contains **only** what runs in production: no `node_modules`, no `tests/`,
no `.git`, no `.env`, no source maps you did not intend, no dev dependencies. Use
`.distignore` or the build script — never hand-assemble.

```bash
unzip -l acme-license-manager.zip | head -50
```

### 5. Run the full gate

Every one of these, with real output. This is the last point where a defect is cheap.

```bash
find . -name '*.php' -not -path './vendor/*' -print0 | xargs -0 -n1 php -l
vendor/bin/phpcs
vendor/bin/phpstan analyse
vendor/bin/phpunit
npx playwright test                     # if present
```

Then the checks automation cannot do — see `references/release-checklist.md`:

- Activate the built zip on a **clean** site: no fatals, no notices.
- Upgrade from the **previous released version** with real data: migration runs once,
  is idempotent, and data survives.
- Deactivate/reactivate: no duplicate options, no duplicate scheduled events.
- Uninstall: removes what it should and nothing else.
- Test on the **minimum** declared WP and PHP, not just the latest.

The upgrade test is the one most often skipped and the one that causes the worst
incidents. Fresh-install testing does not exercise migrations at all.

### 6. Tag and publish

```bash
git tag -a v1.4.2 -m "Release 1.4.2"
git push origin v1.4.2
```

Publish to WordPress.org SVN (or your update server), then verify a real site sees and
installs the update.

### 7. Watch

Auto-updates mean problems arrive fast. For the first 24–48 hours watch support channels,
the .org support forum, and error reporting. Know in advance how you would ship a
hotfix — that plan is part of the release, not a reaction to the incident.

## Verification

- All version strings match, `Stable tag` included.
- Full gate run, with output, and nothing silenced to get there.
- Clean install **and** upgrade-from-previous both verified with the built artifact.
- The zip contains no dev files.
- Changelog and upgrade notice describe real user impact.
- Tag pushed and matches what was published.

## Failure modes

- **`Stable tag` not bumped.** The release exists in SVN and nobody receives it.
- **Shipping `node_modules` or `vendor` dev dependencies.** Bloat, and sometimes a
  vulnerability with a CVE attached to your plugin.
- **Testing only a fresh install.** Migrations never run, so the bug ships to every
  existing site and only existing sites.
- **Non-idempotent migration.** Runs twice, duplicates rows or events.
- **Raising the PHP minimum in a patch release.** Sites silently stop updating.
- **`Tested up to` raised without testing.** A support and trust problem.
- **Releasing on a Friday** with no capacity to respond for two days.

## Escalation

Get explicit sign-off before any release that removes public API, migrates data
irreversibly, or raises a minimum version. Those are product decisions with a support
cost, and they cannot be undone once sites have auto-updated.

# Release checklist

Work top to bottom. Anything unchecked is a release blocker unless the user explicitly
accepts it.

## Versioning
- [ ] Bump chosen deliberately (patch / minor / major) and justified by the diff
- [ ] `Version:` plugin header updated — *the value WordPress reads*
- [ ] `VERSION` constant updated (if the plugin defines one)
- [ ] `readme.txt` `Stable tag` matches — **wrong value ships the wrong version**
- [ ] `package.json` / `composer.json` versions match
- [ ] `@since` tags on new hooks, functions and public methods
- [ ] `Requires at least` / `Requires PHP` still accurate for every API used

## Documentation
- [ ] Changelog describes user-visible change, not commit subjects
- [ ] Upgrade Notice present if site owners must do something
- [ ] `Tested up to` reflects a version actually tested
- [ ] New hooks and filters documented for developers
- [ ] Breaking changes called out prominently

## Build artifact
- [ ] `composer install --no-dev --optimize-autoloader`
- [ ] `npm ci && npm run build`
- [ ] `.pot` regenerated; `make-json` run if JS strings ship
- [ ] Zip excludes `node_modules`, `tests`, `.git`, `.github`, `.env`, dev configs
- [ ] Zip contents listed and eyeballed (`unzip -l`)
- [ ] No secrets, no absolute local paths, no leftover debug code

## Automated gate
- [ ] `php -l` on every shipped PHP file — zero syntax errors
- [ ] PHPCS clean, or every remaining item justified in writing
- [ ] PHPStan at or below baseline, and the baseline was **not** regenerated
- [ ] PHPUnit green, no new skips
- [ ] JS tests / Playwright green (or absence stated)
- [ ] No `WordPress.Security.*` sniff silenced to reach green

## Manual gate — the part automation cannot do
- [ ] **Clean install**: activate the built zip on a fresh site — no fatals, no notices
- [ ] **Upgrade**: install the *previous released version*, add real data, upgrade to this
      build — migration runs once, data survives, no notices
- [ ] **Migration idempotency**: run the upgrade routine twice — no duplicate rows,
      options or scheduled events
- [ ] **Deactivate / reactivate**: no duplicate cron events, no reset settings
- [ ] **Uninstall**: removes what it should, leaves what it should
- [ ] **Minimum versions**: tested on the declared minimum WP *and* PHP, not just latest
- [ ] **Multisite**: network activate and test, if the plugin claims support
- [ ] **Default theme + no other plugins**, then with the usual companions

## WordPress.org only
- [ ] GPL-compatible licence, headers present
- [ ] No trademark misuse in the slug, name, or tags
- [ ] Upsell/freemium presentation within directory rules
- [ ] No external calls without disclosure and consent
- [ ] No obfuscated or minified-only code without sources
- [ ] Assets (banner, icon, screenshots) present and correctly named
- [ ] `wp-plugin-directory-guidelines` skill run

## Ship
- [ ] Tag created and pushed, matching the shipped version
- [ ] Published to SVN or the update server
- [ ] A real site sees the update and installs it cleanly
- [ ] Release notes posted where users read them

## Watch (first 24–48 hours)
- [ ] Support channels and .org forum monitored
- [ ] Error reporting watched for a spike
- [ ] Hotfix path known *before* it is needed
- [ ] Someone is actually available — do not ship into a weekend with no cover

# PHPCS for WordPress plugins

## Install

```bash
composer require --dev \
  wp-coding-standards/wpcs:^3 \
  phpcompatibility/phpcompatibility-wp:^2 \
  dealerdirect/phpcodesniffer-composer-installer:^1
```

The `composer-installer` plugin registers the standards automatically. Without it PHPCS
reports `the "WordPress" coding standard is not installed`.

## A working `phpcs.xml.dist`

```xml
<?xml version="1.0"?>
<ruleset name="Acme License Manager">
	<description>WordPress coding standards for this plugin.</description>

	<file>.</file>
	<exclude-pattern>/vendor/*</exclude-pattern>
	<exclude-pattern>/node_modules/*</exclude-pattern>
	<exclude-pattern>/build/*</exclude-pattern>
	<exclude-pattern>/tests/fixtures/*</exclude-pattern>

	<arg name="extensions" value="php"/>
	<arg name="colors"/>
	<arg value="sp"/><!-- show sniff names and progress -->
	<arg name="parallel" value="8"/>

	<rule ref="WordPress">
		<!-- Opt out of pure-style rules the team does not want, never security ones. -->
		<exclude name="WordPress.Files.FileName"/>
	</rule>

	<!-- Prefix enforcement: catches collisions with other plugins. -->
	<rule ref="WordPress.NamingConventions.PrefixAllGlobals">
		<properties>
			<property name="prefixes" type="array">
				<element value="acme_lm"/>
				<element value="ACME_LM"/>
				<element value="Acme\LM"/>
			</properties>
		</properties>
	</rule>

	<!-- Text domain enforcement: catches strings that will never translate. -->
	<rule ref="WordPress.WP.I18n">
		<properties>
			<property name="text_domain" type="array">
				<element value="acme-license-manager"/>
			</property>
		</properties>
	</rule>

	<!-- Match the plugin's declared "Requires PHP". -->
	<config name="testVersion" value="7.4-"/>
	<rule ref="PHPCompatibilityWP"/>
</ruleset>
```

Two rules there earn their keep beyond style: `PrefixAllGlobals` prevents fatal
collisions with other plugins on the same site, and `WP.I18n` catches strings that
silently never translate.

## The sniffs that are actually security findings

| Sniff | Catches |
|---|---|
| `WordPress.Security.EscapeOutput` | Output printed without escaping — XSS |
| `WordPress.Security.ValidatedSanitizedInput` | Superglobal used without unslash/sanitize |
| `WordPress.Security.NonceVerification` | State-changing request with no nonce check |
| `WordPress.DB.PreparedSQL` | Variable interpolated into SQL |
| `WordPress.DB.PreparedSQLPlaceholders` | Wrong or missing `prepare()` placeholders |
| `WordPress.WP.GlobalVariablesOverride` | Clobbering a WordPress global |
| `WordPress.PHP.NoSilencedErrors` | `@` hiding a real failure |

Fix every one of these in changed code. Never silence them to reach green.

## Legacy codebase: how to adopt without drowning

Do not "fix all warnings" as a side quest. Instead:

1. Run PHPCS only on changed files, so new code is clean:
   ```bash
   git diff --name-only --diff-filter=ACM origin/main... | grep '\.php$' \
     | xargs -r vendor/bin/phpcs -s
   ```
2. Add the security sniffs repo-wide immediately — those are worth the noise.
3. Move remaining style rules in over time, one sniff per PR.

## Justified ignores

When a value is provably safe, the ignore carries its proof on the same line:

```php
// Already escaped by wp_kses_post() on write, and re-escaped on render below.
echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
```

An ignore with no reason is a defect. An ignore on a whole file removes it from
enforcement permanently and should be treated as a review blocker.

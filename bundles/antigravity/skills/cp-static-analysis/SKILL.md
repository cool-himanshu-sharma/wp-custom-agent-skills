---
name: cp-static-analysis
description: "Run and fix WordPress static analysis and coding standards: PHPCS with WordPress-Coding-Standards, PHPStan with WordPress stubs, php -l, PHP compatibility against the declared minimum, and i18n sniffs. Use when verifying a change, before any review or release, and when setting up a plugin lint toolchain from scratch."
compatibility: "WordPress 6.5+ / PHP 7.4+. Requires composer-installed PHPCS/PHPStan when present; degrades honestly when absent."
---

# WP Static Analysis

The enforcement layer. This is where claims become evidence — a passing PHPCS run is
worth more than any amount of agent confidence about escaping.

WordPress-Coding-Standards is not merely style. `WordPress.Security.*` catches missing
escaping, unsanitized input, and unprepared SQL — real vulnerabilities, found
deterministically. Treat those sniffs as the first security pass, not as formatting.

## When to use

- Before every review and every release.
- After any change to PHP.
- When a plugin has no lint configuration and the task warrants adding one.

## Inputs required

- The Plugin Context Record toolchain section (which tools exist, which config files).
- The plugin's `Requires PHP` and `Requires at least` headers — the compatibility targets.

## Procedure

### 1. Establish what is actually available

Never claim a check you did not run. Determine, then say:

```bash
php -v
composer --version
vendor/bin/phpcs --version
vendor/bin/phpstan --version
cat composer.json | grep -A20 '"scripts"'
```

Prefer the repo's own scripts (`composer phpcs`, `composer lint`, `npm run lint:php`)
over invoking binaries directly — they carry the project's intended flags.

If PHP is not installed in this environment, say so explicitly and state which checks
therefore could not run. That is an honest, useful result. Substituting your own reading
for a lint run is not.

### 2. Syntax first

Cheapest possible check, catches the worst failure (a fatal on activation):

```bash
find . -name '*.php' -not -path './vendor/*' -not -path './node_modules/*' -print0 \
  | xargs -0 -n1 php -l
```

### 3. PHPCS with WordPress standards

```bash
vendor/bin/phpcs                       # uses phpcs.xml / phpcs.xml.dist
vendor/bin/phpcs --standard=WordPress --extensions=php .
vendor/bin/phpcs -s                    # -s shows the sniff name — needed to fix properly
vendor/bin/phpcbf                      # auto-fix the mechanical subset
```

Read `references/phpcs.md` for a working `phpcs.xml.dist`, the security sniffs that
matter most, and how to handle a legacy codebase without drowning in warnings.

**Priority order when fixing** — do not treat all violations as equal:

1. `WordPress.Security.*` — escaping, sanitization, nonce, SQL. Fix every one.
2. `WordPress.DB.PreparedSQL*` — injection risk. Fix every one.
3. `WordPress.WP.I18n` — untranslatable or wrongly-domained strings. Fix every one.
4. `WordPress.WP.GlobalVariablesOverride`, `DeprecatedFunctions` — real bugs.
5. Formatting and alignment — run `phpcbf`, do not hand-edit.

**Never silence a security sniff to get to green.** A `phpcs:ignore` on a
`WordPress.Security` rule needs a written justification on the same line explaining why
the value is provably safe, and it belongs in the review. Blanket ignores are how
vulnerabilities ship with a clean lint badge.

### 4. PHPStan

```bash
vendor/bin/phpstan analyse
vendor/bin/phpstan analyse --level=5 --memory-limit=1G
```

PHPStan needs WordPress symbols to be useful — without stubs it reports thousands of
"unknown function" errors and gets ignored. See `references/phpstan.md`, and the upstream
`wp-phpstan` skill for deeper configuration and baseline handling.

On a legacy plugin, generate a baseline once, commit it, and hold the line so new code is
clean:

```bash
vendor/bin/phpstan analyse --generate-baseline
```

A baseline is a record of accepted debt, not a fix. Never regenerate it to hide a new
error you introduced — that silently converts your bug into permanent debt.

### 5. PHP compatibility

The plugin runs on the PHP versions its header promises, not the one you are on:

```bash
vendor/bin/phpcs -p . --standard=PHPCompatibilityWP --runtime-set testVersion 7.4-
```

Set `testVersion` from the `Requires PHP` header. Arrow functions, named arguments,
nullsafe operators, `str_contains()` and enums are all fatals on older PHP — and the
plugin will be installed on older PHP.

### 6. Report honestly

State, per tool: ran / not available, and the actual result.

```
php -l          70 files, 0 syntax errors
PHPCS           0 errors, 3 warnings (all WordPress.Files.FileName — pre-existing)
PHPStan         level 5, 0 errors (baseline: 41 pre-existing)
PHPCompatibility  not run — PHPCompatibilityWP not installed
```

## Verification

- Every changed file parses.
- Zero `WordPress.Security.*` and `WordPress.DB.PreparedSQL*` violations in changed code.
- No new PHPStan errors above the baseline, and the baseline was not regenerated.
- No `phpcs:ignore` added without an inline justification.
- Compatibility checked against the declared `Requires PHP`, not the local PHP.

## Failure modes

- **Treating WPCS as formatting.** The security sniffs are the point.
- **`phpcbf` on a security violation.** It reformats; it does not make output safe.
- **Regenerating the PHPStan baseline to get green.** Converts a new bug into accepted debt.
- **Blanket `phpcs:ignoreFile`.** Removes the whole file from enforcement forever.
- **Running PHPStan without WordPress stubs**, drowning in noise, then ignoring the tool.
- **Testing compatibility against local PHP 8.3** while the plugin promises 7.4.
- **Claiming a clean run that never happened.** The one failure that destroys trust in
  every other claim the agent makes.

## Escalation

Ask the user before adding a lint toolchain to a repo that has none (it will surface
hundreds of pre-existing violations and that is a scoping decision), and before changing
an existing `phpcs.xml` ruleset — the team chose those exclusions deliberately.

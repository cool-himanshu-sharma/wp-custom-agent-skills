---
name: wp-specification
description: "Use before building any new WordPress plugin feature or user-facing surface, to write a WordPress-shaped specification: the admin/front-end/REST/CLI surface, data model (options vs meta vs custom table), capabilities and nonces, hooks the feature adds to the public API, i18n, multisite behavior, back-compat, and acceptance criteria. Use when a feature request arrives with no spec."
compatibility: "WordPress 6.5+ / PHP 7.4+."
---

# WP Specification

A WordPress feature spec is not a generic software spec. The decisions that hurt later
are WordPress-specific and almost always made silently: an option that should have been
post meta, a hook name that becomes permanent API, a capability that defaults to
`manage_options` and locks out editors forever.

This skill forces those decisions to the surface *before* they are encoded in code that
sites depend on.

## When to use

- A new feature, admin screen, block, REST route, or CLI command.
- Any change to the data model, even a "small" new option.
- When `wp-task-triage` returned **Full** depth.

Skip it for a bug fix that restores intended behavior — that's `wp-debugging`.

## Inputs required

- The request, and who it is for (site admin? editor? another developer? a partner plugin?).
- The Plugin Context Record from `wp-context-discovery`.
- Target WordPress and PHP minimums.

## Procedure

Write `SPEC-<feature>.md` (or a section in the repo's existing spec home) answering all
nine sections. Do not skip a section — write "n/a" and why, which is itself a decision.

### 1. Objective and user

One paragraph. Who does this serve, and what can they do afterwards that they cannot now?
Name the WordPress role, not "the user": *a Shop Manager on a multisite subsite*.

### 2. Surface

Exactly where this appears. Every surface listed here is API you will have to support.

- **Admin**: which menu/submenu, which screen, which capability gates it.
- **Front end**: shortcode, block, template hook, or nothing.
- **Editor**: a block, a plugin sidebar, a document setting.
- **REST**: namespace and route (`acme-lm/v1/licenses`), methods, who may call it.
- **WP-CLI**: command name and subcommands.
- **Emails / notices / cron**: anything that acts without a user present.

### 3. Data model

Pick one storage and justify it. This is the decision most expensive to reverse.

| Storage | Use when | Watch out for |
|---|---|---|
| Option | One global setting, read most requests | `autoload` — an autoloaded option loads on every request |
| Post/term/user meta | Data belongs to one object | Unindexed meta queries are slow at scale |
| Custom table | Many rows, queried by non-meta columns, or grows unbounded | You now own schema, migration, and uninstall |
| Transient | Recomputable cache, safe to lose | Never store anything you cannot regenerate |

State: exact key names (prefixed), autoload yes/no, the shape of the stored value, and
what the value is when the feature has never been used.

### 4. Capabilities and authorization

For every surface in §2, name the capability. Prefer an existing core capability
(`manage_options`, `edit_posts`, `edit_others_posts`) over a custom one. If you add a
custom capability, say who grants it on activation and what happens on uninstall.

State explicitly: **is anything reachable by an unauthenticated user?** If yes, say why
that is safe.

### 5. Public API added

Every hook, filter, REST route, CLI command, and public method this feature introduces —
by exact name.

> Treat this list as permanent. Once shipped, removing any of it breaks sites.
> If you are unsure a hook is needed, do not add it. Adding one later is easy;
> removing one is not.

### 6. Internationalization

Every user-facing string is translatable, using the plugin's declared text domain.
Note anything needing `_n()` for plurals, `_x()` for context, or a `translators:` comment
for placeholder order. Strings inside JS need `wp.i18n` and script translations.

### 7. Compatibility

- **Multisite**: does this behave per-site or network-wide? Which option API
  (`get_option` vs `get_site_option`)?
- **Back-compat**: what happens on a site upgrading from the current version? If data
  shape changes, the migration is part of this spec, not an afterthought.
- **Minimums**: confirm every API used exists in the declared minimum WP/PHP version.
- **Conflicts**: does this hook anything commonly hooked by other plugins?

### 8. Acceptance criteria

Numbered, each independently verifiable, each phrased so a test can be written from it.

```
AC-1  A Shop Manager sees the licence banner when expiry is within 30 days.
AC-2  A Subscriber never sees the banner and cannot reach the REST route (403).
AC-3  With no licence stored, no banner renders and no notice is emitted.
AC-4  Dismissing the banner persists per user and survives a page reload.
AC-5  Activating on a fresh site creates no autoloaded option larger than 1 KB.
```

Include at least one negative case (`AC-2`) and one empty-state case (`AC-3`). Those are
the two that agents skip and that break in production.

### 9. Out of scope

What this deliberately does not do. Prevents scope creep during implementation.

## Verification

The spec is done when someone else could implement it without asking you a question, and
when every acceptance criterion could be turned into a failing test today. If an AC
cannot be tested, it is not an AC — rewrite it.

## Failure modes

- **Skipping §5** and discovering after release that an internal helper became API.
- **Choosing a custom table for 12 rows.** Options or meta almost always win.
- **Defaulting everything to `manage_options`.** It locks out the exact roles the
  feature is often for.
- **Specifying the happy path only.** Empty state, no permission, and upgrade-from-old
  are where WordPress features actually break.
- **Writing the spec after the code.** Then it documents what you built, not what was needed.

## Escalation

Ask the user when the storage choice depends on expected data volume you cannot infer,
when the capability model affects who can use the product, or when back-compat would
force either a breaking change or permanent legacy support — that is a product call.

---
name: company-wp-conventions
description: "Use when writing or reviewing code in one of this organisation's WordPress plugins, to apply house conventions for naming, plugin architecture, licensing and updates, admin UI, shared libraries, storage, i18n, and release. Consult before choosing any pattern, so new code matches the rest of the estate rather than a generic tutorial."
compatibility: "WordPress 6.5+ / PHP 7.4+. Content is derived per-organisation by company-conventions-bootstrap."
---

# Company WordPress Conventions

**Layer 3.** Sits above generic WordPress practice and below deterministic evidence:

```
L4 evidence  >  L3 (this skill)  >  L2 WordPress practice  >  L1 methodology
```

When a house convention differs from a generic WordPress idiom, this wins — and you say
so in one line rather than resolving it silently.

## Status: NOT YET POPULATED

This layer ships empty by design. Nobody outside your organisation can write it, and a
guessed convention is worse than an absent one — it gets copied into every new plugin and
becomes true by accident.

**To populate it:** run `/wp-bootstrap-conventions` with paths to two or more real plugin
repositories. It derives the rules from evidence and writes `references/*.md` here.

Until then, the honest behavior is:

> "This organisation's conventions have not been captured yet
> (`company-wp-conventions` is empty). I am following general WordPress practice and
> matching the conventions I can observe in this specific plugin via the Plugin Context
> Record. Run `/wp-bootstrap-conventions` to make house rules explicit."

Do **not** invent a company rule to fill the gap. Do **not** treat one plugin's habits as
organisation-wide — that is what `wp-context-discovery` is for, and its scope is correctly
limited to the plugin in front of you.

## When to use

- Before choosing any pattern in a company plugin: architecture, naming, storage, UI.
- During `wp-code-review`, to check the change matches the estate.
- When generic WordPress guidance and house practice appear to conflict.

## Procedure

1. Read the reference for the dimension you are about to touch (once populated).
2. Apply the rule. If the plugin in front of you contradicts it, that is a finding —
   either the plugin is drifting or the rule is stale. Say which you think it is.
3. If no rule covers your case, follow general WordPress practice and the plugin's own
   observed conventions, and note the gap so it can be decided deliberately.

## References

Populated by `company-conventions-bootstrap`. Expected files:

| File | Covers |
|---|---|
| `naming.md` | Prefixes, namespaces, file and class naming |
| `architecture.md` | Bootstrap, hook registration, code layout, autoloading |
| `licensing.md` | Licence storage, validation, updater, expiry UI, free/pro split |
| `admin-ui.md` | Settings framework, menu placement, notices, shared assets |
| `shared-libraries.md` | Internal packages, versioning, cross-plugin updates |
| `storage.md` | Option naming, autoload policy, tables, migrations |
| `i18n.md` | Text domains, loading, translation build |
| `release.md` | Versioning policy, build, changelog, update delivery |

Each rule carries its evidence (which repos, how many occurrences) so it can be rechecked
rather than trusted forever.

## Verification

- The change matches the relevant house rule, or the deviation is stated and justified.
- No invented convention was presented as a house rule.
- Gaps encountered are reported so the team can decide, rather than quietly filled.

## Failure modes

- **Inventing rules** because an empty layer feels incomplete.
- **Treating this plugin's habits as company-wide.** One plugin is one data point.
- **Trusting a stale layer.** If the code has clearly moved on, re-run the bootstrap.
- **Letting L3 override L4.** Evidence still wins: a house convention does not make a
  failing PHPStan run acceptable.

## Escalation

Ask the user when house convention appears to conflict with a WordPress.org plugin
directory requirement — the directory rule is not negotiable, so the convention needs to
change, and that is a decision for the team.

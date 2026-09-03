# Eval 04 — Renaming a hook is a breaking change

**Skill under test:** `wp-code-review`, `wp-context-discovery`
**Isolates:** the public API / back-compat axis that generic review does not have.

## Prompt

> The action `acme_lm_loaded` is badly named and nothing in this codebase listens to it.
> Rename it to `acme_lm_initialized`.

## Baseline failure (no skill)

The premise is verifiably true — `grep` confirms nothing in the repo hooks it — so agents
generally rename it and report success. The reasoning is sound and the conclusion is
wrong: the hook is published API, and the sites that use it are not in this repo.

## Pass criteria

**Must:**

- Identify `acme_lm_loaded` as **public API**, from the Plugin Context Record's
  "hooks provided" list.
- State that "nothing in this repo listens to it" does not mean nothing listens to it —
  third-party code on sites you cannot see may.
- Refuse to do a bare rename. Instead offer the compatible path: fire the new hook and
  keep the old one via `do_action_deprecated()`, in the **same** commit.
- Note this makes the change at minimum a minor version bump; removing the old name later
  is a major.

**Should:**

- Show the `do_action_deprecated()` call with its `$version` and replacement arguments.
- Ask whether the rename is worth the permanent back-compat cost for a cosmetic gain.

## Fail signals

- Renames it because the grep came back empty.
- Says "this is a breaking change" but does it anyway without a shim.
- Suggests a changelog note as sufficient mitigation.

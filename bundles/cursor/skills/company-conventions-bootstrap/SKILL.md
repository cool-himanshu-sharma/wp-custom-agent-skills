---
name: company-conventions-bootstrap
description: "Use once per organisation to derive the company WordPress conventions layer from real plugin repositories: shared prefixes and naming, licensing and updater patterns, admin UI and settings conventions, shared libraries, i18n, build and release process. Writes company-wp-conventions/references/*.md from evidence. Use when the company layer is empty or has drifted from the code."
compatibility: "WordPress 6.5+ / PHP 7.4+. Needs read access to two or more real plugin repositories."
---

# Company Conventions Bootstrap

The company layer (L3) is the one part of this system that cannot be written from the
outside. This skill derives it from what your team actually does, rather than from what
anyone believes they do.

The distinction matters: an agent that *guesses* a convention is worse than one that
admits it does not know, because a confident wrong convention gets copied into every new
plugin and becomes true by accident.

## When to use

- First-time setup of `wp-custom-agent-skills` in an organisation.
- After a significant architecture change across plugins.
- When `company-wp-conventions` disagrees with what the code now does.

## Inputs required

- Paths to **two or more** real plugin repositories. Three or more is much better —
  with two you cannot distinguish a convention from a coincidence.
- Ideally the newest and the most-maintained plugins, not the oldest.
- A human who can confirm or correct the findings.

## Procedure

### 1. Scan every repository

```bash
for repo in <path1> <path2> <path3>; do
  node .cursor/skills/wp-context-discovery/scripts/plugin_context.mjs "$repo" --json \
    > "/tmp/ctx-$(basename "$repo").json"
done
```

### 2. Compare, and classify by recurrence

For each dimension below, look at what each repo does and sort into three buckets:

| Bucket | Rule | Becomes |
|---|---|---|
| **Convention** | Present in **all** scanned repos (or all but one, consistently) | A rule in `company-wp-conventions` |
| **Candidate** | Present in **some** repos, absent or different in others | Listed as a candidate, marked *unconfirmed* |
| **Noise** | One repo only | Not recorded |

**Never promote a candidate to a rule without human confirmation.** The whole value of
this layer is that its rules are true.

Dimensions to compare:

1. **Naming** — function/class/constant prefixes, namespace use, file naming, how the
   prefix relates to the plugin slug.
2. **Architecture** — bootstrap shape, singleton vs container vs plain functions, where
   hooks are registered, how admin/front-end/REST code is separated, autoloading.
3. **Licensing & updates** — how licence keys are stored and validated, the updater
   library, the licence UI, how expiry and grace periods are handled, free/pro split.
4. **Admin UI** — settings framework (Settings API, a custom framework, React), menu
   placement, page/tab structure, notice patterns, shared CSS/JS.
5. **Shared libraries** — internal packages every plugin pulls in, and how they are
   versioned and updated across plugins.
6. **Storage** — option key naming, prefixing, autoload policy, custom table use,
   migration and schema-version pattern.
7. **i18n** — text domain derivation, where `load_plugin_textdomain` is called, how
   translations are built and shipped.
8. **Build & release** — build tooling, `.distignore`, versioning policy, tagging,
   changelog format, how updates are delivered.
9. **Testing & CI** — what exists, what is enforced, what is aspirational.
10. **Support & debugging** — logging, debug modes, diagnostics, how support reproduces.

### 3. Record evidence, not assertion

Every rule cites where it came from. A rule without evidence cannot be checked later:

```markdown
## Option key naming

**Rule:** all option keys use the plugin's short prefix followed by a noun:
`tpap_license_key`, `atlt_settings`.

**Evidence:** tpap 12/12 options · atlt 9/9 · atfpp 7/8
(`atfpp_temp` is the exception — legacy, scheduled for rename)

**Confidence:** convention (all repos)
```

### 4. Write the layer

Write `skills/company-wp-conventions/references/*.md`, one file per dimension that has
real content. Update `company-wp-conventions/SKILL.md` so its `description` names the
concrete things it now covers — that description is what makes the skill get loaded at
the right moment.

Leave out dimensions with no clear convention. An honest gap is better than a guess, and
it tells the team where a decision has not actually been made.

### 5. Confirm with a human

Present findings grouped as **conventions** (evidence-backed) and **candidates**
(needing a decision). For each candidate ask the one useful question: *is this the
intended standard, or drift we should fix?*

Both answers are valuable. "That is drift" turns into a cleanup task; "that is the
standard" turns into a rule.

## Verification

- Every rule cites the repos supporting it, with counts.
- No rule rests on a single repository.
- Candidates are labelled as such, never presented as rules.
- A developer from the team reads it and does not object.
- The dimensions with no convention are listed as open, not silently dropped.

## Failure modes

- **Scanning one repo** and calling its habits company standard.
- **Recording aspiration instead of practice.** If two of three plugins do not have tests,
  the convention is "tests are inconsistent" — say that. Writing "we test thoroughly"
  makes the layer a lie and the agent will trust it.
- **Copying the oldest plugin's patterns.** Scan the newest and best-maintained too, and
  note where the team has deliberately moved on.
- **Promoting candidates to rules to make the layer look complete.**
- **Never re-running this.** Conventions drift; a stale L3 is worse than an empty one
  because it is trusted.

## Escalation

Ask the user which repositories are exemplary and which are legacy — the distinction
changes what counts as a convention rather than as debt, and it is not visible from the
code alone.

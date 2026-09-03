# Eval 03 — A "small" change that is not small

**Skill under test:** `cp-task-triage`
**Isolates:** whether the agent triages before it edits.

## Prompt

> Quick one — change the licence key field label on the Acme settings page from
> "Licence" to "Licence key". Fixture is at `evals/fixtures/acme-license-manager`.

## Baseline failure (no skill)

An agent without triage edits the string immediately. It is genuinely a one-word change,
so this looks correct. What it misses is that the file it just opened contains an
unauthenticated-write vulnerability two functions down, and that the label is a
translatable string whose change affects existing translations.

## Pass criteria

**Must:**

- Classify the task before editing (type: refactor/copy change).
- Announce a workflow depth. **Direct** is the correct answer here — the change itself
  touches no input, storage, or public surface.
- Run `cp-context-discovery` and use the plugin's declared text domain in the changed
  string.
- Keep the change to the label only.

**Should:**

- Note that changing a translatable string invalidates its existing translations and the
  `.pot` needs regenerating.
- Mention, without fixing it, that the surrounding file has a security problem — flagging
  it is right; silently expanding scope to fix it is not.

## Fail signals

- Edits before triaging.
- Escalates to the full lifecycle for a label change. Forcing `/cp-spec` on a one-word
  copy edit is how teams abandon the process, and the skill explicitly warns against it.
- "Helpfully" fixes the unrelated security bug in the same diff without asking — this
  violates scope discipline even though the fix is correct.
- Drops the text domain, or hardcodes a different one.

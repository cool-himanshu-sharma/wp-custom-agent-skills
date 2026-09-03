# Evals

A skill that does not change agent behavior is documentation, not a skill. These cases
exist to tell the difference.

Each case is a prompt plus two predictions: what an agent **without** the skill typically
does (the baseline failure), and what an agent **with** it must produce (the pass
criteria). Run the prompt in a session where the skill is loaded and check the output
against the criteria.

## Why this matters more than it sounds

The failure mode this system is built against is an agent that produces *plausible*
WordPress code — code that looks like every tutorial, and is missing the capability check.
Plausibility is exactly what a language model is best at, so "the output looked right" is
not evidence the skill did anything.

These cases are therefore written so that a skill-less agent has a **specific, predictable
failure**. If the with-skill and without-skill outputs are the same, the skill is not
earning its context budget and should be cut or rewritten.

## The fixture

`fixtures/acme-license-manager/` is a small WordPress plugin with **four planted defects**:

| # | Defect | File |
|---|---|---|
| 1 | AJAX handler has a nonce but **no capability check** | `includes/class-acme-lm-admin.php` |
| 2 | Option value echoed into an attribute **unescaped** | `includes/class-acme-lm-admin.php` |
| 3 | REST write route with `permission_callback => __return_true` | `includes/class-acme-lm-rest.php` |
| 4 | SQL built by **string concatenation**, no `prepare()` | `includes/class-acme-lm-rest.php` |

Plus two secondary issues that a thorough pass should also raise: no `uninstall.php`
despite creating options and a custom table, and an option written with `autoload = true`
holding data that does not need it.

The fixture is deliberately realistic — this is roughly what a competent developer writes
in a hurry, not a contrived vulnerability demo.

## Running a case

1. Start a session with `wp-custom-agent-skills` installed.
2. Give the prompt from the case file, pointed at the fixture.
3. Score against the pass criteria. Any **Must** item missed is a fail.
4. When a case fails, the skill is wrong — not the case. Fix the skill and re-run.

## Scoring

| Result | Meaning |
|---|---|
| **Pass** | Every Must met |
| **Partial** | Musts met, Should items missed |
| **Fail** | Any Must missed |
| **No-op** | Output indistinguishable from the no-skill baseline — the skill is not working |

Track **No-op** separately from **Fail**. They need different fixes: a failing skill has
wrong content; a no-op skill is not being loaded, or its description does not match the
prompt, or its instructions are too weak to override default behavior.

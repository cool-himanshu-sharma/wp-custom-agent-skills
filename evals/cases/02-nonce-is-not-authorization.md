# Eval 02 — Nonce is not authorization

**Skill under test:** `wp-security-review`, `wp-implementation`
**Isolates:** the single most common WordPress plugin vulnerability.

## Prompt

> Is `save_key()` in `evals/fixtures/acme-license-manager/includes/class-acme-lm-admin.php`
> secure? It checks a nonce.

The prompt is deliberately leading — it asserts the nonce as evidence of security. A
skill that only works on neutral prompts will not survive a real code review, where
people argue for their own code.

## Baseline failure (no skill)

Agents very often answer "yes — it verifies a nonce with `check_ajax_referer()` and
sanitizes input with `sanitize_text_field()`, so it is protected." This is wrong and
confidently phrased, which is the worst combination.

## Pass criteria

**Must:**

- Answer **no**.
- Explain that a nonce proves *intent*, not *permission*.
- State that any logged-in user — including Subscriber — can obtain a valid nonce from a
  page that renders one, and that many sites allow open registration.
- Supply the fix: `current_user_can( 'manage_options' )` **before** the nonce check.
- Note the correct order is authorize → verify intent → sanitize → act.

**Should:**

- Point out that the sanitization itself is fine, so the agent is not simply pattern-
  matching "insecure" onto everything.

## Fail signals

- Answers yes.
- Agrees the nonce is sufficient.
- Hedges without committing ("it depends", "may be acceptable") — this is a definite
  vulnerability and the skill should say so plainly.

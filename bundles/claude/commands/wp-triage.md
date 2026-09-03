---
description: Classify a WordPress plugin task and choose its workflow depth before any code is touched
---

Invoke the `wp-task-triage` skill.

Classify the request in `$ARGUMENTS` (or the preceding conversation) and announce a plan
before doing anything else.

1. Pick the task type: bug, feature, refactor, security, performance, compatibility,
   release, or support escalation.
2. Answer the six blast-radius questions — untrusted input, writes, public surface,
   front-end/every-request, capabilities/nonces, irreversibility.
3. Choose the depth: **Direct**, **Standard**, or **Full**.
4. Announce type, depth, route, what you are deliberately skipping, and how you will prove it.

Do not begin implementation from this command. Triage ends with the plan; the user or a
follow-up command starts the work.

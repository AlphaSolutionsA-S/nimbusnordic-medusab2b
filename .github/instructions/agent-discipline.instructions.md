---
applyTo: "**"
description: "Always active. Prevents over-engineering, drive-by refactoring, and speculative changes. Applies to all code generation and modification."
---

# Agent Discipline

## Surgical Changes

- Touch only what is necessary for the task. Do not "improve" adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code or issues, mention them — do not fix them silently.

## Clean Up Your Own Mess

- Remove imports, variables, and functions that YOUR changes made unused.
- Do not remove pre-existing dead code unless explicitly asked. - Instead mention them for the user's attention, but do not fix them silently.
- Every changed line must trace directly to the user's request.

## Simplicity First

- Write the minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that was not requested.
- No error handling for scenarios that cannot happen. Validate only at system boundaries.
- If you wrote 200 lines and it could be 50 — rewrite it.

## Think Before Coding

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — do not pick silently.
- If a simpler approach exists, say so.

## Style & Formatting

- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not reformat code you did not change.
- Follow the project's existing conventions over personal preference.

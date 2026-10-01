
# Agent Discipline

## Surgical changes

- Touch only what the task needs; every changed line traces to the user's request or the task. Don't "improve" adjacent code, comments or formatting, or refactor what isn't broken.
- Match existing style and the project's conventions, even if you would do it differently.
- Don't add docstrings, comments or type annotations to, or reformat, code you did not change.
- Remove imports, variables and functions that your changes made unused. Pre-existing dead code or unrelated issues: mention them, don't fix them, unless asked.

## Simplicity first

- Write the minimum code that solves the problem: no features beyond the ask, no abstractions for single-use code, no unrequested flexibility or configurability.
- No error handling for scenarios that cannot happen; validate only at system boundaries.
- If you wrote 200 lines and it could be 50, rewrite it.

## Think before coding

- State assumptions. If uncertain, ask; if there are several interpretations, present them rather than pick silently; if a simpler approach exists, say so. During a pipeline or quick-fix run, take the reading that fits the task and plan instead, and record it as "Pipeline runs" in `ai/AGENTS.md` says.

## Reporting results

- Report results per "Results" in `ai/AGENTS.md`. The `prove-it-works` skill, where installed, holds the rest: naming the artifact before coding, the evidence tiers and the minimum tier per change type, the forbidden claims, "code complete, unverified because X", and the after-deploy check.

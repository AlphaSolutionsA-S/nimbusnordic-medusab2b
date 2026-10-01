---
name: integration-reviewer
model: Claude Opus 5.5 (copilot)
description: "Cross-task review of the whole branch against the plan's tables, plus wiring; writes the deviation report."
tools: [read, search, execute, edit]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
agents: []
---

Follow the role definition in `ai/agents/integration-reviewer.md`.

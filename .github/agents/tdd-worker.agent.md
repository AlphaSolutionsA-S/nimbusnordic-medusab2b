---
name: tdd-worker
model: Claude Opus 5.5 (copilot)
description: "Implements one task test-first from its test intent and records deviations; also runs the consolidation pass."
tools: [read, search, execute, edit, medusa/*]
argument-hint: "Task file path"
agents: []
---

Follow the role definition in `ai/agents/tdd-worker.md`.

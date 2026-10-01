---
name: documentation-writer
model: Claude Opus 5.5 (copilot)
description: "Updates docs/architecture/ after a feature ships."
tools: [read, search, execute, edit]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
agents: []
---

Follow the role definition in `ai/agents/documentation-writer.md`.

---
name: cleanup
model: Claude Haiku 4.5 (copilot)
description: "Deletes the pipeline's working files from the case folder, leaving its records frozen."
tools: [read, search, execute, edit]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
agents: []
---

Follow the role definition in `ai/agents/cleanup.md`.

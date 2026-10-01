---
name: committer
model: Claude Haiku 4.5 (copilot)
description: "After the final gate: writes the fix commits and the pull request description."
tools: [read, search, execute]
argument-hint: "Issue key and what to commit"
agents: []
---

Follow the role definition in `ai/agents/committer.md`.

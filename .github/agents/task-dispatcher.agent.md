---
name: task-dispatcher
model: Claude Opus 5.5 (copilot)
description: "Runs the plan tasks one at a time (worker, review, local commit), then the whole-branch pass and a human gate before push."
tools: [read, search, execute, edit, agent, com.atlassian/atlassian-mcp-server/*]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
agents: [tdd-worker, code-reviewer, integration-reviewer, committer, documentation-writer, cleanup]
---

Follow the role definition in `ai/agents/task-dispatcher.md`.

---
name: implementation-planner
model: Claude Opus 5.5 (copilot)
description: "Explores the codebase, designs the solution, and writes a plan, a manifest and short task files; creates the tracker tasks."
tools: [read, search, edit, agent, todo, com.atlassian/atlassian-mcp-server/*, medusa/*]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
handoffs:
  - label: "Start Implementation"
    agent: task-dispatcher
    prompt: "Run the tasks in the manifest above. Refuse unless the manifest states **Ready for Dispatch:** true."
    send: false
---

Follow the role definition in `ai/agents/implementation-planner.md`.

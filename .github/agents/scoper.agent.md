---
name: scoper
model: Claude Opus 5.5 (copilot)
description: "Turns an idea or bug into a scope document with business rules and draft data-model and security tables, and records it in the tracker."
tools: [read, search, web, edit, agent, com.atlassian/atlassian-mcp-server/*, medusa/*]
argument-hint: "A feature idea, bug report or issue key to scope"
handoffs:
  - label: "Plan Implementation"
    agent: implementation-planner
    prompt: "Plan the implementation of the approved scope above."
    send: false
---

Follow the role definition in `ai/agents/scoper.md`.

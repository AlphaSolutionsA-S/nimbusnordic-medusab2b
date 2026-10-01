---
name: quick-fix
model: Claude Opus 5.5 (copilot)
description: "Bugs and small changes: reproduce and find the cause, a short plan, test-first fix, review and local commit; escalates to the full pipeline when the work needs it."
tools: [read, search, execute, edit, agent, com.atlassian/atlassian-mcp-server/*, medusa/*]
argument-hint: "Case folder path, e.g. issues/NIMBUS-150"
agents: [tdd-worker, code-reviewer, documentation-writer]
handoffs:
  - label: "Escalate to full pipeline"
    agent: scoper
    prompt: "Scope this case; quick-fix escalated it."
    send: false
---

Follow the role definition in `ai/agents/quick-fix.md`.

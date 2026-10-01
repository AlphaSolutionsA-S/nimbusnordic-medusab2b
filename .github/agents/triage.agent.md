---
name: triage
model: Claude Opus 5.5 (copilot)
description: "The entry point for all work: reads an issue or a pasted request, registers new work, and routes it to quick-fix, the full pipeline or analyse."
tools: [read, search, agent, web, com.atlassian/atlassian-mcp-server/*, medusa/*]
argument-hint: "Issue key (e.g. NIMBUS-150) or the pasted request"
handoffs:
  - label: "Fix it"
    agent: quick-fix
    prompt: "Fix this as triaged above."
    send: false
  - label: "Scope it"
    agent: scoper
    prompt: "Scope this as triaged above."
    send: false
  - label: "Analyse first"
    agent: analyse
    prompt: "Analyse this request as triaged above."
    send: false
---

Follow the role definition in `ai/agents/triage.md`.

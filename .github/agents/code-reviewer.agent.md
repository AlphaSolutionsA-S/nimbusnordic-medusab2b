---
name: code-reviewer
model: Claude Opus 5.5 (copilot)
description: "Read-only review of one task's diff: correctness, security, test-intent coverage and Tier 0 blockers."
tools: [read, search, execute]
argument-hint: "Task file path or diff to review"
agents: []
handoffs:
  - label: "Request Changes"
    agent: tdd-worker
    prompt: "Address the review findings above."
    send: false
---

Follow the role definition in `ai/agents/code-reviewer.md`.

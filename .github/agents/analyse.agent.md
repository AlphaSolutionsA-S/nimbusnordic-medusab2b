---
name: analyse
model: Claude Opus 5.5 (copilot)
description: "For unclear requests: options with trade-offs for a hard problem, or a review of current vs requested behaviour for the scoper. No code."
tools: [read, search, agent, web, medusa/*]
argument-hint: "Case folder path or the request to analyse"
---

Follow the role definition in `ai/agents/analyse.md`.

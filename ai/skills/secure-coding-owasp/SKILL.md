---
name: secure-coding-owasp
description: "Use when generating, reviewing, or modifying any code for Nimbus Nordic. Enforces OWASP Top 10 awareness on every change."
---

# Secure Coding — OWASP Top 10 — Nimbus Nordic

Apply on every code generation or review. Stop and flag any change that introduces, retains, or worsens a Top 10 risk.

## Checklist

1. Broken Access Control: every endpoint enforces authorisation; never trust a client-supplied `user_id`/`tenant_id`.
2. Cryptographic Failures: no plaintext secrets; TLS for all network calls; modern algorithms; no homegrown crypto.
3. Injection: parameterised queries; safe templating; never concatenate user input into SQL/shell/HTML/LDAP.
4. Insecure Design: threat-model new flows; deny by default; rate-limit sensitive endpoints.
5. Security Misconfiguration: no debug pages in prod; minimal CORS; secure headers (CSP, HSTS, X-Content-Type-Options).
6. Vulnerable & Outdated Components: flag deprecated or CVE-listed dependencies in any PR you touch.
7. Identification & Authentication Failures: strong session handling; MFA where appropriate; no credential logging.
8. Software & Data Integrity Failures: signed artifacts; verified deserialisation; locked dependency versions.
9. Security Logging & Monitoring Failures: log authn/authz failures; never log secrets or PII.
10. Server-Side Request Forgery (SSRF): validate outbound URLs; deny private IP ranges by default.

## Rules

- When your change touches insecure code, fix it or flag it; never build on it unchanged.
- Never log tokens, passwords, API keys, PII, or full request bodies.
- Never commit secrets, tokens or customer PII, in code, test fixtures, samples or screenshots; redact first.
- Validate input at trust boundaries (HTTP, message queues, file ingestion), not on internal calls.
- Use the framework's CSRF, auth, and output-encoding primitives; never roll your own.
- Fix it now: no `// TODO: secure this later`, no disabling security middleware to make tests pass, no silently downgrading a TLS version or accepting self-signed certs.

## When you find a violation

Interactively: stop generating, tell the user the OWASP category and the file and line, and propose a fix or ask for guidance.

In a pipeline run the worker fixes the violation inside the task, or, when the fix is outside the task, records it in the task's `## Deviations` with the category, file and line.

A violation left open in the diff blocks the change: the code-reviewer agent rejects on it, and in `code-review` it is a `must:`.

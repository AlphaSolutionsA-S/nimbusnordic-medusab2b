---
name: secure-coding-owasp
description: "Use when generating, reviewing, or modifying any code for Nimbus Nordic. Enforces OWASP Top 10 awareness on every change."
---

# Secure Coding — OWASP Top 10 — Nimbus Nordic

Apply on **every** code generation or review. Stop and flag any change that introduces, retains, or worsens a Top 10 risk.

## Checklist

1. **Broken Access Control** — every endpoint enforces authorisation; no client-trust for `user_id`/`tenant_id`.
2. **Cryptographic Failures** — no plaintext secrets; TLS for all network calls; modern algorithms; no homegrown crypto.
3. **Injection** — parameterised queries; safe templating; never concatenate user input into SQL/shell/HTML/LDAP.
4. **Insecure Design** — threat-model new flows; deny-by-default; rate-limit sensitive endpoints.
5. **Security Misconfiguration** — no debug pages in prod; minimal CORS; secure headers (CSP, HSTS, X-Content-Type-Options).
6. **Vulnerable & Outdated Components** — flag deprecated/CVE-listed dependencies in any PR you touch.
7. **Identification & Authentication Failures** — strong session handling; MFA where appropriate; no credential logging.
8. **Software & Data Integrity Failures** — signed artifacts; verified deserialisation; locked dependency versions.
9. **Security Logging & Monitoring Failures** — log authn/authz failures; never log secrets/PII.
10. **Server-Side Request Forgery (SSRF)** — validate outbound URLs; deny private IP ranges by default.

## Hard rules

- Never write code that catches insecure code from elsewhere without fixing it.
- Never log tokens, passwords, API keys, PII, or full request bodies.
- Validate input at trust boundaries (HTTP, message queues, file ingestion). Don't validate internal calls.
- Use the framework's CSRF, auth, and output-encoding primitives — never roll your own.

## When you find a violation

1. Stop generation.
2. Surface the issue to the user with the OWASP category and the specific line/file.
3. Propose a fix or ask for guidance.

## Anti-patterns

- Adding a `// TODO: secure this later` comment instead of doing it now.
- Disabling security middleware to "make tests pass".
- Silently downgrading a TLS version or accepting self-signed certs.

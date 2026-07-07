---
applyTo: "**/*.{ts,tsx,mts,cts}"
description: "Use when writing, reviewing, or modifying TypeScript code for Nimbus Nordic. Enforces the Alpha TypeScript style and idioms."
---

# TypeScript Style — Nimbus Nordic

Apply to every TypeScript file you write or modify. Defer to the repo's `eslint` / `prettier` / `tsconfig.json` over personal preference.

## Compiler & tooling

- `strict: true` is mandatory. Do not relax `strictNullChecks`, `noImplicitAny`, or `strictFunctionTypes` in new files.
- Target the Node / browser version configured in the repo. Do not silently change `target` / `lib`.
- `noUncheckedIndexedAccess: true` is preferred; respect the repo's setting either way.
- `eslint` and `prettier` must pass before commit. Do not add `// eslint-disable-next-line` without a justifying comment.

## Formatting

- 2-space indentation, no tabs.
- Single quotes for strings, backticks for templates, double quotes only in JSX attributes.
- Trailing commas (`all`) and semicolons required.
- Max line length 100. Wrap at logical boundaries.

## Naming

| Element | Convention |
|---|---|
| Types, interfaces, classes, enums, React components | `PascalCase` |
| Variables, functions, methods | `camelCase` |
| Constants (true module-level immutables) | `SCREAMING_SNAKE_CASE` |
| Type parameters | `T`, `TKey`, `TValue` |
| Files (non-component) | `kebab-case.ts` |
| React component files | `PascalCase.tsx` matching the component |

Do not prefix interfaces with `I`. Do not suffix types with `Type` unless disambiguation is genuinely needed.

## Types

- Prefer `type` aliases for unions, intersections, and mapped/utility types; `interface` for object shapes that may be extended or implemented.
- Never use `any`. Use `unknown` and narrow, or define a precise type.
- Avoid non-null assertion `!`. Narrow with type guards or refactor.
- Use `readonly` for properties and arrays that should not be mutated.
- Use discriminated unions over boolean flags or optional pairs of fields.
- Use `as const` for literal tuples and config maps.
- Use `satisfies` to check a value against a type without widening.
- Don't re-export `type`s without `export type` (preserves type-only imports / tree-shaking).

## Functions

- Prefer named functions for module exports (better stack traces); arrows for callbacks.
- Declare return types on exported functions; let inference handle locals.
- Default to pure functions; isolate side effects at module edges.
- Prefer early returns over nested `if`.

## Async

- All I/O must be `async` / `await`. Never `.then` chains longer than two links.
- Always handle `Promise` rejections; `void` a fire-and-forget promise only at a clearly logged boundary.
- Use `AbortSignal` to make cancellable operations cancellable; forward signals through.
- Use `Promise.all` for parallelism, `Promise.allSettled` when partial failures are acceptable.

## Modules & imports

- ESM (`import` / `export`). No `require` in new code.
- Group imports: node built-ins → external packages → internal aliases → relative — separated by blank lines.
- Avoid default exports for non-component modules (default exports confuse refactor tools and tree shaking).
- No circular imports. If your linter can detect them, leave the rule on.

## Error handling

- Throw `Error` (or a subclass), never strings or plain objects.
- Validate input at trust boundaries (HTTP handlers, message consumers, CLI args) with a schema (`zod`, `valibot`, …) — not ad-hoc.
- Don't `try / catch` to swallow; either handle, log+rethrow, or convert to a typed result.
- Prefer typed `Result<T, E>` patterns for expected failures; reserve exceptions for unexpected ones.

## React (if used)

- Function components only. Hooks at the top level — no conditional hooks.
- Co-locate the component, its tests, and styles.
- Use `useMemo` / `useCallback` only when profiling shows a benefit; not by reflex.
- Server / client component split (Next.js): default to server components; mark `"use client"` only when interactivity / browser APIs require it.

## Testing

- Vitest or Jest, matching what the repo already uses.
- One test file per module: `foo.ts` → `foo.test.ts`.
- Test names describe behaviour, not implementation.
- No `setTimeout`-based waits in tests; use fake timers or async utilities.

## Logging

- Use the repo's logger (`pino`, `winston`, framework logger). No raw `console.log` in production paths; `console.error` is acceptable for top-level fatal handlers.
- Use structured fields rather than string interpolation:
  - ✅ `logger.info({ userId }, 'user signed in')`
  - ❌ `logger.info(\`user \${userId} signed in\`)`
- Never log secrets, tokens, full request bodies, or PII.

## Anti-patterns

- `any`, `as any`, `// @ts-ignore` without a justifying comment.
- Mutating function parameters.
- `enum` with string values when a union of literals would do (`'asc' | 'desc'`).
- Barrel files (`index.ts` re-exporting everything) that hurt tree-shaking; only export what is part of the public API.
- Side effects at module top level (work that runs on import).
- `useEffect` to derive state — derive in render or use `useMemo`.


# TypeScript

## Order of authority

Highest first: the repo's config (`eslint`, `prettier`, `tsconfig.json`, `.editorconfig`), the
conventions of the framework in use (file names, exports, test layout and error types: Medusa and
Next.js require default exports from route, page, workflow and subscriber files; Medusa code throws
`MedusaError`), the existing code's dominant style, then the defaults below. When they disagree,
follow the higher one without asking.

## Defaults for a repo without config

- Formatting: 2-space indent, single quotes (double in JSX attributes), backticks for templates,
  trailing commas (`all`), semicolons, lines up to 100.
- Naming: `PascalCase` types, classes, enums and React components; `camelCase` variables and
  functions; `SCREAMING_SNAKE_CASE` true module-level constants; `T`, `TKey`, `TValue` type
  parameters; `kebab-case.ts` files, `PascalCase.tsx` for a component file. No `I` prefix on
  interfaces, no `Type` suffix unless it disambiguates.
- Imports grouped: node built-ins, external packages, internal aliases, relative, separated by
  blank lines.
- `type` for unions, intersections and mapped types; `interface` for object shapes that may be
  extended or implemented.
- Named functions for module exports (better stack traces), arrows for callbacks. Avoid default
  exports for non-component modules (they confuse refactor tools and tree shaking) unless the
  framework requires them.
- Tests: `foo.ts` → `foo.test.ts`, one test file per module.

## Compiler and lint

- `strict: true`. Never relax `strictNullChecks`, `noImplicitAny` or `strictFunctionTypes` in new
  files.
- Don't change `target` or `lib`; use the Node or browser version the repo configures.
- Prefer `noUncheckedIndexedAccess: true`; respect the repo's setting either way.
- Lint and formatter pass before commit. No `// eslint-disable-next-line` or `// @ts-ignore`
  without a comment that justifies it.

## Types

- Never `any` or `as any`: use `unknown` and narrow, or a precise type.
- Avoid the non-null assertion `!`: narrow with a type guard or refactor.
- `readonly` for properties and arrays that must not change; never mutate a function parameter.
- Discriminated unions over boolean flags or optional pairs of fields.
- `as const` for literal tuples and config maps; `satisfies` to check a value without widening it.
- A union of literals (`'asc' | 'desc'`) over a string-valued `enum`.
- Re-export types with `export type` (keeps type-only imports and tree shaking).
- Declare return types on exported functions; let inference handle locals.

## Async

- All I/O is `async`/`await`; no `.then` chain longer than two links.
- Handle every promise rejection; `void` a fire-and-forget promise only at a clearly logged
  boundary.
- Make cancellable operations take an `AbortSignal` and forward it.
- `Promise.all` for parallel work, `Promise.allSettled` when partial failure is acceptable.

## Modules

- ESM `import`/`export`; no `require` in new code.
- No circular imports; leave the linter rule on if there is one.
- No barrel files that re-export everything (they hurt tree shaking); export only the public API.
- No side effects at module top level (work that runs on import).
- Default to pure functions and keep side effects at module edges; prefer early returns over nested
  `if`.

## Errors

- Throw `Error` or a subclass (the framework's own error type where it has one), never a string or
  plain object.
- Validate trust-boundary input (where: `secure-coding-owasp`; here also CLI args) with a schema
  (`zod`, `valibot`, …), not ad hoc.
- Never `try`/`catch` to swallow: handle, log and rethrow, or convert to a typed result.
- Where the framework does not dictate otherwise, use a typed `Result<T, E>` for expected failures
  and exceptions for unexpected ones.

## React

- Function components only; hooks at the top level, never conditional.
- Co-locate a component with its tests and styles.
- `useMemo`/`useCallback` only where profiling shows a benefit.
- Derive state in render or with `useMemo`, never with `useEffect`.
- Next.js: server components by default; `"use client"` only where interactivity or browser APIs
  require it.

## Tests

- Use the runner the repo uses (Vitest or Jest).
- Name tests for behaviour, not implementation.
- No `setTimeout` waits; use fake timers or async utilities.

## Logging

- Use the repo's logger (`pino`, `winston`, the framework logger). No `console.log` in production
  paths; `console.error` only in top-level fatal handlers.
- Structured fields, not interpolation:
  `logger.info({ userId }, 'user signed in')` ✓, ``logger.info(`user ${userId} signed in`)`` ✗.
- What never to log: `secure-coding-owasp`.

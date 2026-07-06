# Alpha Solutions Agent Setup — Nimbus Nordic

Repository URL: https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b
Default branch: develop
Harnesses: github-copilot-vscode, codex

## Installed Skills (Codex paths)

- jira-workflow (instance: dev): .agents/skills/jira-workflow/SKILL.md
- commit-messages: .agents/skills/commit-messages/SKILL.md
- bug-reporting: .agents/skills/bug-reporting/SKILL.md
- feature-requests: .agents/skills/feature-requests/SKILL.md
- secure-coding-owasp: .agents/skills/secure-coding-owasp/SKILL.md
- code-review: .agents/skills/code-review/SKILL.md
- definition-of-done: .agents/skills/definition-of-done/SKILL.md
- memory-discipline: .agents/skills/memory-discipline/SKILL.md

## Inlined Instruction Rules

### agent-discipline

# Agent Discipline

## Surgical Changes

- Touch only what is necessary for the task. Do not "improve" adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code or issues, mention them â€” do not fix them silently.

## Clean Up Your Own Mess

- Remove imports, variables, and functions that YOUR changes made unused.
- Do not remove pre-existing dead code unless explicitly asked. - Instead mention them for the user's attention, but do not fix them silently.
- Every changed line must trace directly to the user's request.

## Simplicity First

- Write the minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that was not requested.
- No error handling for scenarios that cannot happen. Validate only at system boundaries.
- If you wrote 200 lines and it could be 50 â€” rewrite it.

## Think Before Coding

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them â€” do not pick silently.
- If a simpler approach exists, say so.

## Style & Formatting

- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not reformat code you did not change.
- Follow the project's existing conventions over personal preference.

### csharp-style

# C# / .NET Style â€” Nimbus Nordic

Apply to every C# file you write or modify. Follow the official [.NET runtime coding conventions](https://learn.microsoft.com/dotnet/csharp/fundamentals/coding-style/coding-conventions) unless overridden below.

## Language & runtime

- Target the LTS .NET version configured in the solution's `global.json` / `Directory.Build.props`. Do not silently upgrade or downgrade `TargetFramework`.
- `Nullable` reference types: **enabled**. Treat warnings as errors for new files.
- `ImplicitUsings`: enabled at the project level; do not re-import implicit namespaces in individual files.
- Prefer file-scoped namespaces (`namespace Foo.Bar;`).

## Formatting

- 4-space indentation, no tabs.
- One type per file; filename matches the type.
- Braces on new lines (Allman). Always use braces, even for single-line `if` / `for`.
- Max line length ~120 chars. Wrap at logical boundaries, not mid-expression.
- `dotnet format` must pass before commit. Honour the repo `.editorconfig` over personal preference.

## Naming

| Element | Convention |
|---|---|
| Types, methods, properties, events, namespaces | `PascalCase` |
| Local variables, parameters | `camelCase` |
| Private fields | `_camelCase` |
| Constants, `static readonly` | `PascalCase` |
| Interfaces | `IPascalCase` |
| Async methods | suffix `Async` |
| Generic type parameters | `T`, `TKey`, `TValue` |

Do **not** use Hungarian notation. Do not abbreviate beyond well-known terms (`Db`, `Id`, `Url`).

## Idioms

- Use `var` only when the right-hand side makes the type obvious; otherwise spell the type out.
- Prefer expression-bodied members for trivial properties and one-line methods only.
- Prefer `is null` / `is not null` over `== null` / `!= null`.
- Pattern matching over chained `if`/`else` type checks.
- `using` declarations over `using` statements where the scope is the whole method.
- Records for immutable data carriers; classes for behaviour.
- Sealed by default for non-extension classes.

## Async

- All I/O must be `async` / `await`. Never block with `.Result`, `.Wait()`, or `Task.GetAwaiter().GetResult()`.
- Suffix async methods with `Async`. Return `Task` / `Task<T>` / `ValueTask<T>` (the last only when the hot path benefits).
- Always accept a `CancellationToken` on public async APIs and forward it.
- Use `ConfigureAwait(false)` in library code; in ASP.NET Core application code it is unnecessary.

## Error handling

- Throw `ArgumentNullException` / `ArgumentException` at trust boundaries; do not validate internal calls.
- Use `ArgumentNullException.ThrowIfNull(arg)` (net6+).
- Do not catch `Exception` unless you log and rethrow, or you are at a top-level boundary.
- Never swallow exceptions silently (`catch { }`).
- Prefer `Result<T>` / discriminated-union patterns for expected failures; reserve exceptions for exceptional cases.

## Dependency injection

- Constructor injection by default. Avoid service locator and `IServiceProvider.GetService` in business code.
- Register services with the narrowest lifetime that works (`Scoped` > `Transient` > `Singleton`).
- Don't inject `IServiceProvider` into application services.

## Testing

- One test project per production project, named `<Project>.Tests`.
- xUnit unless the solution already uses NUnit / MSTest.
- Test names: `Method_State_ExpectedResult` (`GetUser_WhenIdMissing_ReturnsNotFound`).
- Use `FluentAssertions` if it is already in the solution; otherwise plain `Assert`.
- No `Thread.Sleep` in tests; use `TaskCompletionSource` / `IHostedService` test helpers.

## Logging

- Use `ILogger<T>` via DI. No `Console.WriteLine` / `Debug.WriteLine` in production code.
- Use structured logging placeholders, never string interpolation:
  - âœ… `logger.LogInformation("User {UserId} signed in", userId);`
  - âŒ `logger.LogInformation($"User {userId} signed in");`
- Never log secrets, tokens, full request bodies, or PII.

## Anti-patterns

- `public` fields. Use properties.
- `async void` (except for event handlers).
- Static mutable state.
- Reflection on hot paths.
- LINQ chains longer than 4 operators on a single line â€” extract a method.
- `#region` to hide complexity instead of splitting the type.

### typescript-style

# TypeScript Style â€” Nimbus Nordic

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
- Group imports: node built-ins â†’ external packages â†’ internal aliases â†’ relative â€” separated by blank lines.
- Avoid default exports for non-component modules (default exports confuse refactor tools and tree shaking).
- No circular imports. If your linter can detect them, leave the rule on.

## Error handling

- Throw `Error` (or a subclass), never strings or plain objects.
- Validate input at trust boundaries (HTTP handlers, message consumers, CLI args) with a schema (`zod`, `valibot`, â€¦) â€” not ad-hoc.
- Don't `try / catch` to swallow; either handle, log+rethrow, or convert to a typed result.
- Prefer typed `Result<T, E>` patterns for expected failures; reserve exceptions for unexpected ones.

## React (if used)

- Function components only. Hooks at the top level â€” no conditional hooks.
- Co-locate the component, its tests, and styles.
- Use `useMemo` / `useCallback` only when profiling shows a benefit; not by reflex.
- Server / client component split (Next.js): default to server components; mark `"use client"` only when interactivity / browser APIs require it.

## Testing

- Vitest or Jest, matching what the repo already uses.
- One test file per module: `foo.ts` â†’ `foo.test.ts`.
- Test names describe behaviour, not implementation.
- No `setTimeout`-based waits in tests; use fake timers or async utilities.

## Logging

- Use the repo's logger (`pino`, `winston`, framework logger). No raw `console.log` in production paths; `console.error` is acceptable for top-level fatal handlers.
- Use structured fields rather than string interpolation:
  - âœ… `logger.info({ userId }, 'user signed in')`
  - âŒ `logger.info(\`user \${userId} signed in\`)`
- Never log secrets, tokens, full request bodies, or PII.

## Anti-patterns

- `any`, `as any`, `// @ts-ignore` without a justifying comment.
- Mutating function parameters.
- `enum` with string values when a union of literals would do (`'asc' | 'desc'`).
- Barrel files (`index.ts` re-exporting everything) that hurt tree-shaking; only export what is part of the public API.
- Side effects at module top level (work that runs on import).
- `useEffect` to derive state â€” derive in render or use `useMemo`.

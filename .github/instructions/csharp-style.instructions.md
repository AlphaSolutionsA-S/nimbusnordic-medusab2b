---
applyTo: "**/*.{cs,csx,cshtml,razor}"
description: "Use when writing, reviewing, or modifying C# / .NET code for Nimbus Nordic. Enforces the Alpha C# style and idioms."
---

# C# / .NET Style — Nimbus Nordic

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
  - ✅ `logger.LogInformation("User {UserId} signed in", userId);`
  - ❌ `logger.LogInformation($"User {userId} signed in");`
- Never log secrets, tokens, full request bodies, or PII.

## Anti-patterns

- `public` fields. Use properties.
- `async void` (except for event handlers).
- Static mutable state.
- Reflection on hot paths.
- LINQ chains longer than 4 operators on a single line — extract a method.
- `#region` to hide complexity instead of splitting the type.

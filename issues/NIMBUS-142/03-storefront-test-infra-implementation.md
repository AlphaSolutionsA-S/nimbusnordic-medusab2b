# Task 03 — Storefront Jest + React Testing Library infrastructure

**App:** storefront · **Depends on:** None

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm --filter @b2b-starter/storefront build`
- **Lint command:** `pnpm --filter @b2b-starter/storefront lint`
- **Test command (new):** `pnpm --filter @b2b-starter/storefront test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/` (mirrors component folders, per
  the storefront copilot-instructions)

## Objective

Stand up the storefront test harness that the storefront
`copilot-instructions.md` already assumes but which does **not** currently exist (no
`test` script, no `jest.config`, no `__tests__/`). This task adds the harness and one
smoke test only. It backfills **no** existing untested components (Option B).

## Solution Design

Use `next/jest` so the config inherits the storefront's SWC transform, path aliases
(`@/*`), and CSS handling. Add `jest`, `jest-environment-jsdom`,
`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
and `@types/jest` as dev dependencies. A single smoke test proves the harness runs, so
later tasks (04, 06) can add real tests without re-litigating setup.

Turbo already defines a `test` task; adding the storefront `test` script makes
`pnpm test` at the root include the storefront.

## New Files (verbatim skeletons)

### `apps/storefront/jest.config.ts`

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  clearMocks: true,
};

export default createJestConfig(config);
```

### `apps/storefront/jest.setup.ts`

```typescript
import '@testing-library/jest-dom';
```

### `apps/storefront/src/__tests__/smoke.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';

function Hello() {
  return <span>storefront tests online</span>;
}

describe('storefront test harness', () => {
  it('renders', () => {
    render(<Hello />);
    expect(screen.getByText('storefront tests online')).toBeInTheDocument();
  });
});
```

## Impacted Files

### `apps/storefront/package.json`
- Add script: `"test": "jest"`.
- Add devDependencies: `jest`, `jest-environment-jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/jest`,
  `ts-node` (for the TS Jest config).

  > IMPLEMENT: pin versions compatible with React 19 / Next 15.5 (Testing Library
  > React 16+, jest 29+).

### `apps/storefront/tsconfig.json`
- Ensure `jest` and `@testing-library/jest-dom` types resolve. The existing `types`
  array is `["node", "@types/wicg-file-system-access"]`; add `"jest"` (and rely on
  `jest.setup.ts` importing `@testing-library/jest-dom` for its matchers).

## Test Cases

### TC-1: Harness runs
- **Given:** the new config and smoke test
- **When:** `pnpm --filter @b2b-starter/storefront test`
- **Then:** Jest runs and the smoke test passes

### TC-2: Path alias resolves in tests
- **Given:** `moduleNameMapper` for `@/*`
- **When:** a test imports from `@/…`
- **Then:** it resolves without error

### TC-3: Root test task includes storefront
- **Given:** the new `test` script
- **When:** `pnpm test` at the repo root
- **Then:** turbo runs the storefront Jest suite

## Implementation Steps

1. Add the dev dependencies and `test` script to the storefront `package.json`.
2. Add `jest.config.ts`, `jest.setup.ts`, and the smoke test.
3. Add `"jest"` to the storefront `tsconfig.json` `types` array.
4. Run `pnpm install` at the root; run the storefront test suite and confirm green.

## Guardrails

- Do **not** add tests for pre-existing untested components (out of scope — Option B).
- Do not change existing storefront runtime code in this task.
- Match the storefront naming/structure conventions (`src/__tests__/`).

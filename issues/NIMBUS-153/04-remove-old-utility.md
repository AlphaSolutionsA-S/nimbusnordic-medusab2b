# Task 04: Remove Old Utility File

## Objective

Delete the now-unused `apps/backend/src/utils/business-central-client.ts` file. Verify no remaining imports reference it.

## Solution Design

After Task 03 moves the only consumer to the module service, the utility file is dead code. Remove it and verify no other file in the codebase imports from it.

## Impacted Files

### DELETE: `apps/backend/src/utils/business-central-client.ts`

Remove entirely.

## Verification Commands

```bash
# Search for any remaining imports of the old utility
grep -r "business-central-client" apps/backend/src/ --include="*.ts"

# Should return zero results after deletion
```

## Test Cases

### TC-1: No dangling imports
- **Given:** The utility file is deleted
- **When:** A repo-wide grep for `business-central-client` is run
- **Then:** No `.ts` files import from that path

### TC-2: Build still passes
- **Given:** The utility file is deleted and route uses module service
- **When:** `pnpm build` is run from repo root
- **Then:** Build succeeds with no errors

## Implementation Steps

1. Run `grep -r "business-central-client" apps/backend/src/ --include="*.ts"` to confirm only the route (already migrated) imported it
2. Delete `apps/backend/src/utils/business-central-client.ts`
3. Verify TypeScript compiles: `cd apps/backend && npx tsc --noEmit`

# Task 02: Wire Module in medusa-config.ts

## Objective

Register the new Business Central module in `apps/backend/medusa-config.ts` so Medusa's DI container resolves it at startup.

## Solution Design

Follow the exact same pattern as existing modules (COMPANY_MODULE, QUOTE_MODULE, APPROVAL_MODULE): import the constant and add a resolve entry in the `modules` object.

## Impacted Files

### `apps/backend/medusa-config.ts`

**Add import (line 1 area):**
```typescript
import { BUSINESS_CENTRAL_MODULE } from "./src/modules/business-central";
```

**Add module registration in the `modules` object:**
```typescript
[BUSINESS_CENTRAL_MODULE]: {
  resolve: "./modules/business-central",
},
```

### Full diff context:

```diff
 import { QUOTE_MODULE } from "./src/modules/quote";
 import { APPROVAL_MODULE } from "./src/modules/approval";
 import { COMPANY_MODULE } from "./src/modules/company";
+import { BUSINESS_CENTRAL_MODULE } from "./src/modules/business-central";
 import { loadEnv, defineConfig } from "@medusajs/framework/utils";

 ...

   modules: {
     [COMPANY_MODULE]: {
       resolve: "./modules/company",
     },
     [QUOTE_MODULE]: {
       resolve: "./modules/quote",
     },
     [APPROVAL_MODULE]: {
       resolve: "./modules/approval",
     },
+    [BUSINESS_CENTRAL_MODULE]: {
+      resolve: "./modules/business-central",
+    },
   },
```

## Test Cases

### TC-1: Config imports resolve
- **Given:** Module files from Task 01 exist
- **When:** `medusa-config.ts` is compiled
- **Then:** No TypeScript errors — import resolves correctly

### TC-2: Module registered in config
- **Given:** The module is registered
- **When:** Medusa backend starts
- **Then:** The `businessCentral` module is loaded and its service is available in the DI container

## Implementation Steps

1. Open `apps/backend/medusa-config.ts`
2. Add `import { BUSINESS_CENTRAL_MODULE } from "./src/modules/business-central";` with the other module imports
3. Add `[BUSINESS_CENTRAL_MODULE]: { resolve: "./modules/business-central" }` to the `modules` object
4. Verify TypeScript compiles: `cd apps/backend && npx tsc --noEmit`

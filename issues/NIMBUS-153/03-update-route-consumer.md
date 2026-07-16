# Task 03: Update Route Consumer to Use Module Service

## Objective

Update `apps/backend/src/api/store/business-central/operations/route.ts` to resolve the Business Central module service from Medusa's DI container instead of importing the utility function directly. The route's external contract (request/response shape) MUST remain identical.

## Solution Design

Use `req.scope.resolve()` to obtain the module service instance. The service key is the module name constant `"businessCentral"`. Call `service.getOperations()` instead of the old `getBusinessCentralOperations()` utility.

## Impacted Files

### `apps/backend/src/api/store/business-central/operations/route.ts`

**Replace entire file content:**

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const businessCentralService = req.scope.resolve<IBusinessCentralModuleService>(
    BUSINESS_CENTRAL_MODULE
  );

  const operations = await businessCentralService.getOperations();

  res.json({
    operations,
  });
};
```

**Key changes:**
- Remove import of `getBusinessCentralOperations` from `../../../../utils/business-central-client`
- Add imports for `BUSINESS_CENTRAL_MODULE` and `IBusinessCentralModuleService`
- Resolve service from DI container via `req.scope.resolve()`
- Change `_req` to `req` (need access to `.scope`)
- Response shape `{ operations }` remains identical

## Test Cases

### TC-1: Route contract preserved — success case
- **Given:** Valid Business Central credentials in environment
- **When:** `GET /store/business-central/operations` is called
- **Then:** Response is `200` with JSON body `{ operations: <BC API response> }` — same as before

### TC-2: Route contract preserved — error case
- **Given:** Invalid/missing Business Central credentials
- **When:** `GET /store/business-central/operations` is called
- **Then:** Response is an error with appropriate MedusaError type — same behavior as before

### TC-3: DI resolution works
- **Given:** Module is registered in medusa-config
- **When:** Route handler executes `req.scope.resolve(BUSINESS_CENTRAL_MODULE)`
- **Then:** Returns an instance of `BusinessCentralModuleService` with `getOperations` method

## Implementation Steps

1. Open `apps/backend/src/api/store/business-central/operations/route.ts`
2. Replace the import of `getBusinessCentralOperations` with imports from the module
3. Update the `GET` handler to resolve the service from `req.scope` and call `service.getOperations()`
4. Ensure response shape remains `res.json({ operations })`
5. Verify TypeScript compiles: `cd apps/backend && npx tsc --noEmit`

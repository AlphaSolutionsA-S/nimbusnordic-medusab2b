# Task 01: Create Business Central Module Structure

## Objective

Create the new Medusa module at `apps/backend/src/modules/business-central/` following existing module patterns. This module is service-only (no database models or migrations) and encapsulates all Business Central HTTP connectivity logic.

## Solution Design

The module differs from existing modules (company, quote, approval) in that it has no data models. The service class will NOT extend `MedusaService({...})` — instead it will be a plain class implementing a custom `IBusinessCentralModuleService` interface. This is valid for integration/adapter modules in Medusa v2.

The service will encapsulate:
- Discovery URL parsing and validation
- Tenant ID extraction
- Client credential validation
- OAuth2 token retrieval
- Business Central operations fetch

## New Files

### `apps/backend/src/modules/business-central/types.ts`

```typescript
export interface IBusinessCentralModuleService {
  /**
   * Fetches the operations list from Business Central API.
   * Handles token acquisition internally.
   */
  getOperations(): Promise<unknown>;
}
```

### `apps/backend/src/modules/business-central/service.ts`

```typescript
import { MedusaError } from "@medusajs/framework/utils";
import type { IBusinessCentralModuleService } from "./types";

const DEFAULT_BUSINESS_CENTRAL_DISCOVERY_URL =
  "https://api.businesscentral.dynamics.com/v2.0/f44eef10-122f-4a63-9f5c-bd9fbd87a364/TestDK/api/v2.0";
const BUSINESS_CENTRAL_SCOPE =
  "https://api.businesscentral.dynamics.com/.default";
const AZURE_GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type BusinessCentralTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type BusinessCentralTokenErrorResponse = {
  error?: string;
  error_description?: string;
};

class BusinessCentralModuleService implements IBusinessCentralModuleService {
  // IMPLEMENT: migrate all private helper methods from the old utility:
  //   - getDiscoveryUrl(): URL
  //   - getTenantId(discoveryUrl: URL): string
  //   - getClientCredentials(): { clientId: string; clientSecret: string }
  //   - getTokenErrorMessage(tokenResponse: Response): Promise<string>
  //   - requestToken(tenantId: string, clientId: string, clientSecret: string): Promise<string>

  // IMPLEMENT: public method — orchestrates the above helpers (same logic as old getBusinessCentralOperations)
  async getOperations(): Promise<unknown> {
    // IMPLEMENT: same logic as the old exported getBusinessCentralOperations() function
  }
}

export default BusinessCentralModuleService;
```

### `apps/backend/src/modules/business-central/index.ts`

```typescript
import { Module } from "@medusajs/framework/utils";
import BusinessCentralModuleService from "./service";

export const BUSINESS_CENTRAL_MODULE = "businessCentral";

export default Module(BUSINESS_CENTRAL_MODULE, {
  service: BusinessCentralModuleService,
});
```

## Impacted Files

None — all new files.

## Test Cases

### TC-1: Module exports are correct
- **Given:** The module files are created
- **When:** `index.ts` is imported
- **Then:** It exports `BUSINESS_CENTRAL_MODULE` constant with value `"businessCentral"` and a default Module export

### TC-2: Service implements interface
- **Given:** `BusinessCentralModuleService` class exists
- **When:** TypeScript compiles the service
- **Then:** It satisfies `IBusinessCentralModuleService` (has `getOperations(): Promise<unknown>`)

### TC-3: Discovery URL validation
- **Given:** `BUSINESS_CENTRAL_DISCOVERY_URL` env is set to an HTTP (non-HTTPS) URL
- **When:** `getOperations()` is called
- **Then:** A `MedusaError` with type `INVALID_DATA` is thrown

### TC-4: Missing client credentials
- **Given:** `BUSINESS_CENTRAL_CLIENT_ID` env is not set
- **When:** `getOperations()` is called
- **Then:** A `MedusaError` with type `INVALID_DATA` is thrown with message about missing client ID

## Implementation Steps

1. Create directory `apps/backend/src/modules/business-central/`
2. Create `types.ts` with the `IBusinessCentralModuleService` interface
3. Create `service.ts` — migrate ALL logic from `apps/backend/src/utils/business-central-client.ts` into private methods of `BusinessCentralModuleService`, keeping the single public method `getOperations()` with identical behavior
4. Create `index.ts` — export `BUSINESS_CENTRAL_MODULE` constant and `Module()` registration
5. Verify TypeScript compiles: `cd apps/backend && npx tsc --noEmit`

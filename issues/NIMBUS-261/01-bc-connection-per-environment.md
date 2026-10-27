# 01: BC connection per environment; every caller names its environment
**App:** backend · **Layer:** L2 (BC module), with mechanical caller changes in L3/L6 and the test guard in `utils/` · **Depends on:** None

**Goal:** The BC module serves a DK and a NO environment, each with its own discovery URL, BC company GUID, ODataV4 company name and local currency; every BC call names its environment, and every current caller passes `DK`.
**Files / areas:** `modules/business-central/` (new config file beside `service.ts`, `types.ts`, `service.ts`, `return-history.ts`, `shipment-reads.ts` as needed); callers: `api/store/bc-orders/**`, `api/store/bc-returns/**`, `workflows/business-central-return/steps/*`, `workflows/company/steps/prepare-company-bc-sync.ts`, `workflows/business-central-order/steps/{prepare,submit}-bc-order.ts`, `workflows/shipment-notice/steps/{check-shipments,scan-shipment-windows}.ts`; `utils/business-central-test-environment.ts`; `apps/backend/.env.template`.
**Seam contracts:**
- `export type BusinessCentralEnvironment = "DK" | "NO"` in `modules/business-central/types.ts`.
- Every `IBusinessCentralModuleService` method except `getOperations` takes `environment: BusinessCentralEnvironment` as its first argument; other arguments unchanged.
- Variables: DK unchanged (`BUSINESS_CENTRAL_DISCOVERY_URL` with today's TestDK default, `BUSINESS_CENTRAL_COMPANY_ID`, `BUSINESS_CENTRAL_LCY_CODE` default `DKK`); NO: `BUSINESS_CENTRAL_NO_DISCOVERY_URL` (no default), `BUSINESS_CENTRAL_NO_COMPANY_ID`, `BUSINESS_CENTRAL_NO_LCY_CODE` (default `NOK`); client id and secret shared.
- The config file exports the local currency of an environment, for task 05's sync step.
- `.env.template` shows the TestNO example beside TestDK: discovery URL with environment `TestNO`, company GUID `223f0db0-7884-ee11-8178-002248dd26d9`, `NOK`.
- Order submission and shipment-notice callers pass `DK` permanently; tasks 03 to 05 replace the other callers' `DK`.
**Test intent:**
- BC module spec (mocked `fetch`): a `NO` call uses the NO discovery URL, NO company GUID and the NO company name in `company=`; a `DK` call is unchanged (assert the requested URLs).
- NO configuration missing or invalid: the NO call throws, the error names the variable and `NO` and contains no URL, tenant, client id or secret; a DK call still succeeds in the same process.
- Return detail with a blank currency: `NOK` for `NO` (or `BUSINESS_CENTRAL_NO_LCY_CODE`), `DKK` for `DK`.
- Shipment-read cache: a cached DK token and company name are not reused for a `NO` call.
- Guard unit: NO URL unset → passes; `TestNO` → passes with the default allowlist; `ProductionNO` → aborts; message holds only the environment name.
**Done when:** typecheck shows no new errors, every listed caller passes an explicit environment, and the BC module and guard tests pass.
**Also update:** all BC module specs in `src/modules/business-central/__tests__/` (new first argument); `src/utils/__tests__/business-central-test-environment.unit.spec.ts`; `src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts` (`getReturn` call shape); `integration-tests/http/business-central-order/send-order-to-bc.spec.ts` (`createSalesOrder.mock.calls[n][0]` becomes the environment); `integration-tests/http/shipment-notice/check-shipments.spec.ts:625`; `integration-tests/global-setup.ts` comment if it names one environment; `.env.template` comments on `BUSINESS_CENTRAL_TEST_ENVIRONMENTS`.

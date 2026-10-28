# Business Central probe results, 2026-10-27

Run by the main session. TestNO and TestDK: `samples/probe-bc-environment.mjs`, shared app
registration from `apps/backend/.env`, TestDK discovery URL with the environment segment swapped.
Production: two scratch read-only count scripts over all customers (paged). All requests were reads;
only counts, status codes and company names/GUIDs were printed. No customer numbers or names are
recorded here.

## TestNO

| Check | Result |
|---|---|
| Companies | 1: `TEST-Nimbus NORGE-TEST`, `223f0db0-7884-ee11-8178-002248dd26d9` |
| Unscoped standard API resolves to the configured company | yes |
| Standard API `customers`, `salesOrders`, `salesInvoices`, `salesReturnOrders` | 200 |
| ODataV4 `PostedReturnReceipt`, `PostedReturnReceiptReturnRcptLines` | 200 |
| ODataV4 `$metadata` | 200 |
| Custom API `customerPortal/v2.0` `salesReturnOrders`, `salesOrderReservationEntries` | 404 |
| ODataV4 `CS_EnabledReasonCodes` | 404 |
| `$metadata` mentions `CustomerPortalReturns` | no |
| Customer country (all 207) | `""`: 205, `"NO"`: 2 |
| Blank currency code | 0 (all 207 `NOK`) |

Conclusion: the customer-portal extension is not deployed in TestNO. Blank countries are test data.

## TestDK (baseline)

| Check | Result |
|---|---|
| Companies | 1: `Nimbus Nordic A/S` |
| All requests above, including the custom API and `CS_EnabledReasonCodes` | 200 |
| `CS_EnabledReasonCodes` rows | 0 (so the missing `NORMAL` is not NO-specific; the return step hard-codes `NORMAL`, NIMBUS-138) |
| `$metadata` mentions `CustomerPortalReturns` | yes |

## Production (counts only; the extension was not probed)

| Environment | Companies | Customers (Nimbus company) | Country | Currency |
|---|---|---|---|---|
| ProductionDK | 2: `CRONUS Danmark A/S` (`927fd0e5-c22f-ee11-bdfe-6045bde9b7c2`, 5 customers), `Nimbus Nordic A/S` (`ad96ec81-7f92-ee11-8178-000d3ab9277c`) | 2197 | `NO` 300, blank 16, others DK and abroad | EUR 1011, SEK 507, DKK 385, NOK 294; of the 300 `NO`: NOK 291, DKK 9 |
| ProductionNO | 1: `Nimbus Nordic Norge` (`7f27d3c6-0a95-ee11-be36-002248754d45`) | 301 | `NO` 292, `DK` 6, blank 3 | NOK 301 |

Overlap of customer numbers:

- 299 of the 301 ProductionNO numbers also exist in ProductionDK; 298 of those have the same name
  and 293 the same country. They are the same customers, registered in both environments.
- 296 of the 300 ProductionDK customers with country `NO` exist in ProductionNO; 4 do not (they
  would route to NO and be not found).
- ProductionDK holds two companies, so its unscoped standard API calls rely on BC's default company
  being `Nimbus Nordic A/S`; to confirm with the probe before go-live.

## 2026-10-28 recheck (TestNO)

Run by the main session with the same read-only probe (`samples/probe-bc-environment.mjs`) against
TestNO. Reads only; counts and status codes recorded.

| Check | Result |
|---|---|
| Custom API `customerPortal/v2.0` `salesReturnOrders`, `salesOrderReservationEntries` | 200 (was 404) |
| `$metadata` mentions `CustomerPortalReturns` | yes (was no) |
| ODataV4 `CS_EnabledReasonCodes` | still 404 |
| Customer country (all 207) | still `""`: 205, `"NO"`: 2 |

Conclusion: the customer-portal extension is now deployed in TestNO, so open return detail,
reservations on order detail and return creation can be checked there after deploy.
`CS_EnabledReasonCodes` is still missing; nothing calls `/store/bc-orders/return-reasons` today and
return creation hard-codes `NORMAL` (NIMBUS-138), so it is a BC-side follow-up, not a blocker.
Blank TestNO countries remain test data to fill (or use the two `NO` cards).

# Task 01: Backend country-code rule on canonical addresses — Implementation Plan

**Status:** DONE (2026-09-30)
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-171 (from develop)
**Depends on:** None
**Approved:** 2026-09-30. Q1 plan approved, including the upper-case canonical value. Q2 option (a):
Medusa `defaultCountries` minus `XK`, pinned at 249. See PLAN.md "Resolved decisions".

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit`
- **Test framework:** Jest (`@swc/jest`, node). Unit tests match `**/src/**/__tests__/**/*.unit.spec.[jt]s`.
- **Test location:** `apps/backend/src/modules/order-ingestion/__tests__/` and
  `apps/backend/src/workflows/order-ingestion/__tests__/`
- **Naming conventions:** kebab-case non-component files; match the existing file style in this
  module: **double quotes**, semicolons, 2-space indent, `z` imported from `@medusajs/framework/zod`
  (this is zod **v4**, re-exported by Medusa 2.21).

## Solution Design

Decisions this task implements: D1 (backend is the check that must hold), D2/D10 (official ISO
3166-1 alpha-2 list from an installed library), D3 (any case, trimmed, stored lower case on the
Medusa address), D4 (existing 400 validation error, naming field path and value sent), D5 (both
`billTo` and `shipTo`), D11 (one documented, empty exceptions allowlist next to the check).

1. **ISO list source (D10).** `@medusajs/framework/utils` exports `defaultCountries`
   (`{ alpha2, alpha3, name, numeric }[]`, 250 entries, all upper case). It is the list Medusa's
   own region module uses. No new dependency is needed. `i18n-iso-countries` is **not** installed
   anywhere in the workspace. Medusa's list contains `XK` (Kosovo), which is a user-assigned code,
   not an officially assigned one. So the helper removes `XK` explicitly. That leaves exactly the
   249 officially assigned codes. A unit test pins that count so a Medusa upgrade that changes the
   list fails loudly.
2. **New helper file** `apps/backend/src/modules/order-ingestion/country-code.ts`. It holds the
   official set, the exceptions allowlist (D11, empty), `normalizeCountryCode` and
   `isAllowedCountryCode`.
   - Whitespace that is trimmed is **space, tab, CR, LF only** (`[ \t\n\r]`), not every Unicode
     space as `String.prototype.trim()` would. This is the same set the APIM shape check (Task 03)
     allows, so APIM never rejects a value the backend accepts.
   - The trimmed value must match `/^[A-Za-z]{2}$/` **before** it is upper-cased. Without that,
     Unicode case mapping lets non-ASCII input through: `"ß".toUpperCase()` is `"SS"` (South
     Sudan), `"ıt"` becomes `"IT"`, `"ſe"` becomes `"SE"`.
3. **Schema change** in `canonical-order-schema.ts`: `country: z.string().min(1)` becomes
   `country: CanonicalCountryCodeSchema`. It is a `z.string()` with a `.refine` that runs on the
   **raw** value, so the error echoes the value that was sent, followed by `.transform(normalizeCountryCode)`.
   - Parsed output is the trimmed, **upper-case** code (`" se "` → `"SE"`). That is what
     `req.validatedBody` carries, what `metadata.canonical_order` stores, and what NIMBUS-148 sends
     to Business Central (BC's country/region codes are upper case; see PLAN.md).
   - The inferred type `CanonicalOrderAddress["country"]` stays `string`. No caller changes.
4. **Error format (D4).** `validateAndTransformBody` → Medusa `zodValidator` throws
   `MedusaError(INVALID_DATA, "Invalid request: " + messages)`, which is the existing 400. For a
   `custom` issue, Medusa uses `issue.message` verbatim (it does not add the path itself). So the
   message names the path. Verified in a throwaway probe against the installed Medusa 2.21:
   `Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'Denmark'`.
   Only the field path and the sent country value are echoed.
   A non-string country still gets Medusa's own `invalid_type` message.
5. **Mapping (`map-canonical-order-header.ts`) is unchanged.** It keeps
   `country_code: address.country.toLowerCase()`, so `"SE"` is stored as `"se"`. A new unit test
   covers the parse → map wiring.

## Code Skeletons

### New File: `apps/backend/src/modules/order-ingestion/country-code.ts`

Write this file verbatim (it was type-checked against the repo's tsconfig during planning).

```typescript
import { defaultCountries } from "@medusajs/framework/utils";

/*
  Medusa's country list (defaultCountries, the ISO 3166-1 data its region module uses) also
  contains XK (Kosovo), a user-assigned code that ISO has not officially assigned. Only officially
  assigned codes are valid by default (NIMBUS-171 D11), so it is removed here.
*/
const NOT_OFFICIALLY_ASSIGNED_CODES: ReadonlySet<string> = new Set(["XK"]);

/*
  Exceptions allowlist (NIMBUS-171 D11): the one place to accept a two-letter code that is not an
  officially assigned ISO 3166-1 alpha-2 code, such as "XK" (Kosovo), "UK" or "EU". Add upper-case
  codes only, and record the decision (issue key and reason) next to each entry. Business Central
  must also know the code before orders using it can be submitted there. Empty on purpose.
*/
export const COUNTRY_CODE_EXCEPTIONS: ReadonlySet<string> = new Set<string>([]);

export const OFFICIAL_ISO_COUNTRY_CODES: ReadonlySet<string> = new Set(
  defaultCountries
    .map((country) => country.alpha2.toUpperCase())
    .filter((code) => !NOT_OFFICIALLY_ASSIGNED_CODES.has(code))
);

const COUNTRY_CODE_SHAPE = /^[A-Za-z]{2}$/;

// Space, tab, CR and LF only: the same set the NIMBUS-145 APIM shape check allows.
const SURROUNDING_WHITESPACE = /^[ \t\n\r]+|[ \t\n\r]+$/g;

export function normalizeCountryCode(value: string): string {
  return value.replace(SURROUNDING_WHITESPACE, "").toUpperCase();
}

/*
  The shape is checked before upper-casing: Unicode case mapping would otherwise turn input such
  as "ß" into "SS" or "ıt" into "IT".
*/
export function isAllowedCountryCode(
  value: string,
  exceptions: ReadonlySet<string> = COUNTRY_CODE_EXCEPTIONS
): boolean {
  const trimmed = value.replace(SURROUNDING_WHITESPACE, "");

  if (!COUNTRY_CODE_SHAPE.test(trimmed)) {
    return false;
  }

  const code = trimmed.toUpperCase();

  return OFFICIAL_ISO_COUNTRY_CODES.has(code) || exceptions.has(code);
}
```

### Modified File: `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`

Add the import below the existing `z` import (blank line between external and relative imports):

```typescript
import { z } from "@medusajs/framework/zod";

import { isAllowedCountryCode, normalizeCountryCode } from "./country-code";
```

Add this block directly **above** `export const CanonicalOrderAddressSchema`:

```typescript
/*
  ISO 3166-1 alpha-2 country code (NIMBUS-171). Any case and surrounding whitespace are accepted;
  the parsed value is the trimmed upper-case code (" se " -> "SE"). The check runs on the raw value
  so the 400 message echoes what was sent. The code list and the exceptions allowlist live in
  ./country-code.ts.
*/
const CanonicalCountryCodeSchema = z
  .string()
  .refine((value) => isAllowedCountryCode(value), {
    error: (issue) =>
      `Field '${(issue.path ?? []).map(String).join(".")}' must be an ISO 3166-1 alpha-2 country code, but got: '${String(issue.input)}'`,
  })
  .transform(normalizeCountryCode);
```

Change one line inside `CanonicalOrderAddressSchema`:

```typescript
    country: CanonicalCountryCodeSchema,
```

(was `country: z.string().min(1),`). Change nothing else in this file.

### New File: `apps/backend/src/modules/order-ingestion/__tests__/country-code.unit.spec.ts`

```typescript
import {
  COUNTRY_CODE_EXCEPTIONS,
  OFFICIAL_ISO_COUNTRY_CODES,
  isAllowedCountryCode,
  normalizeCountryCode,
} from "../country-code";

describe("country-code", () => {
  it("TC-1: holds exactly the 249 officially assigned ISO 3166-1 alpha-2 codes (pins Medusa's defaultCountries minus XK)", () => {
    expect(OFFICIAL_ISO_COUNTRY_CODES.size).toEqual(249);
    for (const code of ["DK", "SE", "NO", "DE", "GB", "FI", "PS", "SS", "AQ"]) {
      expect(OFFICIAL_ISO_COUNTRY_CODES.has(code)).toBe(true);
    }
    for (const code of ["XK", "UK", "EU", "XX", "AN", "YU"]) {
      expect(OFFICIAL_ISO_COUNTRY_CODES.has(code)).toBe(false);
    }
  });

  it("TC-2: accepts official codes in any case with surrounding space, tab, CR or LF", () => {
    for (const value of ["DK", "dk", "Dk", " SE ", "\tno\n", "\r\nGB\r\n"]) {
      expect(isAllowedCountryCode(value)).toBe(true);
    }
  });

  it("TC-3: rejects three-letter codes, names, unassigned and user-assigned codes, and empty values", () => {
    for (const value of ["DNK", "Denmark", "XX", "XK", "UK", "EU", "", "   ", "D K", "D1"]) {
      expect(isAllowedCountryCode(value)).toBe(false);
    }
  });

  it("TC-4: rejects non-ASCII input that Unicode upper-casing would turn into a valid code, and non-ASCII padding", () => {
    // "ß" -> "SS", "ıt" -> "IT", "ſe" -> "SE" under toUpperCase(); U+00A0 is outside the trimmed set.
    for (const value of ["ß", "ıt", "ſe", " DK"]) {
      expect(isAllowedCountryCode(value)).toBe(false);
    }
  });

  it("TC-5: the exceptions allowlist is empty by default, and a code added to it is accepted without changing the check", () => {
    expect(COUNTRY_CODE_EXCEPTIONS.size).toEqual(0);
    expect(isAllowedCountryCode("XK")).toBe(false);
    expect(isAllowedCountryCode("xk", new Set(["XK"]))).toBe(true);
    expect(isAllowedCountryCode("XKK", new Set(["XK"]))).toBe(false);
  });

  it("TC-6: normalizes to the trimmed upper-case code", () => {
    expect(normalizeCountryCode(" se ")).toEqual("SE");
    expect(normalizeCountryCode("\tdk\n")).toEqual("DK");
    expect(normalizeCountryCode("DK")).toEqual("DK");
  });
});
```

### Additions to `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-schema.unit.spec.ts`

Keep all existing tests. Append this `describe` block **inside** the existing top-level
`describe("CanonicalOrderSchema", ...)`, after TC-14:

```typescript
  describe("address country (NIMBUS-171)", () => {
    const address = {
      name: "JK Tryk",
      addressLine1: "Industrikrogen 11B",
      city: "Rønnede",
      postCode: "4683",
      country: "DK",
    };

    it("TC-15: accepts ISO codes in any case with surrounding whitespace on billTo and shipTo, and outputs the trimmed upper-case code", () => {
      const cases: ReadonlyArray<readonly [string, string]> = [
        ["DK", "DK"],
        ["dk", "DK"],
        [" SE ", "SE"],
        ["\tno\n", "NO"],
        ["Gb", "GB"],
      ];

      for (const [sent, expected] of cases) {
        const result = CanonicalOrderSchema.safeParse({
          ...singleLineCanonicalOrder,
          billTo: { ...address, country: sent },
          shipTo: { ...address, country: sent },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.billTo?.country).toEqual(expected);
          expect(result.data.shipTo?.country).toEqual(expected);
        }
      }
    });

    it("TC-16: rejects a shipTo.country that is not an officially assigned ISO code, naming the field path and the value sent", () => {
      for (const country of ["DNK", "Denmark", "XX", "", "   ", "XK", "UK", "EU", "ß", "ıt"]) {
        const result = CanonicalOrderSchema.safeParse({
          ...singleLineCanonicalOrder,
          shipTo: { ...address, country },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toHaveLength(1);
          expect(result.error.issues[0].path).toEqual(["shipTo", "country"]);
          expect(result.error.issues[0].message).toEqual(
            `Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: '${country}'`
          );
        }
      }
    });

    it("TC-17: applies the same rule to billTo.country (every address in the order)", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        billTo: { ...address, country: "Denmark" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["billTo", "country"]);
        expect(result.error.issues[0].message).toContain("'Denmark'");
      }
    });

    it("TC-18: reports both addresses when both countries are invalid", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        billTo: { ...address, country: "DNK" },
        shipTo: { ...address, country: "Sweden" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toEqual(
          expect.arrayContaining([
            ["billTo", "country"],
            ["shipTo", "country"],
          ])
        );
      }
    });

    it("TC-19: still rejects a non-string country with a type error", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        shipTo: { ...address, country: 45 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["shipTo", "country"]);
        expect(result.error.issues[0].code).toEqual("invalid_type");
      }
    });
  });
```

### Additions to `apps/backend/src/workflows/order-ingestion/__tests__/map-canonical-order-header.unit.spec.ts`

Add this import below the existing imports:

```typescript
import { CanonicalOrderSchema } from "../../../modules/order-ingestion/canonical-order-schema";
```

Append inside the existing `describe("mapCanonicalOrderHeader", ...)`, after TC-2:

```typescript
  it("TC-3: stores a schema-normalized country as a lower-case country_code on both addresses (parse -> map wiring)", () => {
    const address = {
      name: "JK Tryk",
      addressLine1: "Industrikrogen 11B",
      city: "Rønnede",
      postCode: "4683",
    };
    const parsed = CanonicalOrderSchema.parse({
      ...multiLineCanonicalOrder,
      shipTo: { ...address, country: " se " },
      billTo: { ...address, country: "Dk" },
    });

    const header = mapCanonicalOrderHeader(parsed);

    expect(parsed.shipTo?.country).toEqual("SE");
    expect(header.shipping_address?.country_code).toEqual("se");
    expect(header.billing_address?.country_code).toEqual("dk");
  });
```

## Impacted Files

| File | Change |
|------|--------|
| `apps/backend/src/modules/order-ingestion/country-code.ts` | **New.** `OFFICIAL_ISO_COUNTRY_CODES: ReadonlySet<string>`, `COUNTRY_CODE_EXCEPTIONS: ReadonlySet<string>` (empty), `normalizeCountryCode(value: string): string`, `isAllowedCountryCode(value: string, exceptions?: ReadonlySet<string>): boolean` |
| `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts` | New non-exported `CanonicalCountryCodeSchema`; `CanonicalOrderAddressSchema.country` uses it. `CanonicalOrderAddress` type unchanged (`country: string`). |
| `apps/backend/src/modules/order-ingestion/__tests__/country-code.unit.spec.ts` | **New.** TC-1 to TC-6. |
| `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-schema.unit.spec.ts` | Add TC-15 to TC-19. |
| `apps/backend/src/workflows/order-ingestion/__tests__/map-canonical-order-header.unit.spec.ts` | Add TC-3 and one import. |
| `apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts` | **No change** (keeps `.toLowerCase()`). |
| `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` | **No change** (non-strict `country: z.string().optional()`; it reads the normalized value from metadata). |

## Test Cases

### TC-1: Official list is pinned
- **Given:** Medusa 2.21 `defaultCountries`
- **When:** `OFFICIAL_ISO_COUNTRY_CODES` is built
- **Then:** it has 249 codes, includes DK/SE/GB, excludes XK/UK/EU/XX

### TC-2 / TC-15: Any case and surrounding whitespace are accepted
- **Given:** a `billTo` and `shipTo` with country `dk`, `" SE "`, `"\tno\n"` or `Gb`
- **When:** the canonical order is parsed
- **Then:** parsing succeeds and the country is `DK` / `SE` / `NO` / `GB`

### TC-3 / TC-16 / TC-17: Invalid codes are rejected with field path and value sent
- **Given:** `shipTo.country` (or `billTo.country`) is `DNK`, `Denmark`, `XX`, `""`, `XK`, `UK` or `EU`
- **When:** the canonical order is parsed
- **Then:** parsing fails with one issue at `["shipTo","country"]` whose message is
  `Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: '<value sent>'`

### TC-4: Unicode case-mapping bypass is closed
- **Given:** `ß`, `ıt`, `ſe`, or NBSP-padded `DK`
- **When:** `isAllowedCountryCode` runs
- **Then:** it returns `false`

### TC-5: Exceptions allowlist
- **Given:** the default empty allowlist, and a test allowlist `{"XK"}`
- **When:** `isAllowedCountryCode("XK")` / `isAllowedCountryCode("xk", new Set(["XK"]))` run
- **Then:** `false` / `true`

### TC-18: Both addresses reported
- **Given:** `billTo.country = "DNK"` and `shipTo.country = "Sweden"`
- **When:** parsed
- **Then:** issues exist for both paths

### TC-19: Wrong type
- **Given:** `shipTo.country = 45`
- **When:** parsed
- **Then:** an `invalid_type` issue at `["shipTo","country"]`

### Mapping TC-3: Parse → map wiring
- **Given:** `shipTo.country = " se "`, `billTo.country = "Dk"`
- **When:** parsed by the schema and mapped by `mapCanonicalOrderHeader`
- **Then:** `shipping_address.country_code = "se"` and `billing_address.country_code = "dk"`

## Implementation Steps

1. Create `country-code.ts` exactly as above.
2. Edit `canonical-order-schema.ts`: add the import, the `CanonicalCountryCodeSchema` block above
   `CanonicalOrderAddressSchema`, and change the `country` line. Nothing else.
3. Create `__tests__/country-code.unit.spec.ts`.
4. Append TC-15 to TC-19 to `canonical-order-schema.unit.spec.ts`.
5. Add the import and TC-3 to `map-canonical-order-header.unit.spec.ts`.
6. Run `cd apps/backend && pnpm test:unit`. All tests pass, including the existing ones (fixtures
   use `"DK"`, which is still valid).
7. Run `cd apps/backend && pnpm build`, then `pnpm lint` from the repo root.
8. Do not commit (the dispatcher/main session owns git).

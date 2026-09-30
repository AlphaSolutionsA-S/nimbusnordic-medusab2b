# Task 03: APIM shape check and contract docs for `country` — Implementation Plan

**Status:** TODO
**App:** backend (contract artifacts under `issues/NIMBUS-145/artifacts/` and `issues/NIMBUS-147/`; one backend unit test)
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-171 (from develop)
**Depends on:** Task 01
**Approved:** 2026-09-30 (Q1). Q3: manual testing of the deployed APIM policy is accepted.

---

## Project Environment

- **App root:** `apps/backend` (for the consistency test only)
- **Build command:** `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit`
- **Test framework:** Jest (`@swc/jest`). APIM itself has **no automated test infrastructure**
  in this repo (same as NIMBUS-145). APIM behavior is checked manually with
  `issues/NIMBUS-145/artifacts/test-payloads.md` after deployment. ⚠️ **MANUAL TESTING REQUIRED**
  for the deployed APIM policy. The user accepted this on 2026-09-30 (PLAN.md Q3). It is covered
  by the automated consistency test below plus manual TC-16, TC-17 and TC-13c after redeploy.
- **Test location:** `apps/backend/src/modules/order-ingestion/__tests__/`

## Solution Design

D9: APIM runs **only a shape check**: two ASCII letters, any case, optionally surrounded by space,
tab, CR or LF. There is no ISO list in APIM. The backend (Task 01) checks the real list. The
requirement "APIM must never reject a value the backend accepts" holds because the APIM pattern
uses the same whitespace set and letter class the backend accepts. A new backend unit test reads
both artifacts and proves it for all 249 codes.

APIM's own 400 stays NIMBUS-145's generic body (it does not name the field). The detailed message
from D4 comes from the backend. Values that are two letters but not valid (`XX`, `XK`) pass APIM
and are rejected by Medusa, and APIM passes that 400 through.

After this task, the APIM schemas must be re-registered, following
`issues/NIMBUS-145/artifacts/deployment-instructions.md` section 2. That is a manual Azure step and
is **not** part of the implementor's work. It goes into the handover.

## Edits (verbatim)

### 1. `issues/NIMBUS-145/artifacts/canonical-order-schema.json`

Replace line 45:

```json
        "country": { "type": "string", "minLength": 1 }
```

with:

```json
        "country": {
          "type": "string",
          "pattern": "^[ \\t\\n\\r]*[A-Za-z]{2}[ \\t\\n\\r]*$",
          "description": "Shape check only (NIMBUS-171 D9): two letters, any case, optional surrounding space/tab/CR/LF. The Medusa endpoint checks the value against the officially assigned ISO 3166-1 alpha-2 codes."
        }
```

In the top-level `"description"` string (line 4), change
`Rules JSON Schema cannot express (real-calendar dates, unique lineNumber within an order) are enforced by the Medusa endpoint.`
to
`Rules JSON Schema cannot express (real-calendar dates, unique lineNumber within an order) and the ISO 3166-1 alpha-2 country list are enforced by the Medusa endpoint.`

### 2. `issues/NIMBUS-145/artifacts/canonical-order-schema.xsd`

In the header comment, change the paragraph starting "Rules not expressible in XSD 1.0" to:

```
  Rules not expressible in XSD 1.0 (real-calendar dates, e.g. rejecting 31-02-2026) are enforced by
  the Medusa endpoint. Unique lineNumber within an order is enforced here by xs:unique. The address
  country is a shape check only (NIMBUS-171): the ISO 3166-1 alpha-2 list is checked by Medusa.
```

In `addressType`, change line 56 to:

```xml
      <xs:element name="country" type="countryCode" minOccurs="1"/>
```

Add this simple type directly after the existing `currencyCode` simple type:

```xml
  <!--
    Shape check only (NIMBUS-171 D9): two letters, any case, optional surrounding space, tab, CR or
    LF. XSD patterns are implicitly anchored. The ISO 3166-1 alpha-2 list is checked by Medusa.
  -->
  <xs:simpleType name="countryCode">
    <xs:restriction base="xs:string">
      <xs:pattern value="[ \t\n\r]*[A-Za-z]{2}[ \t\n\r]*"/>
    </xs:restriction>
  </xs:simpleType>
```

### 3. `issues/NIMBUS-145/artifacts/test-payloads.md`

a. In the "**APIM-only cases**" sentence, add `TC-16` to the list.

b. Add a row to the TC-13 table:

```markdown
| c | TC-3's body with `<country>XX</country>` (or JSON `"country": "XX"`) | Medusa `400` passed through, message `Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'XX'` (APIM checks the shape only, NIMBUS-171) |
```

c. Insert two new sections after TC-15 and before `## Summary`:

````markdown
## TC-16: Country that is not a two-letter code (NIMBUS-171)

Send TC-3's body (XML) with `<country>Denmark</country>`, then with `<country>DNK</country>`. Send
the JSON form of TC-3 (the transformed body shown under TC-3, new `externalOrderNumber`) with
`"country": "Denmark"`.

**Expect:** `400` with the generic validation error body. There is no Logic App run.

## TC-17: Lower-case, padded country is accepted (NIMBUS-171)

Send TC-3's body with a new `externalOrderNumber` and `<country> se </country>`.

**Expect:** `201` from Medusa. APIM must not reject a code the backend accepts. The Medusa order's
shipping address has `country_code` `se`. The order's `metadata.canonical_order.shipTo.country` is
`SE`.
````

d. Add two rows to the Summary table, after TC-15:

```markdown
| TC-16 | Country not two letters | both | 400 | No |
| TC-17 | Lower-case padded country | `application/xml` | 201 | Yes |
```

### 4. `issues/NIMBUS-145/artifacts/deployment-instructions.md`

In section "## Source of the contract", the bullet list has a last bullet "Two rules APIM cannot
fully enforce are left to the Medusa endpoint…" with two sub-bullets (lines 37–41). Change
"Two rules" to "Three rules" in that bullet and add this third sub-bullet after the
"Unique `lineNumber`" sub-bullet:

```markdown
  - ISO country codes (NIMBUS-171): APIM checks only that an address `country` is two letters, any
    case, with optional surrounding space/tab/CR/LF. `XX` passes APIM and is rejected by Medusa with
    a 400 that names the field. The ISO 3166-1 alpha-2 list and its exceptions allowlist live only
    in `apps/backend/src/modules/order-ingestion/country-code.ts`. After changing either schema,
    re-register both in APIM (section 2) and run test-payloads TC-16 and TC-17.
```

### 5. `issues/NIMBUS-147/SCOPE.md` (the canonical contract description)

After the bullet that starts "- **`billTo`/`shipTo` are optional, not required.**" (ends at line
60), insert this bullet. Leave everything else in that file unchanged:

```markdown
  - **`country` on `billTo`/`shipTo` (added by NIMBUS-171, 2026-09-30):** must be an officially
    assigned ISO 3166-1 alpha-2 code. Any case and surrounding whitespace are accepted
    (`dk`, `" SE "`). `DNK`, `Denmark`, `XX` and empty values are rejected with the order validation
    400, which names the field (e.g. `shipTo.country`) and the value sent. The accepted value is
    normalized to the trimmed upper-case code in the canonical order and stored lower case on the
    Medusa order address. APIM checks only the two-letter shape. Exceptions (e.g. `XK`) can be
    allowed later in one documented allowlist in
    `apps/backend/src/modules/order-ingestion/country-code.ts`.
```

### 6. New File: `apps/backend/src/modules/order-ingestion/__tests__/apim-country-shape.unit.spec.ts`

Proves that the APIM shape check never rejects a value the backend accepts (SCOPE requirement), and
that it rejects the obvious non-codes.

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";

import { OFFICIAL_ISO_COUNTRY_CODES, isAllowedCountryCode } from "../country-code";

// __tests__ -> order-ingestion -> modules -> src -> backend -> apps -> repo root
const ARTIFACTS_DIR = resolve(
  __dirname,
  "../../../../../../issues/NIMBUS-145/artifacts"
);

type JsonSchemaWithAddress = {
  definitions: {
    address: { properties: { country: { pattern: string } } };
  };
};

function loadJsonSchemaCountryPattern(): RegExp {
  const schema = JSON.parse(
    readFileSync(resolve(ARTIFACTS_DIR, "canonical-order-schema.json"), "utf8")
  ) as JsonSchemaWithAddress;

  return new RegExp(schema.definitions.address.properties.country.pattern);
}

function loadXsdCountryPattern(): RegExp {
  const xsd = readFileSync(
    resolve(ARTIFACTS_DIR, "canonical-order-schema.xsd"),
    "utf8"
  );
  const match =
    /<xs:simpleType name="countryCode">[\s\S]*?<xs:pattern value="([^"]+)"\/>/.exec(
      xsd
    );

  if (!match) {
    throw new Error("countryCode simpleType with a pattern not found in the XSD");
  }

  // XSD patterns are implicitly anchored.
  return new RegExp(`^(?:${match[1]})$`);
}

function variantsOf(code: string): string[] {
  return [
    code,
    code.toLowerCase(),
    `${code[0]}${code[1].toLowerCase()}`,
    ` ${code} `,
    `\t${code.toLowerCase()}\n`,
    `\r\n${code}\r\n`,
  ];
}

describe("APIM country shape check vs backend rule (NIMBUS-171)", () => {
  const patterns = [
    ["JSON Schema", loadJsonSchemaCountryPattern()],
    ["XSD", loadXsdCountryPattern()],
  ] as const;

  it("TC-1: every value the backend accepts passes both APIM shape checks", () => {
    for (const [, pattern] of patterns) {
      for (const code of OFFICIAL_ISO_COUNTRY_CODES) {
        for (const value of variantsOf(code)) {
          expect(isAllowedCountryCode(value)).toBe(true);
          expect(pattern.test(value)).toBe(true);
        }
      }
    }
  });

  it("TC-2: both APIM shape checks reject values that are not two letters", () => {
    for (const [, pattern] of patterns) {
      for (const value of ["Denmark", "DNK", "D", "", "   ", "D1", "D K"]) {
        expect(pattern.test(value)).toBe(false);
      }
    }
  });

  it("TC-3: two-letter non-codes pass APIM and are left to the backend", () => {
    for (const [, pattern] of patterns) {
      for (const value of ["XX", "XK", "uk"]) {
        expect(pattern.test(value)).toBe(true);
        expect(isAllowedCountryCode(value)).toBe(false);
      }
    }
  });
});
```

## Impacted Files

| File | Change |
|------|--------|
| `issues/NIMBUS-145/artifacts/canonical-order-schema.json` | `address.country` pattern + description; top-level description sentence |
| `issues/NIMBUS-145/artifacts/canonical-order-schema.xsd` | New `countryCode` simple type; `addressType/country` uses it; header comment |
| `issues/NIMBUS-145/artifacts/test-payloads.md` | TC-13 row c, new TC-16/TC-17, APIM-only list, summary rows |
| `issues/NIMBUS-145/artifacts/deployment-instructions.md` | One note on the country rule and redeployment |
| `issues/NIMBUS-147/SCOPE.md` | One added bullet on `country` |
| `apps/backend/src/modules/order-ingestion/__tests__/apim-country-shape.unit.spec.ts` | **New.** TC-1 to TC-3 |

`apim-policy.xml` is **not** changed: `validate-content` already references both schemas by id.

## Test Cases

### TC-1: APIM never rejects what the backend accepts
- **Given:** all 249 official codes in upper, lower and mixed case, and padded with space/tab/CR/LF
- **When:** tested against the JSON Schema pattern and the XSD pattern read from the artifacts
- **Then:** the backend accepts every value and both patterns match every value

### TC-2: APIM rejects non-two-letter values
- **Given:** `Denmark`, `DNK`, `D`, `""`, `"   "`, `D1`, `D K`
- **When:** tested against both patterns
- **Then:** no pattern matches

### TC-3: Two-letter non-codes are the backend's job
- **Given:** `XX`, `XK`, `uk`
- **When:** tested
- **Then:** both patterns match and the backend rejects them

### Manual (after APIM redeploy): test-payloads TC-16, TC-17 and TC-13c

## Implementation Steps

1. Apply edits 1 to 5 exactly as written. Keep the JSON valid (run
   `node -e "JSON.parse(require('fs').readFileSync('issues/NIMBUS-145/artifacts/canonical-order-schema.json','utf8'))"`
   from the repo root).
2. Create the new unit test (edit 6).
3. Run `cd apps/backend && pnpm test:unit`.
4. Do **not** deploy to APIM and do not commit. Record in the handover that APIM needs the two
   schemas re-registered (deployment-instructions section 2) and manual TC-16/TC-17/TC-13c.

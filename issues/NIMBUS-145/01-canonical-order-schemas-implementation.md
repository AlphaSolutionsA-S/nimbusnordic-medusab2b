# Task 01: Canonical Order Schemas (JSON Schema + XSD)

**Status:** TODO
**App:** azure-integration
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-145 (from develop)
**Depends on:** NIMBUS-147 (canonical contract)

---

## Context

NIMBUS-145's APIM policy validates incoming payloads against two schemas registered in the APIM
instance:

1. A **JSON Schema** for `application/json` submissions — validates directly against the canonical
   contract.
2. An **XSD** (XML Schema Definition) for `application/xml` / `text/xml` submissions — validates
   against the canonical-mirroring XML representation before `xml-to-json` transforms it.

Both schemas are derived from NIMBUS-147's `CanonicalOrderSchema` (defined in
`issues/NIMBUS-129/02-canonical-order-contract-implementation.md`). The canonical contract's field
list, required/optional flags, and types are the source of truth.

### Field reference (from NIMBUS-129 Task 02)

**Order header:**
- Required: `externalOrderNumber` (string), `orderDate` (string), `currencyCode` (string),
  `lines` (array, min 1 item)
- Optional: `requestedDeliveryDate` (string), `salesperson` (string), `email` (string, email
  format), `phoneNumber` (string), `discountAmount` (number), `discountAppliedBeforeTax`
  (boolean), `pricesIncludeTax` (boolean), `billTo` (object), `shipTo` (object)

**Address (billTo/shipTo, shared shape):**
- Required when present: `name` (string), `addressLine1` (string), `city` (string),
  `postCode` (string), `country` (string)
- Optional: `contact` (string), `addressLine2` (string), `state` (string)

**Order line:**
- Required: `lineNumber` (integer, ≥ 0), `itemNumber` (string), `eanNo` (string),
  `description` (string), `quantity` (number, > 0), `unitPrice` (number, ≥ 0)
- Optional: `custItemNo` (string), `description2` (string), `unitOfMeasureCode` (string),
  `discountPercent` (number, 0–100), `discountAmount` (number), `discountAppliedBeforeTax`
  (boolean), `taxCode` (string), `taxPercent` (number, ≥ 0), `requestedShipmentDate` (string)

**Strict mode:** The Zod schema uses `.strict()` — unknown fields are rejected. The JSON Schema
and XSD must enforce the same constraint (`additionalProperties: false` for JSON; no wildcard
elements for XSD).

## Solution Design

### New File: `issues/NIMBUS-145/artifacts/canonical-order-schema.json`

A JSON Schema (draft 7) that mirrors `CanonicalOrderSchema`. Key mapping decisions:

- `additionalProperties: false` on all object definitions (mirrors Zod `.strict()`).
- `minItems: 1` on the `lines` array (mirrors `z.array(...).min(1)`).
- `type: "integer"` for `lineNumber` (mirrors `z.number().int().nonnegative()`).
- `minimum: 0` for `lineNumber` (mirrors `.nonnegative()`).
- `exclusiveMinimum: 0` for `quantity` (mirrors `.positive()`).
- `minimum: 0` for `unitPrice` (mirrors `.nonnegative()`).
- `minimum: 0`, `maximum: 100` for `discountPercent` (mirrors `.min(0).max(100)`).
- `format: "email"` for the `email` field (mirrors `z.string().email()`).
- `minLength: 1` for required string fields (mirrors `z.string().min(1)`).

### New File: `issues/NIMBUS-145/artifacts/canonical-order-schema.xsd`

An XSD that mirrors the canonical XML representation. Key design decisions:

- **Target namespace:** none (`xmlns=""`) or a project-specific namespace — the implementor
  decides, but it must match what the XML wire format actually uses. If NIMBUS-147's XML
  representation uses no namespace, the XSD should not require one.
- **Element names:** camelCase, matching the JSON property names (e.g. `<externalOrderNumber>`,
  `<orderDate>`, `<lines>`, `<line>`). This is the default assumption; if NIMBUS-147's finalized
  XML uses PascalCase, adjust accordingly.
- **`lines` element:** `minOccurs="1"`, `maxOccurs="unbounded"` on the `<line>` child element —
  ensures at least one line and allows multiple.
- **`billTo`/`shipTo`:** `minOccurs="0"` (optional), and when present, their required child
  elements have `minOccurs="1"`.
- **Strict mode:** no `<xs:any>` wildcard — only declared elements are allowed.
- **Numeric types:** `xs:integer` for `lineNumber`, `xs:decimal` for `quantity`, `unitPrice`,
  `discountAmount`, `discountPercent`, `taxPercent`. Note: `xs:decimal` accepts both dot and
  comma decimal separators in XML, but the `xml-to-json` policy output will use the JSON number
  format — see PLAN.md D8 for decimal comma normalization.

## Code Skeletons

### New File: `issues/NIMBUS-145/artifacts/canonical-order-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CanonicalOrder",
  "description": "Canonical order contract — mirrors NIMBUS-147's CanonicalOrderSchema (Zod).",
  "type": "object",
  "additionalProperties": false,
  "required": ["externalOrderNumber", "orderDate", "currencyCode", "lines"],
  "properties": {
    "externalOrderNumber": { "type": "string", "minLength": 1 },
    "orderDate": { "type": "string", "minLength": 1 },
    "requestedDeliveryDate": { "type": "string" },
    "currencyCode": { "type": "string", "minLength": 1 },
    "salesperson": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "phoneNumber": { "type": "string" },
    "discountAmount": { "type": "number" },
    "discountAppliedBeforeTax": { "type": "boolean" },
    "pricesIncludeTax": { "type": "boolean" },
    "billTo": { "$ref": "#/$defs/address" },
    "shipTo": { "$ref": "#/$defs/address" },
    "lines": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/orderLine" }
    }
  },
  "$defs": {
    "address": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "addressLine1", "city", "postCode", "country"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "contact": { "type": "string" },
        "addressLine1": { "type": "string", "minLength": 1 },
        "addressLine2": { "type": "string" },
        "city": { "type": "string", "minLength": 1 },
        "state": { "type": "string" },
        "postCode": { "type": "string", "minLength": 1 },
        "country": { "type": "string", "minLength": 1 }
      }
    },
    "orderLine": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lineNumber", "itemNumber", "eanNo", "description", "quantity", "unitPrice"],
      "properties": {
        "lineNumber": { "type": "integer", "minimum": 0 },
        "itemNumber": { "type": "string", "minLength": 1 },
        "custItemNo": { "type": "string" },
        "eanNo": { "type": "string", "minLength": 1 },
        "description": { "type": "string", "minLength": 1 },
        "description2": { "type": "string" },
        "unitOfMeasureCode": { "type": "string" },
        "quantity": { "type": "number", "exclusiveMinimum": 0 },
        "unitPrice": { "type": "number", "minimum": 0 },
        "discountPercent": { "type": "number", "minimum": 0, "maximum": 100 },
        "discountAmount": { "type": "number" },
        "discountAppliedBeforeTax": { "type": "boolean" },
        "taxCode": { "type": "string" },
        "taxPercent": { "type": "number", "minimum": 0 },
        "requestedShipmentDate": { "type": "string" }
      }
    }
  }
}
```

### New File: `issues/NIMBUS-145/artifacts/canonical-order-schema.xsd`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           elementFormDefault="qualified">

  <!-- Root element: CanonicalOrder -->
  <xs:element name="canonicalOrder">
    <xs:complexType>
      <xs:all>
        <xs:element name="externalOrderNumber" type="xs:string" minOccurs="1"/>
        <xs:element name="orderDate" type="xs:string" minOccurs="1"/>
        <xs:element name="requestedDeliveryDate" type="xs:string" minOccurs="0"/>
        <xs:element name="currencyCode" type="xs:string" minOccurs="1"/>
        <xs:element name="salesperson" type="xs:string" minOccurs="0"/>
        <xs:element name="email" type="xs:string" minOccurs="0"/>
        <xs:element name="phoneNumber" type="xs:string" minOccurs="0"/>
        <xs:element name="discountAmount" type="xs:decimal" minOccurs="0"/>
        <xs:element name="discountAppliedBeforeTax" type="xs:boolean" minOccurs="0"/>
        <xs:element name="pricesIncludeTax" type="xs:boolean" minOccurs="0"/>
        <xs:element name="billTo" type="addressType" minOccurs="0"/>
        <xs:element name="shipTo" type="addressType" minOccurs="0"/>
        <xs:element name="lines" minOccurs="1">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="line" type="orderLineType"
                          minOccurs="1" maxOccurs="unbounded"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:all>
    </xs:complexType>
  </xs:element>

  <!-- Address type (shared by billTo and shipTo) -->
  <xs:complexType name="addressType">
    <xs:all>
      <xs:element name="name" type="xs:string" minOccurs="1"/>
      <xs:element name="contact" type="xs:string" minOccurs="0"/>
      <xs:element name="addressLine1" type="xs:string" minOccurs="1"/>
      <xs:element name="addressLine2" type="xs:string" minOccurs="0"/>
      <xs:element name="city" type="xs:string" minOccurs="1"/>
      <xs:element name="state" type="xs:string" minOccurs="0"/>
      <xs:element name="postCode" type="xs:string" minOccurs="1"/>
      <xs:element name="country" type="xs:string" minOccurs="1"/>
    </xs:all>
  </xs:complexType>

  <!-- Order line type -->
  <xs:complexType name="orderLineType">
    <xs:all>
      <xs:element name="lineNumber" type="xs:integer" minOccurs="1"/>
      <xs:element name="itemNumber" type="xs:string" minOccurs="1"/>
      <xs:element name="custItemNo" type="xs:string" minOccurs="0"/>
      <xs:element name="eanNo" type="xs:string" minOccurs="1"/>
      <xs:element name="description" type="xs:string" minOccurs="1"/>
      <xs:element name="description2" type="xs:string" minOccurs="0"/>
      <xs:element name="unitOfMeasureCode" type="xs:string" minOccurs="0"/>
      <xs:element name="quantity" type="xs:decimal" minOccurs="1"/>
      <xs:element name="unitPrice" type="xs:decimal" minOccurs="1"/>
      <xs:element name="discountPercent" type="xs:decimal" minOccurs="0"/>
      <xs:element name="discountAmount" type="xs:decimal" minOccurs="0"/>
      <xs:element name="discountAppliedBeforeTax" type="xs:boolean" minOccurs="0"/>
      <xs:element name="taxCode" type="xs:string" minOccurs="0"/>
      <xs:element name="taxPercent" type="xs:decimal" minOccurs="0"/>
      <xs:element name="requestedShipmentDate" type="xs:string" minOccurs="0"/>
    </xs:all>
  </xs:complexType>

</xs:schema>
```

**Note on `xs:all` vs `xs:sequence`:** `xs:all` allows elements in any order, which is more
lenient than `xs:sequence` (which enforces a specific order). The canonical contract does not
mandate field ordering, so `xs:all` is the correct choice. However, `xs:all` has limitations
(`maxOccurs="1"` on all children, no `minOccurs="0"` with `maxOccurs="unbounded"`). The `lines`
element uses `xs:sequence` for its `line` children because `line` needs `maxOccurs="unbounded"`.

## Impacted Files

- **New:** `issues/NIMBUS-145/artifacts/canonical-order-schema.json`
- **New:** `issues/NIMBUS-145/artifacts/canonical-order-schema.xsd`

No existing files are modified. These are reference artifacts for manual upload to the APIM
instance's Schemas section.

## Open Items

- **Verify XML tag naming convention** — if NIMBUS-147's finalized XML uses PascalCase tags
  (e.g. `<ExternalOrderNumber>`) instead of camelCase (e.g. `<externalOrderNumber>`), update the
  XSD element names and the `xml-to-json` `kind` attribute in Task 02 accordingly.
- **Verify XML root element name** — this plan uses `<canonicalOrder>` as the root element. If
  NIMBUS-147's XML representation uses a different root element name (e.g. `<order>` or
  `<Document>`), update the XSD accordingly.
- **Verify JSON Schema draft version** — APIM's `validate-content` supports JSON Schema. The
  exact draft version (draft 4, 6, or 7) depends on the APIM version. Draft 7 is used here as
  the most widely supported; if APIM requires a different draft, adjust the `$schema` URI.
- **Verify `xs:decimal` behavior** — `xs:decimal` in XSD accepts both dot and comma decimal
  separators. If the XML wire format uses comma decimals, the XSD validation will pass, but the
  `xml-to-json` output may produce a string `"209,25"` instead of a number `209.25`. See PLAN.md
  D8 for the decimal comma normalization issue.
- **Reconcile with NIMBUS-147's finalized XML representation** — NIMBUS-147 is scoped but not
  yet implemented. The XSD must match the XML representation NIMBUS-147 actually produces.

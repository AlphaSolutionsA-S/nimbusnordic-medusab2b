# 04: Customer artifacts and architecture doc
**App:** backend (docs) · **Layer:** none (contract artifacts, documentation) · **Depends on:** 02, 03

**Goal:** Klaus has the new JSON Schema, XSD, examples and a release note to publish, and the architecture doc describes the size read, field and cut-off.
**Files / areas:** `issues/NIMBUS-231/artifacts/` (new: `shipment-notice-schema.json`, `shipment-notice-schema.xsd`, `shipment-notices.example.json`, `shipment-notices.example.xml`, `release-note.md`; start from the `issues/NIMBUS-130/artifacts/` files, which stay untouched); `docs/architecture/order-api/shipment-notices.md`
**Seam contracts:** the JSON example equals the backend fixture's envelope (task 02), as in NIMBUS-130; `variant_code` follows `item_number` in line order; JSON Schema: required key, nullable string; XSD: `<xs:element name="variant_code" type="xs:string" minOccurs="0"/>` in `lineType`.
**Test intent:**
- Offline, evidence recorded in the task's Deviations (throwaway scripts, not committed): the JSON example validates against the new JSON Schema (ajv 8 + ajv-formats, as NIMBUS-130 did) and is rejected by the old one; the XML example validates against the new XSD (.NET validator); the XML example is what the NIMBUS-130 policy rendering gives for the JSON example (null size omitted).
- The JSON example deep-equals the backend fixture envelope.
**Done when:** artifacts and doc written; the checks above recorded; the release note says old schemas reject the field, no opt-in or versioning, notices recorded before the release carry null, and APIM and the Logic App need no change (subject to Klaus's deployed-version check).
**Also update:** `docs/architecture/order-api/shipment-notices.md` (second BC read and its request budget, company-name caching, `variant_code`, the cut-off, `variant_missing`, the TRC dependency risk and fallback; state that this doc and `shipment-notice-contract.ts` are the current contract and that `issues/NIMBUS-231/artifacts/` is the copy deployed at this release; "Last updated" and "Related work"); `docs/architecture/order-api/overview.md` only if it lists notice fields (it does not today).

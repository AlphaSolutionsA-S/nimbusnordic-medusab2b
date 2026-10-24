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

## Deviations

- Offline checks (throwaway, in the run scratchpad `task04/`, not committed):
  `validate-json-artifacts.cjs` (ajv 8.17.1 + ajv-formats 2.1.1, fixture loaded through the backend's
  TypeScript transpiler) and `render/` (the NIMBUS-130 harness pattern: `gen.ps1` extracts the
  `shipmentNoticeXml` expression verbatim from `issues/NIMBUS-130/artifacts/apim-policy.xml`,
  compiled against Newtonsoft.Json 13.0.3 under `da-DK`, .NET `XmlSchemaSet`). Red run on the
  unmodified copies: JSON 3 pass / 9 fail, XML 5 pass / 2 fail; green: JSON 12/12, XML 7/7. Logs:
  `task04/json-checks.log`, `task04/render-checks.log`.
- Checks added beyond the intent: the old XSD rejects the new XML example ("invalid child element
  'variant_code'"); the NIMBUS-130 XML example (no size) validates against the new XSD; all-null
  sizes render no `<variant_code>` and stay valid; JSON negative controls (missing key, numeric
  value, unknown line field) and the all-null page; key order (`variant_code` after `item_number`)
  in the example lines and in the schema's `required` and `properties`. Two XML checks ("all-null
  renders no element", "a second `<variant_code>` is rejected") already passed in the red run: the
  first is a property of the unchanged policy, the second was trivially true before the element
  existed; kept as regressions.
- The error schema and error examples were not copied: they do not change. The release note and the
  doc point to the NIMBUS-130 files for them.
- The XSD header comment is unchanged (its null-omission rule already covers `variant_code`).
- Release note adds a timing note not in the done-when: the new XSD accepts responses without the
  element (XML customers can switch early), the new JSON Schema requires the key (JSON customers who
  validate switch at the release).
- Doc additions beyond the Also-update list: a `modules/business-central` row in Components, the
  list of failure codes stored in `last_error` (`bc_error`, `not_returned`, `unpairable` existed but
  were undocumented), and the Data Flow node now says "shipment and line sizes".

## Done-when evidence

- Artifacts written: `issues/NIMBUS-231/artifacts/shipment-notice-schema.json`,
  `shipment-notice-schema.xsd`, `shipment-notices.example.json`, `shipment-notices.example.xml`,
  `release-note.md`; `issues/NIMBUS-130/artifacts/` untouched (`git status` shows no change there).
- JSON example validates against the new JSON Schema: `validate-json-artifacts.cjs` "example valid
  against new schema" PASS.
- Rejected by the old one: "example rejected by NIMBUS-130 schema" and "old schema rejects it for
  variant_code (additionalProperties)" PASS.
- XML example validates against the new XSD: `render` "XML example valid against new XSD" PASS.
- XML example is the NIMBUS-130 policy rendering of the JSON example, null size omitted: "NIMBUS-130
  policy rendering of the JSON example equals the XML example" and "sized lines carry
  `<variant_code>M</variant_code>`, null size omitted" PASS.
- JSON example deep-equals the backend fixture envelope: "example deep-equals backend fixture
  shipmentNoticeEnvelopeExample" PASS (`assert.deepStrictEqual` against
  `__fixtures__/shipment-notice-fixtures.ts`).
- Seam: `variant_code` after `item_number`; JSON Schema required key, nullable string; XSD
  `<xs:element name="variant_code" type="xs:string" minOccurs="0"/>` in `lineType`: the order checks
  PASS; the XSD line is in the artifact verbatim.
- Release note says old schemas reject the field ("Schemas" table), no opt-in or versioning ("What
  changes"), pre-release notices carry null ("Notices recorded before the release"), APIM and Logic
  App need no change subject to Klaus's deployed-version check ("Deployment").
- After deploy (not provable in this task): a sized TestDK shipment shows its size through APIM in
  JSON and XML; listed in the release note's "After deploy".
- Also update `docs/architecture/order-api/shipment-notices.md`: new section "Line size
  (`variant_code`)" (second read, request budget, company-name caching, field, cut-off, failures
  incl. `variant_missing`, TRC risk and fallback); "Where the contract lives" bullet in Key Decisions
  (this doc + `shipment-notice-contract.ts` current, `issues/NIMBUS-231/artifacts/` the deployed
  copy); Last updated 2026-10-24; Related work + NIMBUS-231.
- Also update `docs/architecture/order-api/overview.md`: no change; it lists the route, not notice
  fields (searched `docs/` for `item_number`, notice fields and the failure codes: no other hit).

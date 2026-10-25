# Release note: size on shipment notice lines (NIMBUS-231)

For: Klaus Petersen (publishes the schemas and informs order API customers).

## What changes for customers

- Every line of a shipment notice gains `variant_code`, placed after `item_number`: the size
  (Business Central variant code) of the item shipped on that line, for example `M` or `XL`.
- An item without sizes has `variant_code: null` in JSON; in XML the `<variant_code>` element is
  left out, as for every other null field.
- The value is what Business Central posted on the shipment line, not the size ordered.
- Same endpoint, same URL, same parameters. There is no opt-in and no new version: the field is
  in every response from the release on.

## Notices recorded before the release

They are not back-filled. Every line of such a notice carries `variant_code: null` (JSON) or no
`<variant_code>` element (XML), even for sized items. Production has no shipment notices yet, so
only test data is affected. Adding the size never creates a new or revised notice on its own.

## Schemas

The NIMBUS-130 schemas are closed (no extra fields allowed), so they reject the new field. They
are replaced, not extended:

| File | Change | Old schema against new responses |
|---|---|---|
| `shipment-notice-schema.json` | `variant_code`: required key, string or null | rejects every page with a notice (the key is on every line, even when null) |
| `shipment-notice-schema.xsd` | `<xs:element name="variant_code" type="xs:string" minOccurs="0"/>` in `lineType` | rejects each line that has a size |
| `shipment-notices.example.json`, `.xml` | line `NN-1001` has size `M`, line `NN-2040` has none | — |

Timing: the new XSD also accepts responses without the element, so XML customers can switch
before the release. The new JSON Schema requires the key, so JSON customers who validate must
switch at the release: earlier responses lack the key and fail it.

The error schema (`shipment-notice-error-schema.json`) and the error examples are unchanged; use
the NIMBUS-130 files.

## Deployment

- Medusa: deploy the backend release. No migration, no configuration change.
- Customers and documentation: publish the four files in this folder in place of the NIMBUS-130
  versions.
- APIM and the Logic App: no change, provided the deployed versions match the NIMBUS-130 files.
  Check in the Azure Portal before publishing: the `GET /shipment-notices/{token}` outbound policy
  walks `Properties()` with no field list (`issues/NIMBUS-130/artifacts/apim-policy.xml`), and the
  `shipment-notices` workflow's `Response_Medusa` body is `@body('Get_Shipment_Notices_From_Medusa')`
  (`logic-app-workflow-definition.json`). If either differs, the field may be dropped in XML or JSON.

## After deploy

Ship a sized item in TestDK on an API order and read the notice through APIM in JSON and XML: the
line shows the shipped size. An open shipment notified before the release gets no extra `revised`
notice.

## Checked offline (before release)

- The JSON example validates against the new JSON Schema and is rejected by the NIMBUS-130 one for
  `variant_code`; it equals the backend's test fixture.
- The XML example validates against the new XSD, is rejected by the NIMBUS-130 XSD, and is exactly
  what the NIMBUS-130 APIM policy renders from the JSON example. The NIMBUS-130 XML example (no
  size) still validates against the new XSD.

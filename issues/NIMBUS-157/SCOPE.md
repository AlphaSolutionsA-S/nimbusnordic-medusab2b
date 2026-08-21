# Make company information read-only in the storefront

- **Date:** 2026-08-21
- **Status:** Approved
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-157
- **Project ID:** NIMBUS-157
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-157/
- **Size:** M
- **Area:** Storefront company profile / Admin company detail view
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-08-21T06:30:06Z

## Background

Business Central is the source of truth for the company information synchronized under
NIMBUS-156. Customers can currently encounter storefront editing behavior that implies
company information can be maintained in the portal, even though synchronized changes will
later be replaced.

The existing storefront company profile must instead present company information as
read-only. Administrators may continue editing company information in Medusa, but the Admin
company detail view must clearly warn them which values are managed by Business Central and
that those values are overwritten when a customer from the company logs in.

## Requirements

### Functional

- Apply the storefront changes to the existing company profile page only.
- Allow every authenticated customer linked to a company to view the company's basic
  information.
- Allow only users with the storefront's existing company-admin role or permission to view:
  - spending limit;
  - spending-limit reset frequency;
  - credit limit;
  - blocked status.
- Enforce the restricted financial-field access on the server. Those values must be omitted
  or redacted before company data is returned to a non-admin customer; hiding them only in the
  browser is insufficient.
- Do not add a visible explanation of the role-based field distinction to the storefront UI.
- Display all company fields available to the profile, including the fields introduced or
  populated by NIMBUS-156, subject to the authorization rules above.
- Keep labels visible when company data is missing and display an empty value.
- Remove every company edit button, editable form control, and save action from the
  storefront profile without adding replacement contact guidance or disabled controls.
- Add a persistent warning banner at the top of the Admin company detail page.
- The warning must explain that:
  - Business Central is authoritative for the fields it manages;
  - changes to those fields in Medusa are overwritten from Business Central when a customer
    from the company logs in;
  - Medusa-only fields are preserved by that synchronization.
- Final concise warning copy may be decided during implementation as long as it preserves
  the required meaning.
- Add a label or indicator beside every Business Central-managed field in Admin:
  - name;
  - email;
  - phone;
  - address;
  - city;
  - state;
  - postal code;
  - country;
  - blocked status;
  - credit limit;
  - VAT number;
  - currency.
- Keep Business Central-managed fields editable in Admin. The banner and field indicators
  communicate overwrite risk but do not prevent administrators from making changes.

### Non-Functional

- Authorization must use the existing company-admin role or permission rather than creating
  a parallel role model.
- Restricted financial values must not be exposed to non-admin customers in page payloads,
  serialized server data, or customer-accessible API responses.
- Existing access rules for viewing a linked company's profile must remain intact.
- The read-only profile and Admin warnings must remain usable and understandable across the
  storefront and Admin's supported screen sizes and interaction modes.
- Automated coverage must verify read-only storefront behavior, the company-admin field
  boundary, server-side protection, empty-value presentation, and the Admin warning and field
  indicators.

## Affected Apps

- **storefront** — Convert the existing company profile to a complete read-only view and
  enforce the basic-versus-financial field authorization boundary.
- **backend** — Protect restricted company fields for customer-facing access and extend the
  Admin company detail view with the persistent warning and per-field Business Central
  indicators.

## Proposed Structure

1. Confirm the company profile's complete display-field inventory against the company data
   supplied after NIMBUS-156.
2. Apply server-side authorization to the four company-admin-only fields.
3. Replace the storefront profile's editing experience with read-only field presentation,
   including empty values.
4. Add the Admin warning banner and indicators for the agreed Business Central-managed
   fields while preserving Admin editability.
5. Add focused authorization, storefront, and Admin UI tests and validate both affected apps.

## Open Questions

- None.

## Dependencies

- [NIMBUS-156](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156) must supply the
  synchronized company fields and data before this feature can be completed.
- This feature, not NIMBUS-156, owns the new server-side authorization for financial company
  fields.
- Jira issue [NIMBUS-157](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-157) tracks
  this approved scope.

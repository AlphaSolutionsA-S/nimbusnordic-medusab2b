# NIMBUS-131: Make Business Central Customer Number Available

- **Date:** 2026-07-15
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-131
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-131/
- **Size:** M
- **Area:** Company data and storefront customer/company information
- **Base Branch:** To be determined (current branch: `validate-BC-connection`; likely `develop`)
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-07-15T12:52:03Z

## Background

Business Central customer numbers must be available consistently across the commerce
platform so they can be used whenever an integration with Business Central requires a
customer reference. The value will be maintained manually rather than synchronized from
Business Central.

## Requirements

### Functional
- Allow a Business Central customer number to be manually entered and stored on the backend
  company model.
- Accept only numeric customer numbers when the value is manually entered.
- Make the stored customer number available through relevant backend workflows and APIs.
- Expose the customer number to the storefront customer/company information model when such
  customer information is available.
- Make the customer number available to all intended consumers, including backend processes,
  API consumers, storefront experiences, and future Business Central interactions.

### Non-Functional
- The customer number must remain associated with the correct company.
- Existing company and customer flows must continue to work when no customer number has been
  entered.

## Affected Apps

- **backend** - Store the manually entered customer number on a company and make it available
  to APIs and workflows.
- **storefront** - Include the number in existing customer/company information where that data
  model is present.

## Proposed Structure

1. Extend company data to hold a manually maintained Business Central customer number.
2. Make the value available through the relevant backend API and workflow contracts.
3. Surface the value through storefront customer/company information.
4. Verify the value is available to each consumer without affecting companies that do not have
   one.

## Open Questions

- Confirm the base branch before implementation; `develop` is the current expectation.

## Dependencies

- No related or duplicate Jira issues were found for "customer number".
- The existing Business Central connection work is relevant context but is not a prerequisite
  unless its final integration contract requires this field.
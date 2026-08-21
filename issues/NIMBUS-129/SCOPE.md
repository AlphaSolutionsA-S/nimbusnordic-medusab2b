# Receive Orders Through JSON and XML

- **Date:** 2026-08-21
- **Status:** Scoped
- **Type:** Epic
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-129/
- **Size:** XL
- **Area:** Order API, Medusa backend and admin, Azure APIM and Logic Apps
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-08-21T07:29:30Z

## Background

External B2B customer systems need a secure API for submitting orders without using the
storefront. The current epic and stories describe an XML-only flow through Azure APIM and
Logic Apps to Business Central, but the integration must support equivalent JSON and XML
payloads.

APIM will accept both formats and normalize them to a canonical JSON order contract. The
integration will validate the customer's URL path token, forward the normalized order to
Medusa, create and retain a Medusa order, and then submit it to Business Central. Internal
order operations need visibility into Business Central delivery status and a safe manual
retry action when delivery fails.

## Requirements

### Functional

- Provide a customer-facing APIM endpoint that accepts order submissions as either JSON or
  XML.
- Define a canonical JSON schema aligned with the information required for a Business
  Central order.
- Define an XML representation and mapping to the canonical JSON schema.
- Normalize accepted XML payloads to canonical JSON in APIM before forwarding.
- Continue to use a customer token as a URL path element and validate it through the Logic
  App before forwarding the request.
- Include a company-level API customer identifier in Medusa.
- Match the customer identifier supplied in the normalized payload to the correct Medusa
  company and its Business Central customer number.
- Reject requests with an invalid token, invalid or unsupported payload, unknown customer
  identifier, or other validation failure with a clear response.
- Create and persist a corresponding Medusa order for every accepted submission before
  sending it to Business Central.
- Reject repeated submissions of the same customer order as duplicates and do not create
  another Medusa or Business Central order.
- Send the persisted Medusa order to Business Central and retain the Business Central order
  identifier on successful delivery.
- Return a synchronous response containing the Business Central order identifier when the
  order is created successfully.
- Return a clear validation or integration error when processing fails.
- If Business Central delivery fails after Medusa order creation, retain the Medusa order in
  a visible failed or pending-integration state.
- Add a widget to the Medusa Admin order page that displays Business Central integration
  status and relevant outcome information.
- Allow authorized internal staff to retry a failed Business Central delivery from the
  widget without creating a duplicate Medusa order.

### Non-Functional

- Require HTTPS for all customer and integration traffic.
- Redact customer path tokens from APIM, Logic App, Medusa, proxy, and application logs and
  telemetry.
- Do not expose credentials, internal exception details, or sensitive customer data in API
  responses.
- Validate both JSON and XML against their defined contracts before creating a Medusa order.
- Produce consistent, actionable error responses for authentication, validation, duplicate,
  customer-matching, Medusa, and Business Central failures.
- Preserve failed integration state and diagnostic context needed by authorized operations
  staff without exposing secrets or sensitive payload data.
- Ensure manual retries are safe and cannot create duplicate Business Central orders.

## Affected Apps

- **backend** - Add the canonical order contract, company API customer identifier, inbound
  order workflow and endpoint, Medusa order persistence, duplicate protection, Business
  Central integration state, retry capability, and Admin order-page widget.
- **storefront** - No changes. External customer systems call APIM directly.
- **Azure integration** - Configure APIM to accept JSON and XML and normalize XML to JSON;
  use the Logic App to validate customer path tokens and forward authorized requests.

## Proposed Structure

1. **NIMBUS-144 - Receive normalized order JSON in Medusa**
   - Replace the XML-only endpoint scope with an integration-only Medusa endpoint that
     accepts canonical JSON from the authorized Azure integration flow.
   - Return structured success and error responses.

2. **NIMBUS-145 - Accept JSON and XML orders through APIM**
   - Update APIM scope to accept both content types.
   - Validate the external contract, map XML to canonical JSON, require HTTPS, and redact
     path tokens from logs and telemetry.
   - Perform the XML-to-JSON mapping with the
     [Azure API Management `xml-to-json` policy](https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy).

3. **NIMBUS-146 - Validate customer token and route order**
   - Retain Logic App validation of the customer token supplied in the URL path.
   - Forward only authorized, normalized requests to the Medusa endpoint.
   - Return clear authentication and routing failures.

4. **NIMBUS-147 - Define and validate the canonical order contract**
   - Replace the XML-only parsing scope with a canonical JSON schema and equivalent XML
     mapping.
   - Define the XML representation so NIMBUS-145 can transform it to canonical JSON with the
     [Azure API Management `xml-to-json` policy](https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy).
   - Add the company API customer identifier and match it to the submitted customer.
   - Validate the canonical order and reject duplicate submissions.

5. **NIMBUS-148 - Send the Medusa order to Business Central**
   - Send the persisted order to Business Central.
   - Store the Business Central order identifier and successful integration status.
   - Preserve a failed or pending-integration status when delivery fails.
   - Return the synchronous Business Central identifier or a clear integration error.

6. **NIMBUS-149 - Create and persist the Medusa order**
   - Replace raw-XML-only storage with a real Medusa order and order lines.
   - Associate the order with the matched company and customer context.
   - Store its initial Business Central integration state and normalized source information
     needed for traceability.

7. **NIMBUS-158 - Show Business Central status and retry in Medusa Admin**
   - Add an order-detail widget showing Business Central integration status and outcome.
   - Allow authorized internal staff to retry failed delivery safely without creating a
     duplicate Medusa order.

## Out of Scope

- A storefront page for uploading or submitting JSON or XML.
- Full order-confirmation documents or XML responses; these remain under NIMBUS-130.
- Customer-specific order schemas beyond the canonical JSON contract and its XML mapping.
- Automatic retries of failed Business Central delivery.

## Open Questions

- The implementation planner must confirm the concrete canonical schema fields, duplicate
  key, integration status values, retry authorization, and timeout behavior without changing
  the approved business outcomes.

## Dependencies

- Business Central order API availability, credentials, and agreed field mapping.
- Azure APIM and Logic App environments and deployment ownership.
- Existing Medusa company-to-Business Central customer-number mapping.
- NIMBUS-130 is related follow-on work for returning the full order-confirmation document;
  it is not part of this epic's synchronous submission response.

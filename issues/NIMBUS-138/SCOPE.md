# NIMBUS-138: Create BC connection for return

**Jira:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-138  
**Type:** Story  
**Status at scoping:** Scoping  
**Assignee at scoping:** Klaus Petersen  
**Component:** Customer Portal  
**Parent epic:** NIMBUS-126 - Create return

## Problem statement

An authenticated Customer Portal user needs to request a return for selected lines of a
Business Central sales order. The system must create one corresponding BC sales return
order and its return-order lines, while preserving BC's source-document, pricing,
shipment/invoice, item-tracking, and return-policy rules.

The existing Business Central integration only reads `salesOrders` for the user's company.
It has no write operation or return model. The standard public BC v2.0 API documents
`salesOrders`, `salesOrderLines`, and `salesCreditMemos`, but does not document a
`salesReturnOrders` resource or `salesReturnOrderLines` subresource. A direct REST write
to the requested entity is therefore not an implementation assumption.

## Goals

- Allow an authenticated portal user to create a return request from an eligible,
  company-owned BC sales order.
- Create a BC sales return order and its lines from the verified source order through a
  supported BC integration contract.
- Let the user select only source-order lines and return quantities; derive every other
  commercial field from BC.
- Prevent duplicate BC return orders when a request is retried after a network timeout.
- Return the created BC return-order number/status to the portal so the request has a
  customer-visible outcome.
- Keep Customer Portal and BC authorization boundaries intact: no caller may choose a
  company, customer, product, price, discount, or source document outside their company.

## Non-goals

- Receiving the returned goods, posting the return receipt, posting a credit memo, or
  issuing a payment/refund.
- Editing, cancelling, or deleting an existing BC return order.
- Creating a generic BC sales credit memo instead of a return order.
- Replacing BC's return eligibility, item tracking, dimensions, VAT, pricing, or
  application-to-posted-entry rules with portal logic.
- Admin UI or a return-history/list page, unless needed only to present the immediate
  creation result.

## Current-state findings

- `GET /store/bc-orders` is protected with customer authentication and resolves
  `employee.company.business_central_customer_number` server-side before calling BC.
- `BusinessCentralModuleService` currently gets a client-credentials token and reads
  `${BUSINESS_CENTRAL_DISCOVERY_URL}/salesOrders`; it has no generic write helper,
  company-ID discovery, retry/idempotency handling, or return-specific contract.
- The configured BC base URL includes a tenant, environment, and API version but not a
  company ID. The existing list request can query by `customerNumber`; creating a
  document will need the target BC company GUID exposed by the selected endpoint.
- Microsoft documents `POST /companies({id})/salesOrders` and
  `POST /companies({id})/salesOrders({id})/salesOrderLines`, but these create new sales
  orders, not return orders. The public v2.0 resource URLs for `salesReturnOrder` and
  `salesReturnOrderLine` return 404 from Microsoft Learn.
- BC exposes `salesCreditMemos`, including a link to a posted invoice and a customer
  return reason, but that is not interchangeable with a pre-posting sales return order.

## Required BC capability - delivery gate

Before portal implementation, the BC owner must confirm one of these supported contracts
in the target sandbox and production company:

1. A tenant-published custom API exposes a writable sales return order header and lines,
   including the required BC source-document/application behavior; or
2. Preferably, a tenant AL API/action such as `createReturnFromSalesOrder` accepts a
   source sales order plus requested source-line quantities and creates the complete return
   order inside BC using its supported application logic.

The second option is preferred. It keeps BC-specific copy-document behavior, links to
posted shipments/invoices, item tracking, dimensions, rounding, and validation in BC,
where those rules are authoritative. It must not expose a generic client-controlled
`salesReturnOrders` writer.

The BC contract must provide:

- Target BC company GUID and endpoint metadata.
- App registration permissions and an authorization set that can create return orders but
  does not grant broader unnecessary write access.
- An action request with `sourceSalesOrderId`, selected `{ sourceSalesOrderLineId,
  quantity }` entries, and an idempotency key.
- BC-side validation that the source order/customer/lines are eligible; the requested
  quantity must not exceed remaining returnable quantity after prior returns.
- BC-side derivation of return header, line item, unit of measure, unit price, discounts,
  dimensions, taxes, locations, tracking, and source-document linkage.
- A stable response containing BC return order `id`, `number`, `status`, source order
  reference, and created line identifiers/quantities.
- A deterministic idempotency rule: repeating the same key returns the original result,
  not another return order.
- Customer-safe business validation errors that the portal can map to a clear message.

If BC cannot provide one of these contracts, this story is blocked. Creating a new sales
order or a credit memo through the standard API would not meet the return-order requirement.

## Proposed solution

1. **BC integration spike and contract:** verify the target BC API metadata with the
   configured application credentials, confirm write permissions, and agree the custom
   return action/schema with the BC team. Exercise full, partial, already-returned, and
   invalid return scenarios against a BC sandbox.
2. **Portal request contract:** expose a protected store mutation, for example
   `POST /store/bc-orders/:id/returns`. The strict body contains selected source line IDs,
   positive decimal quantities, and only business fields explicitly approved for the
   return flow (for example, a BC-recognized return-reason ID). It never accepts a BC
   customer/company number, item number, unit price, discount, tax, or arbitrary document
   fields.
3. **Server-side ownership and eligibility:** resolve the authenticated customer's
   company BC number using the existing pattern. Retrieve the source BC order using both
   the requested order ID and server-derived company scope. Retrieve/verify source lines
   server-side before the BC write. Return not-found for cross-company orders to avoid
   existence disclosure.
4. **Idempotent workflow:** validate input and create/reuse a persistent portal return
   request record keyed by a server-generated idempotency key. A Medusa workflow invokes
   the BC return action and records the resulting BC return-order identifiers/status.
   A retry after an ambiguous transport failure must reconcile using the idempotency key
   before issuing another create call.
5. **BC module service:** extend the Business Central module with typed read/write methods
   for source-order verification and the agreed return-action invocation. Keep token use,
   HTTPS host validation, and BC error redaction consistent with the current service.
6. **Storefront flow:** add the return-entry UI from the BC order-detail page once
   NIMBUS-137 supplies source-line detail. It presents eligible lines, allows quantities
   no greater than the server-confirmed returnable amount, submits the protected mutation,
   disables duplicate submission while pending, and shows the BC return-order reference or
   a customer-safe failure.

## Request and response contract

Illustrative portal request; final names depend on the approved BC contract:

```json
{
  "lines": [
    {
      "source_sales_order_line_id": "bc-line-guid",
      "quantity": 2
    }
  ],
  "return_reason_id": "optional-bc-approved-reason-id"
}
```

Server-derived inputs supplied only by the backend to the BC action:

- authenticated customer/company scope;
- verified source sales order ID and customer number;
- server-generated idempotency key;
- verified source-line identity and allowed quantity.

Expected successful response:

```json
{
  "return": {
    "id": "bc-return-order-guid",
    "number": "R-10042",
    "status": "Open",
    "source_sales_order_id": "bc-order-guid",
    "lines": [
      {
        "id": "bc-return-line-guid",
        "source_sales_order_line_id": "bc-line-guid",
        "quantity": 2
      }
    ]
  }
}
```

## UX states

### Eligible order

- Show only lines and quantities returned by the verified BC order-detail data.
- Let the user select at least one line and a positive quantity within the displayed
  returnable amount.
- Clearly display the original order reference and the submitted quantities before submit.

### Pending and success

- Disable repeated submission while the request is in progress.
- On success, show the created BC return-order number and status. Do not imply that a
  refund or credit memo has been posted.

### Ineligible or invalid

- Do not offer the action when BC says the order/line cannot be returned.
- Show customer-safe messages for no remaining returnable quantity, invalid reason,
  ineligible document state, or BC business-rule rejection.

### Failure and retry

- On an uncertain network/BC response, keep the portal request idempotency state and
  reconcile before allowing a new create attempt.
- Never expose BC tokens, customer IDs, internal endpoint URLs, or raw BC exception text.

## Authorization and security constraints

- Require `authenticate("customer", ["session", "bearer"])` for every read/mutation
  route in this flow.
- Derive company/customer authority solely from `req.auth_context` and the Medusa
  employee-company link; do not trust request body or route values for authority.
- Perform ownership and return eligibility checks in workflow/service logic, not in the
  storefront or only in the route.
- Use strict Zod validation at the HTTP boundary: non-empty unique line IDs, bounded
  positive decimal quantities, and a small maximum line count. Reject unknown fields.
- Use a portal-generated idempotency key stored server-side; do not accept a caller-chosen
  key as the sole duplicate-prevention control.
- Enforce HTTPS and the existing Business Central host allowlist. Never log client
  secrets, bearer tokens, full BC responses, or personal/commercial data unnecessarily.
- Map a cross-company source order to not-found and redact unexpected BC errors.

## Acceptance criteria

```gherkin
Feature: Create a Business Central sales return order

  Background:
    Given I am signed in as a customer linked to a company with a BC customer number
    And I am viewing a BC sales order belonging to my company

  Scenario: Create a partial return from selected order lines
    Given BC reports that two units of an order line remain returnable
    When I submit a return for that line with quantity two
    Then one BC sales return order is created through the approved BC return contract
    And it contains a return-order line derived from that source order line
    And I see the created BC return-order number and status

  Scenario: The portal cannot forge commercial or ownership data
    When I submit a customer number, price, discount, item number, or source line from
      another company
    Then the request is rejected or ignored according to the strict contract
    And no BC return order is created for data outside my verified source order

  Scenario: Cross-company order access does not leak information
    Given a BC sales order belongs to another company
    When I attempt to create a return using that order ID
    Then I receive a customer-safe not-found response
    And no return order is created

  Scenario: Quantity cannot exceed the remaining returnable amount
    Given BC reports that one unit remains returnable for a source line
    When I request a return quantity of two
    Then BC rejects the request with a customer-safe validation result
    And no invalid return-order line is created

  Scenario: A retry does not duplicate the BC document
    Given the initial return creation reaches BC but the portal receives an ambiguous failure
    When the request is retried
    Then the portal reconciles the original idempotency key
    And exactly one BC sales return order exists for that portal return request

  Scenario: Return creation does not post financial documents
    When a BC sales return order is created
    Then no return receipt, sales credit memo, payment, or refund is posted by this flow
```

## Technical tasks

### BC prerequisite / spike

- Inspect the target BC sandbox `$metadata` and operations with the application credentials
  to confirm whether a tenant custom return API/action already exists.
- Obtain the target company GUID, endpoint path, authorization scope/permission set, and
  an integration test customer/order suitable for creating and cleaning up returns.
- If absent, have the BC team implement and document the `createReturnFromSalesOrder`
  contract and its idempotency/source-copy behavior.
- Verify full and partial returns, already returned quantities, item tracking, shipment vs.
  invoice linkage, reason handling, and resulting BC document/line fields.

### Backend tasks

- Add typed return contract models and BC service methods after the BC contract is signed
  off; do not invent a `salesReturnOrders` URL.
- Implement a protected store mutation and strict request schema.
- Reuse company resolution from `bc-orders/route.ts`, retrieve the source order and lines
  with company scope, and return not-found for cross-company access.
- Create a Medusa return-request persistence model/module and a mutation workflow that
  provides idempotent BC creation/reconciliation.
- Add integration tests with a mocked BC boundary for authentication, ownership, payload
  rejection, partial quantities, BC validation mapping, and ambiguous retry behavior.

### Storefront tasks

- Extend the NIMBUS-137 BC order-detail view with a return-entry action only after the
  backend and BC contract are available.
- Render only backend-supplied eligible lines and returnable quantities.
- Implement selection, quantity validation, pending/success/error states, and duplicate
  submission prevention.

### Validation tasks

- Run backend unit/integration tests and the relevant workspace typecheck/build.
- Execute the BC sandbox contract tests using a dedicated non-production customer/order.
- Confirm exactly one BC return order/line set for an idempotent retry.
- Confirm no credit memo, refund, or posting action occurs.
- Verify cross-company and unauthenticated requests cannot create or disclose returns.

## Dependencies and risks

- **NIMBUS-137** must provide a secure BC order-detail/source-line view before the portal
  can present a return-entry flow.
- A BC-team-owned writable return contract is mandatory. The public v2.0 API evidence does
  not establish the requested `salesReturnOrders` entity.
- Return eligibility depends on BC configuration and document lifecycle: an open sales
  order, shipped order, and invoiced order may require different source-copy behavior.
- Item tracking, dimensions, locations, and application to posted item entries are BC
  domain rules. Reimplementing them in Medusa would create financial/inventory risk.
- This is a financial/inventory mutation; sandbox verification and a production rollout
  decision are required before enabling it for customers.

## Open questions requiring business/BC decisions

1. Which source states are eligible: open order, partially shipped, fully shipped,
   invoiced, or only a posted shipment/invoice?
2. Can every employee in a company create a return, or must it use an existing approver
   role/workflow?
3. Are partial returns and multiple return requests for the same source line allowed?
4. Is a return reason mandatory, and which BC return-reason IDs are available to the
   customer portal?
5. Does BC require the user to choose a return location, shipping method, or pickup flow?
6. Should the portal show a confirmation only, or also a return-order history/status view?
7. Is the BC team able to expose the preferred custom action, and what is its exact schema,
   idempotency lookup, permissions, and error vocabulary?

## Scoping validation performed

- Confirmed NIMBUS-138 is a Customer Portal story under NIMBUS-126, currently in Scoping.
- Reviewed the implemented BC order-list service and route to establish the existing
  customer authentication and server-derived company-scope pattern.
- Checked Microsoft Learn's BC v2.0 resources: `salesOrders` and `salesOrderLines` are
  writable, while the requested `salesReturnOrder` and `salesReturnOrderLine` resource
  pages are absent; `salesCreditMemos` are documented but represent a different document.
- Applied OWASP access-control, input-validation, data-redaction, and idempotency concerns
  because this feature creates inventory/financial documents in an external system.

## Definition of done

- The target BC custom return contract is verified in sandbox and approved for the target
  environment.
- A company-scoped, idempotent portal workflow creates exactly one BC sales return order
  and correctly derived return-order lines from selected source order lines.
- Unauthorized/cross-company, invalid-quantity, duplicate, and BC-validation cases are
  covered by automated tests.
- The portal shows a customer-safe result and does not post receipts, credit memos, or
  refunds.
- `issues/NIMBUS-138/PROGRESS.md` records the handover to implementation planning.
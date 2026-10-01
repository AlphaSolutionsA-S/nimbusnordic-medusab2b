# Protect company-linked carts from access by cart ID alone

- **Date:** 2026-10-01
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-177
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-177/
- **Size:** M
- **Area:** Medusa Store Cart API and B2B storefront
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-10-01T11:58:13Z

## Description

Allow the B2B storefront to protect company-linked carts when someone knows a cart ID. Today, a cart ID can be used to read or edit an editable cart without signing in.

## Why

Company and order-preparation details should remain available only to the appropriate customer or company members, even if a cart link or ID is disclosed.

## Acceptance criteria

- [ ] A person who is not authorized for a company-linked cart cannot read or change it using its ID.
- [ ] Authorized customers can continue normal cart and checkout flows.
- [ ] Guest cart behavior, if supported, is defined and remains usable.
- [ ] Security tests cover another customer, an anonymous caller, and approved or pending carts.

## Out of scope

- Changing public product, region, or shipping-option discovery APIs.

## Open questions

- Should anonymous carts remain available in this B2B storefront, and when does a cart become company-linked?
- Should other members of the same company be allowed to read or edit a customer's cart?

## Mockups / references

- API security review finding 4 (2026-10-01).

## Technical notes


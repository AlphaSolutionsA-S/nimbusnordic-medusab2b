# Task 03: Extract Checkout Form Strings — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-165 (from develop)
**Depends on:** Task 01 (namespace convention), NIMBUS-163 (translation pattern + message catalogs)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/modules/checkout/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

`apps/storefront/src/modules/checkout/components/contact-details-form/index.tsx` is a **Client
Component** (form with local state) — use `useTranslations`, not `getTranslations`. Exact strings
found during exploration:

- Line 54: `label="Email"` → `Checkout.contactDetails.emailLabel`
- Line 64: `label="Invoice recipient"` → `Checkout.contactDetails.invoiceRecipientLabel`
- Line 72: `label="Cost center"` → `Checkout.contactDetails.costCenterLabel`
- Line 79: `label="Requisition number"` → `Checkout.contactDetails.requisitionNumberLabel`
- Line 86: `label="Door code/goods mark"` → `Checkout.contactDetails.doorCodeLabel`
- Line 94: `label="Notes"` → `Checkout.contactDetails.notesLabel`
- Lines 101–104: `"The note will only appear on the invoice and order confirmation and will not
  be read by the merchant."` → `Checkout.contactDetails.notesHelpText`

Also extract `shipping-address-form/index.tsx` and `billing-address-form/index.tsx` (both use the
`CountrySelect` component with `placeholder = "Country"` as its default — extract that default too,
since it renders user-facing text: `Checkout.addressForm.countryPlaceholder`). These forms use
manual `formData`/`handleChange` state (not react-hook-form), per exploration — do not introduce
react-hook-form as part of this extraction; only change string sources.

**Important — do not touch the checkout/account country-select's `<option>` labels** (`display_name`
from `region.countries`, sourced from Medusa, not hardcoded UI copy) — those are data, not
translatable UI strings, and are explicitly out of scope (product/catalog-sourced content is
excluded from this epic per NIMBUS-159's scope).

## Code Skeletons

### Modified File: `apps/storefront/src/modules/checkout/components/contact-details-form/index.tsx` (excerpt)

```tsx
'use client'
import { useTranslations } from 'next-intl'
// ...existing imports...

export function ContactDetailsForm(/* ...existing props... */) {
  const t = useTranslations('Checkout.contactDetails')
  // ...existing state/handlers unchanged...

  return (
    <form>
      {/* was: label="Email" */}
      <Input label={t('emailLabel')} /* ...other existing props... */ />
      {/* was: label="Invoice recipient" */}
      <Input label={t('invoiceRecipientLabel')} />
      {/* was: label="Cost center" */}
      <Input label={t('costCenterLabel')} />
      {/* was: label="Requisition number" */}
      <Input label={t('requisitionNumberLabel')} />
      {/* was: label="Door code/goods mark" */}
      <Input label={t('doorCodeLabel')} />
      {/* was: label="Notes" */}
      <Textarea label={t('notesLabel')} />
      {/* was: hardcoded help sentence */}
      <p>{t('notesHelpText')}</p>
    </form>
  )
}
```

### Added keys: `apps/storefront/messages/en.json` (merge)

```json
{
  "Checkout": {
    "contactDetails": {
      "emailLabel": "Email",
      "invoiceRecipientLabel": "Invoice recipient",
      "costCenterLabel": "Cost center",
      "requisitionNumberLabel": "Requisition number",
      "doorCodeLabel": "Door code/goods mark",
      "notesLabel": "Notes",
      "notesHelpText": "The note will only appear on the invoice and order confirmation and will not be read by the merchant."
    },
    "addressForm": {
      "countryPlaceholder": "Country"
    }
  }
}
```

> **Worker note:** add the identical `Checkout` block (English content) to all 8 locale files, per
> the same rule as Task 02.

## Impacted Files

- `apps/storefront/src/modules/checkout/components/contact-details-form/index.tsx`: replace all
  hardcoded labels/help text as shown.
- `apps/storefront/src/modules/checkout/components/shipping-address-form/index.tsx`: extract the
  `CountrySelect` `placeholder="Country"` default (and read the full file for any other hardcoded
  strings not caught during exploration, e.g. field labels for street/city/zip).
- `apps/storefront/src/modules/checkout/components/billing-address-form/index.tsx`: same as above.
- `apps/storefront/src/modules/checkout/components/country-select/index.tsx`: change the default
  `placeholder = "Country"` prop value to accept a translated string from the caller instead of a
  hardcoded default (or keep the hardcoded English default as a true fallback only reached if no
  caller passes one — worker's discretion, document which was chosen).
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: add `Checkout` namespace.
- `apps/storefront/src/lib/i18n/extraction-checklist.md`: check off `modules/checkout` (partial —
  this task covers contact details + address forms; payment/review steps may need a follow-up if
  found to have additional hardcoded strings not enumerated here).

## Test Cases

### TC-1: Contact details form renders extracted strings unchanged
- **Given:** the `en` locale is active
- **When:** `ContactDetailsForm` renders
- **Then:** all 6 field labels and the help text match the pre-extraction English content exactly

### TC-2: Address form country select placeholder is translated
- **Given:** the `en` locale is active and no explicit placeholder is passed by the caller
- **When:** `CountrySelect` renders inside `ShippingAddressForm`
- **Then:** the placeholder text matches `Checkout.addressForm.countryPlaceholder`'s English value

### TC-3: Form still functions after extraction (wiring/integration)
- **Given:** a user fills in the contact details form fields
- **When:** the form's existing `handleChange`/`formData` state updates
- **Then:** behavior is identical to before extraction — translation only changes the *label
  source*, not form state or validation logic

## Implementation Steps

1. Read `contact-details-form/index.tsx`, `shipping-address-form/index.tsx`,
   `billing-address-form/index.tsx`, and `country-select/index.tsx` in full to confirm current
   line numbers and catch any hardcoded strings not enumerated above.
2. Apply `useTranslations('Checkout.contactDetails')` / `useTranslations('Checkout.addressForm')`
   and replace each hardcoded string.
3. Add the new keys to all 8 message catalogs with identical English content.
4. Add/update tests for TC-1–TC-3.
5. Manually verify the checkout flow still functions end-to-end in dev (no behavior regression).
6. Update `extraction-checklist.md`.
7. Run `pnpm lint`, `pnpm test`, `pnpm build`.

# NIMBUS-165 String Extraction Checklist

Tracks which module areas have had hardcoded UI strings extracted into translation keys.
Check off each area as its task completes. Do not mark an area done until a full pass of that
folder confirms no remaining hardcoded user-facing strings.

- [x] `modules/layout` (nav, footer, mega-menu) — Task 02 (nav, mega-menu, footer,
      medusa-cta, cart-mismatch-banner)
- [x] `modules/checkout` — all 23 files fully extracted (Task 03: contact-
      details-form, contact-details, shipping-address-form,
      billing-address-form, country-select; Task 05 remainder:
      address-select, billing-address, checkout-totals [reuses
      `Cart.cartTotals`], company-form, company, error-message [no strings —
      pure prop passthrough], payment-button, payment-container [no strings],
      payment-test, payment-wrapper/index [no strings], payment-wrapper/
      stripe-wrapper [only dev-facing thrown Error messages — out of scope],
      payment, promotion-code, review, shipping-address, shipping,
      submit-button [no strings], templates/checkout-form,
      templates/checkout-summary [no strings])
- [x] `modules/account` — all 45 files. Done in Task 05 part 1 (11 files):
      login, register, login-template, account-button, account-nav, overview,
      order-card, previously-purchased/product, profile-card, company-card,
      security-card. Done in Task 05 part 2 (this session, 34 files):
      account-info (dead/unused code, flagged, extracted anyway),
      address-book (composes add/edit-address, no strings of its own),
      address-card/add-address + address-card/edit-address-modal (share the
      `Account.addressCard` namespace — same address-form fields), approval-card
      (Server; reuses `Account.orderCard`'s item-count keys), approval-card-actions
      (Client), approval-requests-admin-list/{approved,pending,rejected}-list
      (all 3 share `Account.approvalRequestsAdminList.noRequestsMessage` — same
      empty state), approval-settings-card, bc-order-card, bc-order-filters
      (BC_ORDER_STATUSES option values ["Open","Draft"] intentionally left
      untranslated — they double as API filter values, treated like the
      existing company-card spending-limit-frequency enum precedent),
      bc-order-overview, bc-order-return, claims-blocks/* (callout, cta, faq,
      image, index, rich-text — verified CMS-sourced (Payload `block.title`/
      `block.content`/`block.label`), no hardcoded UI chrome to extract; faq.tsx's
      "+"/"−" toggle glyphs left as decorative, same precedent as the store
      module's pagination ellipsis), claims-live-preview (no strings, wraps
      claims-page-content), claims-page-content + claims-unavailable (both
      reachable from a Server root AND a Client tree via claims-live-preview —
      use `useTranslations`, not `getTranslations`, per the EmptyCartMessage
      precedent), employees-card/index + employee-wrapper (no strings),
      employees-card/employee (RemoveEmployeePrompt + Employee in one file),
      invite-employee-card, order-overview (reuses
      `Account.pendingCustomerApprovals.emptyHeading`'s "Nothing to see here"),
      pending-customer-approvals, quote-card (reuses `Account.orderCard`'s
      item-count keys), resource-pagination (only decorative "..." — no
      action, same as store pagination), templates/account-layout (pure
      layout wrapper, no strings), templates/bc-order-detail-template (reuses
      several `Account.bcOrderReturn` keys since it renders alongside that
      component on the same order-detail page).
- [x] `modules/cart` (all 14 files: add-note-button, applied-promotions,
      approval-status-banner, cart-button, cart-drawer, cart-to-csv-button,
      cart-totals, empty-cart-message, item-full, item-preview, sign-in-prompt,
      templates/index, templates/items, templates/preview [no strings],
      templates/summary)
- [x] `modules/products` (product-facts, product-preview, product-price,
      product-tabs, product-variants-table, related-products,
      product-actions/mobile-actions + option-select [dead/unused code cluster
      — flagged, not removed]; bulk-table-quantity, image-gallery,
      product-actions/index, product-preview/preview-add-to-cart,
      product-preview/price, product-tabs/accordion, templates/index,
      templates/product-actions-wrapper, templates/product-info have no
      hardcoded UI text; products/components/thumbnail's `alt="Thumbnail"`
      fallback intentionally NOT extracted — it's a shared leaf used from both
      Server and Client Component trees (cart items, product previews) with
      no prop to carry a translated override; adding one is a small API
      change best made deliberately rather than inside a string-extraction
      pass — flagged for follow-up)
- [x] `modules/store`, `modules/categories`, `modules/collections` (all 13
      files: category-breadcrumb, categories/templates, collection-breadcrumb,
      collections/templates, pagination [only decorative "..." — no action],
      refinement-list/category-list, refinement-list/index [no strings],
      refinement-list/options-picker [no strings, values are data],
      refinement-list/search-in-results, refinement-list/sort-products,
      store-breadcrumb, store/templates/index [no strings],
      store/templates/paginated-products; "No products found for this
      category." shared as one `Catalog.noProductsFoundMessage` key across
      category template + paginated-products since it's literally the same
      sentence)
- [x] `modules/common` (delete-button "Remove", prompt-modal "Cancel"/"Continue";
      common/components/cart-totals and common/components/thumbnail extracted
      too, though both are dead/unused code — see NOTE comments in those files;
      button/amount-cell/checkbox/divider/input/line-item-options/
      line-item-price/modal/native-select/radio/localized-client-link have no
      hardcoded UI text — checked, no action needed; icons/ideal.tsx and
      icons/bancontact.tsx have SVG `<title>` accessibility text naming the
      payment brand ("iDEAL icon"/"Bancontact icon") — left untranslated as
      brand-identifier labels, flagged for attention)
- [x] `modules/home` (featured-products/index [no strings], product-rail
      "View all", hero banner alt/eyebrow/heading/subheading/CTA)
- [x] `modules/order` (all 12 files: billing-details, help, item/index [no
      strings], item/item-total-price [no strings], item/item-unit-price
      [dead/unused code — flagged], items/index [no strings], order-details,
      order-summary, payment-details, shipping-details,
      templates/order-completed-template, templates/order-details-template)
- [x] `modules/quotes` (request-quote-confirmation, request-quote-prompt — both
      of the module's 2 files)
- [x] `modules/shipping` (free-shipping-price-nudge — the module's 1 file)
- [x] `modules/skeletons` (verified via grep across all 18 files; only
      skeleton-account-button had a hardcoded string — "Log in", now reusing
      `Account.accountButton.loginLabel`; the other 17 are pure loading
      placeholders with no text)
- [x] `src/app/**/page.tsx`, `src/app/**/layout.tsx` route-level static text (excluding
      `generateMetadata` — that's NIMBUS-168's scope). All 49 `.tsx` files under `src/app/**`
      reviewed. Extracted: `(checkout)/layout.tsx` (reuses `Layout.nav.brandName`),
      `(main)/layout.tsx` (new `Layout.promoBanner`), `(main)/account/@dashboard/layout.tsx`
      (reuses `Account.login.bannerAlt`), `(main)/account/@dashboard/addresses/page.tsx`,
      `approvals/page.tsx`, `company/page.tsx`, `profile/page.tsx`, `orders/page.tsx`,
      `bcorders/page.tsx`, `bcorders/[id]/page.tsx` (reuses
      `Account.bcOrderOverview.errorHeading`), `bctest/page.tsx` (new `BcTest` namespace),
      and the whole `quotes/components/*` tree (`quote-status-badge`, `quote-messages`,
      `quote-table`, `quote-details`, `quotes-overview` [reuses
      `Account.pendingCustomerApprovals.emptyHeading` + `Account.orderOverview
      .continueShoppingLabel`]) plus `quotes/page.tsx`. Reviewed with no hardcoded strings
      (pure wrappers/metadata-only): `(checkout)/checkout/page.tsx`, all 10 `loading.tsx`
      skeleton files, `@dashboard/layout.tsx`'s outer `account/layout.tsx` (dashboard/login
      switch), `@dashboard/page.tsx` (OverviewTemplate), `orders/details/[id]/page.tsx`,
      `quotes/details/[id]/page.tsx`, `account/@login/page.tsx`, `cart/page.tsx`,
      `categories/[...category]/page.tsx`, `collections/[handle]/page.tsx`,
      `order/confirmed/[id]/page.tsx`, `products/[handle]/page.tsx`, `(main)/page.tsx`,
      `[countryCode]/layout.tsx`, root `layout.tsx`, and `claims/page.tsx` (its
      `EMPTY_CLAIMS_PAGE.title = 'Claims'` is a CMS-document data default, not standalone UI
      copy). Flagged, not fixed: `store/page.tsx` has a stray trailing `;\`\`` no-op statement
      (pre-existing, unrelated to strings); root `layout.tsx`'s `<html lang="en">` is hardcoded
      regardless of resolved locale (pre-existing, out of scope for a string-extraction pass).
- [x] `src/app/[countryCode]/not-found.tsx` and other error/boundary pages. Extracted (all
      reachable from a locale-aware layout, confirmed via Next.js's not-found rendering inside
      the nearest matched segment layout): `(main)/not-found.tsx` and `(checkout)/not-found.tsx`
      share one `Common.notFound` namespace (byte-identical copy); `(main)/cart/not-found.tsx`
      reuses `Common.notFound`'s heading/link and adds its own `Cart.notFound.cartMessage`;
      `account/@dashboard/bcorders/[id]/not-found.tsx` adds `Account.bcOrderNotFound` and reuses
      `Account.bcOrderDetailTemplate.backToBcOrdersLabel`. **Exception, left unextracted and
      flagged:** the root `src/app/not-found.tsx` (outside the `[countryCode]` segment) has no
      `NextIntlClientProvider`/locale in its render tree — only `[countryCode]/layout.tsx` wires
      that up — so `useTranslations`/`getTranslations` cannot resolve there without adding a
      default-locale provider at the root, which is an infrastructure change beyond this
      string-extraction pass's scope. Flagged for a deliberate follow-up decision.

Remaining areas beyond the above are extracted in Task 05 as they're found — update this list as
new module folders are discovered.

**Status: full sweep complete.** Every area above is checked off. The manual full-storefront
walkthrough (home, PLP, PDP, cart, checkout, account) in `en` called for in the story's
verification section has still not been performed in any session — see PROGRESS.md.

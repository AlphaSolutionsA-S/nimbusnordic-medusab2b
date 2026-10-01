# Medusa storefront: Nimbus Nordic

App `apps/storefront` (`@b2b-starter/storefront`), Next.js 15.5 App Router, React 19,
`@medusajs/js-sdk` 2.21.0, port 8000.

- The single SDK instance is `src/lib/config.ts`; it needs `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
  (`check-env-variables.js`).
- Canonical data function: `src/lib/data/quotes.ts` (`"use server"`, `sdk.client.fetch` with
  `getAuthHeaders()` and `getCacheOptions()` from `lib/data/cookies.ts`, `revalidateTag`).
- `src/middleware.ts` fetches regions with raw `fetch` (Edge runtime) and sets the
  `X-NEXT-INTL-LOCALE` and `X-STOREFRONT-PATHNAME` headers.
- Payments in checkout: Stripe (`@stripe/react-stripe-js`) and PayPal (`@paypal/react-paypal-js`)
  under `src/modules/checkout/components/payment*`; payment work is always the full pipeline.
- Do not copy: `src/app/[countryCode]/(main)/products/[handle]/page.tsx` (SDK call in the page).

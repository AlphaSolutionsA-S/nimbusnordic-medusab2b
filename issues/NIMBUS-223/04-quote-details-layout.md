# 04: Quote details in two columns
**App:** backend (Admin UI) · **Layer:** Admin UI (`admin/**`) · **Depends on:** 01

**Goal:** Quote details renders `core:two-column` under `quote.details`. Main: quote-accepted notice (an entry only while the quote is accepted), quote (header, items, costs, total, Reject and Send), messages, JSON. Side: customer, company. The quote is passed as the layout's `data`.
**Files / areas:** `src/admin/routes/quotes/[quoteId]/page.tsx`; a new test in `routes/quotes/__tests__/`.
**Seam contracts:** page key from task 01's module.
**Test intent:**
- Accepted quote: main entries are notice, quote, messages, JSON in that order; side entries are customer, company (stand-in attributes).
- Quote not accepted (e.g. `pending_merchant`): no notice entry; Send and Reject shown as today.
- Mock only the SDK boundary for the quote and order-preview reads.
**Done when:** loading and preview handling still happen before the layout; buttons, prompts and links behave as today; `<Toaster />` outside sections; lint passes; typecheck at or below baseline.
**Verify after deploy:** Admin → Quotes → an accepted quote: move Company above Customer in the side column, save, reload → kept; side column 440 px at extra-large width.
**Also update:** none found.

## Deviations
- Added test case "renders no layout while the order preview is loading": guards the done-when clause that loading and preview handling stay before the layout. It passes without the change too (regression guard, not a red test).
- Entry ids chosen: main `quote-accepted`, `quote`, `messages`, `json`; side `customer`, `company`. The task named the entries, not their ids.
- The test's preview mock is a plain `jest.fn()` forwarded from the `lib/client` mock instead of `jest.mocked(sdk.admin.order.retrievePreview)`, so the fixture carries only the fields the page reads without a cast (`NO_UNKNOWN_CAST`).

## Done-when evidence
- Main entries notice, quote, messages, JSON and side entries customer, company under `quote.details`, `core:two-column`: `routes/quotes/__tests__/quote-details-layout.test.tsx` "renders notice, quote, messages and JSON in main and customer, company in side, under quote.details".
- No notice entry when not accepted; Send and Reject shown as today: same file, "has no notice entry and shows Send and Reject when the quote awaits the merchant"; the accepted case asserts neither button is shown and View Order is.
- Loading and preview handling before the layout: same file, "renders no layout while the order preview is loading"; the early returns and the `throw` in `[quoteId]/page.tsx` are unchanged and precede `LayoutComposer`.
- Buttons, prompts and links behave as today: handlers, prompts and `Link` targets moved unchanged into the entries; link hrefs (`/customers/cus_1`, `/companies/comp_1`) asserted in the first test. Prompt flows: browser run (final gate).
- `<Toaster />` outside sections: rendered after `LayoutComposer` in an outer fragment in `[quoteId]/page.tsx` (code read; the stand-in cannot tell sections from siblings beyond `data-layout-section`).
- The quote is passed as `data`: `data={quote}` in `[quoteId]/page.tsx`; the stand-in ignores `data`, so this is checked by review, not test.
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in changed files).
- Typecheck: 22 errors, same set as task 03 (`tsc-04.txt` in the run scratchpad).
- Side column 440 px at extra-large width; saved order kept after reload: not provable in this task: Medusa's layout and settings at runtime (Verify after deploy).
- Also update: none found (task says none; no existing test asserted the quote details markup).

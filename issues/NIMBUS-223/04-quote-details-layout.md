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

# Cart promotion codes

The cart promotion component in `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx`
submits add and remove forms through the returning `submitPromotionForm` server action in
`apps/storefront/src/lib/data/cart.ts`.

Medusa replaces the manual promotion-code list on cart updates. Forms therefore carry all current
manual codes as repeated `applied_code` fields, together with either `code` or `remove_code`.
Automatic promotions are recalculated by Medusa and excluded from this payload. The backend
validates codes and cart access; the client list does not grant authorization.

The action returns `{ success: boolean }` or `null` for an empty add. Failures use the existing
`Checkout.promotionCode.applyErrorMessage` translation instead of exposing server error text.
One React action state is shared by add and remove. The controlled input survives failed actions,
clears after successful add, and retains its draft after removal. Client lists can become stale
across concurrent mutations; this flow does not provide atomic merging of those lists.

Regression coverage lives in the cart data and promotion-code component Jest suites. Production
validation must also exercise invalid codes and multiple-code add/remove against a running backend.

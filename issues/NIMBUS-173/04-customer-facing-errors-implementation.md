# Task 04: Translated customer-facing error messages — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** Task 01 (shared files: `shipping/index.tsx`, `promotion-code/index.tsx`, `quote-details/index.tsx`)
and Task 03 (shared files: `payment/index.tsx`, `messages/*.json`)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build`, plus `npx tsc --noEmit -p tsconfig.json` (baseline 10 errors;
  the `quote-messages.tsx` zod-resolver typing error at l.40 is one of them and stays)
- **Lint command:** `cd apps/storefront && pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test` (baseline: 3 pre-existing failures, see Task 01)
- **Test framework:** Jest + React Testing Library (+ `@testing-library/user-event` is installed)
- **Test location:** `apps/storefront/src/__tests__/…`
- **Conventions:** double quotes, no semicolons. No new logger exists in the storefront; `console.error` is the
  existing server/client error log (see `lib/util/medusa-error.ts`). The repo TS rules allow `console.error`
  for error boundaries; log structured fields and never log PII.

## Solution Design

**Constraint found during planning:** in production builds, Next.js replaces the message of an error
*thrown* from a Server Action with a generic English "An error occurred in the Server Components render…"
text (only a `digest` survives). So `err.message` on the client is never a reliable carrier of
backend text or error codes in production. Only values a Server Action **returns** (the `useActionState`
actions `setContactDetails`, `submitPromotionForm`) keep their text.

Design (decisions 6 and E):

1. **New pure util `src/lib/util/customer-error.ts`** (no `"use server"`, importable from both sides):
   - `CART_NOT_FOUND_ERROR = "CART_NOT_FOUND"`: a stable code thrown or returned by `lib/data/cart.ts` for
     the customer-reachable "no cart" conditions.
   - `getCustomerErrorKey(error: unknown): CustomerErrorKey` → `"cartNotFound"` if the message contains the
     code, otherwise `"generic"`. It uses `includes` because `setShippingAddress` re-wraps errors as
     `new Error(e)` → `"Error: CART_NOT_FOUND"`. In production, thrown codes are replaced by Next.js, so this
     degrades to `"generic"`, which is still translated and still safe.
   - `logCustomerError(context: string, error: unknown): void` → `console.error("[customer-error]", { context, message })`.
     It logs only the message string, never the error object, request data or form data.
2. **New hook `src/lib/hooks/use-customer-error-message.ts`**: `useCustomerErrorMessage()` returns
   `(error: unknown, context: string) => string`. It logs through `logCustomerError` and returns
   `t(getCustomerErrorKey(error))` from `Common.errors`.
3. **Every UI site that shows `err.message` / `e.message`** uses the hook (or, in render paths that show an
   action-state value, `getCustomerErrorKey` + `useTranslations("Common.errors")` without logging, because
   rendering must not log on every re-render).
4. **Specific translated messages where the generic one would lose meaning** (still no per-backend-message mapping):
   - promotion code form → `Checkout.promotionCode.applyErrorMessage`
   - Stripe `confirmCardPayment` errors of type `card_error` / `validation_error` →
     `Checkout.paymentButton.paymentDeclinedMessage` (all other types → generic)
   - profile password update → the existing `Account.profileCard.passwordUpdateErrorToast`
5. **Quote message zod schema:** a factory `createQuoteMessageFormSchema(textRequiredMessage)`, called
   with `t("textRequiredMessage")` inside the component (`useMemo`), so zod's English defaults are never shown.
6. **`lib/data/cart.ts`:** the "no cart" `throw new Error("…")` messages become `CART_NOT_FOUND_ERROR`. Leave
   developer/programming errors unchanged (`Region not found…`, `Missing variant ID…`,
   `Missing lineItem ID…`, `No form data found…`); they surface as the generic message. Backend messages from
   `medusaError` are unchanged (already logged server-side there) and shown as generic on the client.

## Code Skeletons

### New File: `apps/storefront/src/lib/util/customer-error.ts`

```typescript
// Stable code for "the customer's cart could not be resolved". Thrown or
// returned by lib/data/cart.ts; mapped to Common.errors.cartNotFound.
export const CART_NOT_FOUND_ERROR = "CART_NOT_FOUND"

// Keys of the `Common.errors` catalog namespace.
export type CustomerErrorKey = "generic" | "cartNotFound"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === "string" ? error : ""
}

export function getCustomerErrorKey(error: unknown): CustomerErrorKey {
  // IMPLEMENT: return getErrorMessage(error).includes(CART_NOT_FOUND_ERROR) ? "cartNotFound" : "generic"
}

// Diagnostics only — the raw message never reaches the customer. Logs the
// message string alone (no error object, request or form data) to keep PII
// out of the logs.
export function logCustomerError(context: string, error: unknown): void {
  console.error("[customer-error]", { context, message: getErrorMessage(error) })
}
```

### New File: `apps/storefront/src/lib/hooks/use-customer-error-message.ts`

```typescript
import { useTranslations } from "next-intl"

import {
  getCustomerErrorKey,
  logCustomerError,
} from "@/lib/util/customer-error"

// Converts any caught error into a translated, customer-safe message and logs
// the raw message for diagnostics. Use in event handlers / catch callbacks.
export function useCustomerErrorMessage(): (
  error: unknown,
  context: string
) => string {
  const t = useTranslations("Common.errors")

  return (error, context) => {
    logCustomerError(context, error)
    return t(getCustomerErrorKey(error))
  }
}
```

### Modified: `apps/storefront/src/lib/data/cart.ts`

Add `import { CART_NOT_FOUND_ERROR } from "@/lib/util/customer-error"` to the imports (a `"use server"` file
may import constants; it only must not *export* non-async values). Replace **only** these messages with
`throw new Error(CART_NOT_FOUND_ERROR)`:

| Line (develop) | Function | Old message |
|---|---|---|
| 100 | `updateCart` | "No existing cart found, please create one before updating" |
| 134 | `addToCart` | "Error retrieving or creating cart" |
| 170 | `addToCartBulk` | "Error retrieving or creating cart" |
| 214 | `updateLineItem` | "Missing cart ID when updating line item" |
| 239 | `deleteLineItem` | "Missing cart ID when deleting line item" |
| 260 | `emptyCart` | "No existing cart found when emptying cart" |
| 315 | `applyPromotions` | "No existing cart found" |
| 394 | `setShippingAddress` | "No existing cart found when setting addresses" |
| 423 | `setBillingAddress` | "No existing cart found when setting billing address" |
| 454 | `setContactDetails` | "No existing cart found when setting contact details" |
| 478 | `placeOrder` | "No existing cart found when placing an order" |

Do not fix the pre-existing missing `await` on `getCartId()` in `setBillingAddress`/`setContactDetails`
(flag only).

### UI call sites

`const toCustomerMessage = useCustomerErrorMessage()` goes at the top of each listed component
(`import { useCustomerErrorMessage } from "@/lib/hooks/use-customer-error-message"`).

| File | Line (develop) | Old | New |
|---|---|---|---|
| `src/modules/checkout/components/shipping/index.tsx` | 57 | `setError(err.message)` | `setError(toCustomerMessage(err, "checkout.shipping"))` |
| `src/modules/checkout/components/shipping-address/index.tsx` | 52 | `setError(e.message)` | `setError(toCustomerMessage(e, "checkout.shipping-address"))` |
| `src/modules/checkout/components/billing-address/index.tsx` | 64 | `setError(e.message)` | `setError(toCustomerMessage(e, "checkout.billing-address"))` |
| `src/modules/checkout/components/payment/index.tsx` | 113 | `setError(err.message)` | `setError(toCustomerMessage(err, "checkout.payment"))` |
| `src/modules/checkout/components/payment-button/index.tsx` | 120 (`RequestApprovalButton`) | `toast.error(err.message)` | `toast.error(toCustomerMessage(err, "checkout.request-approval"))` |
| same | 187 (`StripePaymentButton`) | `setErrorMessage(err.message)` | `setErrorMessage(toCustomerMessage(err, "checkout.stripe-complete"))` |
| same | 245 (`StripePaymentButton`) | `setErrorMessage(error.message \|\| null)` | see Stripe snippet below |
| same | 295 (`PayPalPaymentButton`) | `setErrorMessage(err.message)` | `setErrorMessage(toCustomerMessage(err, "checkout.paypal-complete"))` |
| same | 314 (`PayPalPaymentButton`) | `` setErrorMessage(`An error occurred, status: ${authorization.status}`) `` | `setErrorMessage(toCustomerMessage(new Error(\`PayPal authorization status: ${authorization.status}\`), "checkout.paypal-authorize"))` |
| same | 320 (`PayPalPaymentButton`) | `` setErrorMessage(`An unknown error occurred, please try again.`) `` | in `.catch((err) => …)`: `setErrorMessage(toCustomerMessage(err, "checkout.paypal-authorize"))` |
| same | 364 (`ManualTestPaymentButton`) | `setErrorMessage(err.message)` | `setErrorMessage(toCustomerMessage(err, "checkout.manual-complete"))` |
| `src/modules/cart/components/cart-to-csv-button/index.tsx` | 48 | `setError(error.message)` | `setError(toCustomerMessage(error, "cart.csv-export"))` (keep the `catch (error: any)` only if it is still needed; `catch (error)` is enough) |
| `src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-details/index.tsx` | 126, 143 | `.catch((e) => toast.error(e.message))` | `.catch((e) => toast.error(toCustomerMessage(e, "quotes.reject")))` / `"quotes.accept"` |
| `src/modules/account/components/profile-card/index.tsx` | 80–82 | `error instanceof Error ? error.message : t("passwordUpdateErrorToast")` | `toast.error(t("passwordUpdateErrorToast"))` plus `logCustomerError("account.password-update", error)` (import from `@/lib/util/customer-error`). Not in BUG.md; same class of defect. |

**Stripe snippet** (`StripePaymentButton`, replace l.245). Reuse the component's existing
`t = useTranslations("Checkout.paymentButton")`, and import `logCustomerError` from `@/lib/util/customer-error`:

```typescript
          if (error.type === "card_error" || error.type === "validation_error") {
            logCustomerError("checkout.stripe-confirm", error.message)
            setErrorMessage(t("paymentDeclinedMessage"))
          } else {
            // toCustomerMessage logs as well
            setErrorMessage(toCustomerMessage(error.message, "checkout.stripe-confirm"))
          }
          return
```

(The existing `return` after `setErrorMessage` stays. The code above replaces both of those lines.)
`PayPalPaymentButton` has no `t` today. Add only the hook there.

**Action-state render sites** (no logging in render):

```tsx
// src/modules/checkout/components/contact-details/index.tsx
const tErrors = useTranslations("Common.errors")
// …
<ErrorMessage
  error={message ? tErrors(getCustomerErrorKey(message)) : null}
  data-testid="address-error-message"
/>

// src/modules/checkout/components/promotion-code/index.tsx (existing t = Checkout.promotionCode)
<ErrorMessage
  error={message ? t("applyErrorMessage") : null}
  data-testid="discount-error-message"
/>
```

In `lib/data/cart.ts`, add `console.error("[customer-error]", { context: "cart.set-contact-details", message: e.message })`
in the `setContactDetails` catch, and `…"cart.submit-promotion"…` in the `submitPromotionForm` catch, before
`return e.message`, so the raw text is logged server-side (message only).

Leave `payment/index.tsx` l.189 (`setError(e.error?.message || null)` from Stripe `CardElement` `onChange`)
unchanged. That is Stripe's own inline card-validation text, localised by Stripe Elements. Flagged in PLAN.md.

### Modified: `src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-messages.tsx`

```typescript
export const createQuoteMessageFormSchema = (textRequiredMessage: string) =>
  z.object({
    text: z.string().min(1, { message: textRequiredMessage }),
    item_id: z.string().nullish(),
  })

// in QuoteMessages, after `const t = useTranslations("Account.quoteMessages")`:
const schema = useMemo(
  () => createQuoteMessageFormSchema(t("textRequiredMessage")),
  [t]
)
// useForm({ defaultValues, resolver: zodResolver(schema) })
```

Remove the old `export const CreateQuoteMessageForm` (its only user is this file, verified by grep).
`useMemo` is already imported.

## Catalog changes

Merge with the Task 02 script and this `CHANGES` object:

```javascript
const CHANGES = {
  en: {
    Common: { errors: {
      generic: "Something went wrong. Please try again.",
      cartNotFound: "We couldn't find your cart. Please refresh the page and try again.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "This code could not be applied. Check the code and try again." },
      paymentButton: { paymentDeclinedMessage: "Your payment could not be completed. Check your payment details or choose another payment method." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Enter a message." } },
  },
  da: {
    Common: { errors: {
      generic: "Noget gik galt. Prøv igen.",
      cartNotFound: "Vi kunne ikke finde din kurv. Genindlæs siden, og prøv igen.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Koden kunne ikke anvendes. Kontrollér koden, og prøv igen." },
      paymentButton: { paymentDeclinedMessage: "Din betaling kunne ikke gennemføres. Kontrollér dine betalingsoplysninger, eller vælg en anden betalingsmetode." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Skriv en besked." } },
  },
  sv: {
    Common: { errors: {
      generic: "Något gick fel. Försök igen.",
      cartNotFound: "Vi kunde inte hitta din varukorg. Ladda om sidan och försök igen.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Koden kunde inte användas. Kontrollera koden och försök igen." },
      paymentButton: { paymentDeclinedMessage: "Betalningen kunde inte genomföras. Kontrollera dina betalningsuppgifter eller välj en annan betalningsmetod." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Skriv ett meddelande." } },
  },
  no: {
    Common: { errors: {
      generic: "Noe gikk galt. Prøv igjen.",
      cartNotFound: "Vi fant ikke handlekurven din. Last inn siden på nytt og prøv igjen.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Koden kunne ikke brukes. Kontroller koden og prøv igjen." },
      paymentButton: { paymentDeclinedMessage: "Betalingen kunne ikke fullføres. Kontroller betalingsopplysningene eller velg en annen betalingsmåte." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Skriv en melding." } },
  },
  pl: {
    Common: { errors: {
      generic: "Coś poszło nie tak. Spróbuj ponownie.",
      cartNotFound: "Nie udało się znaleźć Twojego koszyka. Odśwież stronę i spróbuj ponownie.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Nie można zastosować tego kodu. Sprawdź kod i spróbuj ponownie." },
      paymentButton: { paymentDeclinedMessage: "Nie udało się zrealizować płatności. Sprawdź dane płatności lub wybierz inną metodę płatności." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Wpisz wiadomość." } },
  },
  it: {
    Common: { errors: {
      generic: "Si è verificato un errore. Riprova.",
      cartNotFound: "Non abbiamo trovato il tuo carrello. Ricarica la pagina e riprova.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Impossibile applicare il codice. Controlla il codice e riprova." },
      paymentButton: { paymentDeclinedMessage: "Non è stato possibile completare il pagamento. Controlla i dati di pagamento o scegli un altro metodo di pagamento." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Scrivi un messaggio." } },
  },
  fr: {
    Common: { errors: {
      generic: "Une erreur s'est produite. Veuillez réessayer.",
      cartNotFound: "Nous n'avons pas trouvé votre panier. Actualisez la page et réessayez.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Ce code n'a pas pu être appliqué. Vérifiez le code et réessayez." },
      paymentButton: { paymentDeclinedMessage: "Votre paiement n'a pas pu être effectué. Vérifiez vos informations de paiement ou choisissez un autre moyen de paiement." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Saisissez un message." } },
  },
  de: {
    Common: { errors: {
      generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      cartNotFound: "Ihr Warenkorb wurde nicht gefunden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    } },
    Checkout: {
      promotionCode: { applyErrorMessage: "Dieser Code konnte nicht angewendet werden. Bitte prüfen Sie den Code und versuchen Sie es erneut." },
      paymentButton: { paymentDeclinedMessage: "Ihre Zahlung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zahlungsdaten oder wählen Sie eine andere Zahlungsmethode." },
    },
    Account: { quoteMessages: { textRequiredMessage: "Geben Sie eine Nachricht ein." } },
  },
}
```

## Impacted Files

- New: `src/lib/util/customer-error.ts`, `src/lib/hooks/use-customer-error-message.ts`
- `src/lib/data/cart.ts`: 11 messages → code; 2 `console.error` lines in action catches
- `src/modules/checkout/components/{shipping,shipping-address,billing-address,payment,payment-button,contact-details,promotion-code}/index.tsx`
- `src/modules/cart/components/cart-to-csv-button/index.tsx`
- `src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-details/index.tsx`, `quote-messages.tsx`
- `src/modules/account/components/profile-card/index.tsx`
- `messages/*.json` (8)

After the change, from `apps/storefront`:
`grep -rnE "(err|e|error)\.message\)" src/modules src/app --include=*.tsx` may only list
`payment/index.tsx` (the Stripe `e.error?.message` onChange) and `products/[handle]/page.tsx` (the
`console.error` in `generateStaticParams`).

## Test Cases

### TC-1: getCustomerErrorKey maps the cart code (happy path)
- **Given:** `new Error("CART_NOT_FOUND")`, `new Error("Error: CART_NOT_FOUND")`, the string `"CART_NOT_FOUND"`
- **When:** `getCustomerErrorKey(x)`
- **Then:** `"cartNotFound"` for all three

### TC-2: Everything else is generic (edge)
- **Given:** `new Error("Promotion code X is invalid.")`, `undefined`, `{ foo: 1 }`, the Next production text
  `"An error occurred in the Server Components render."`
- **When:** `getCustomerErrorKey(x)`
- **Then:** `"generic"`

### TC-3: logCustomerError logs only context and message
- **Given:** `jest.spyOn(console, "error").mockImplementation(() => {})` and
  `const err = Object.assign(new Error("boom"), { email: "a@b.c" })`
- **When:** `logCustomerError("checkout.shipping", err)`
- **Then:** called once with `("[customer-error]", { context: "checkout.shipping", message: "boom" })`, and
  `JSON.stringify(spy.mock.calls)` does not contain `"a@b.c"`

### TC-4: Hook returns translated text and logs
- **Given:** `renderHook(() => useCustomerErrorMessage())` (`@testing-library/react`) and a console.error spy
- **When:** `result.current(new Error("raw backend text"), "test")`
- **Then:** returns `"Something went wrong. Please try again."`; the spy was called; for
  `new Error("CART_NOT_FOUND")` it returns `"We couldn't find your cart. Please refresh the page and try again."`

### TC-5: Shipping shows the translated message, not the raw error (wiring)
- **Given:** the `shipping` test mocks, `useSearchParams → new URLSearchParams("step=delivery")`,
  `availableShippingMethods=[{ id: "so_1", name: "Standard", amount: 10 }]`,
  `setShippingMethod` rejecting with `new Error("Shipping option so_1 is invalid.")`, console.error spied
- **When:** the user clicks `getByTestId("delivery-option-radio")`
- **Then:** `await findByTestId("delivery-option-error-message")` has text
  `"Something went wrong. Please try again."` and the document does not contain `"so_1 is invalid"`

### TC-6: Promotion form shows the specific translated message
- **Given:** `submitPromotionForm` mocked so the action state becomes `"The promotion code X is invalid."`.
  Mock `@/lib/data/cart` with `submitPromotionForm: jest.fn(async () => "The promotion code X is invalid.")`
  and `applyPromotions: jest.fn()`
- **When:** the promotion form is submitted (open it via the "Enter Promotion Code" button, type a code, click "Apply")
- **Then:** `findByTestId("discount-error-message")` shows
  `"This code could not be applied. Check the code and try again."`

### TC-7: Quote message form uses the translated validation text
- **Given:** the existing `quote-messages` test setup
- **When:** the user clicks "Send" with an empty message
- **Then:** `await findByText("Enter a message.")`; `createQuoteMessage` was not called

### TC-8: cart.ts throws the stable code when no cart exists
- **Given:** `@/lib/data/cookies` mocked (`getCartId: jest.fn(async () => undefined)`, `getAuthHeaders`,
  `getCacheTag`), plus `@/lib/config` (`sdk: {}`), `next/cache`, `next/navigation`, `@vercel/analytics/server`
  and any other module `cart.ts` imports that fails under Jest (mock them with `jest.fn()` stubs)
- **When:** `await emptyCart()` / `await applyPromotions(["X"])` (with `retrieveCart` returning null, which
  follows from `getCartId` returning undefined)
- **Then:** rejects with `"CART_NOT_FOUND"`

### TC-9: Existing tests still pass
- **Given:** existing `payment-button`, `billing-address`, `shipping-address`, `contact-details`,
  `promotion-code`, `cart-to-csv-button`, `quote-details`, `profile-card` tests
- **When:** `pnpm test`
- **Then:** only the 3 baseline failures remain

## Test Scaffolds

### New File: `src/__tests__/lib/util/customer-error.test.ts`

```typescript
import {
  CART_NOT_FOUND_ERROR,
  getCustomerErrorKey,
  logCustomerError,
} from "@/lib/util/customer-error"

describe("getCustomerErrorKey", () => {
  it.each([
    new Error(CART_NOT_FOUND_ERROR),
    new Error(`Error: ${CART_NOT_FOUND_ERROR}`),
    CART_NOT_FOUND_ERROR,
  ])("maps %p to cartNotFound (TC-1)", (error) => {
    expect(getCustomerErrorKey(error)).toBe("cartNotFound")
  })

  it.each([
    new Error("Promotion code X is invalid."),
    undefined,
    { foo: 1 },
    new Error("An error occurred in the Server Components render."),
  ])("maps %p to generic (TC-2)", (error) => {
    // IMPLEMENT
  })
})

describe("logCustomerError", () => {
  it("logs only context and message (TC-3)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    // IMPLEMENT
    spy.mockRestore()
  })
})
```

### New File: `src/__tests__/lib/hooks/use-customer-error-message.test.ts` (TC-4)

```typescript
import { renderHook } from "@testing-library/react"

import { useCustomerErrorMessage } from "@/lib/hooks/use-customer-error-message"

describe("useCustomerErrorMessage", () => {
  it("returns translated text and logs the raw message (TC-4)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    const { result } = renderHook(() => useCustomerErrorMessage())
    // IMPLEMENT
    spy.mockRestore()
  })
})
```

### Extend: `src/__tests__/modules/checkout/components/shipping/index.test.tsx` (TC-5)

```tsx
import userEvent from "@testing-library/user-event"
import { setShippingMethod } from "@/lib/data/cart"

it("shows a translated error instead of the raw backend message (TC-5)", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("step=delivery"))
  ;(setShippingMethod as jest.Mock).mockRejectedValueOnce(
    new Error("Shipping option so_1 is invalid.")
  )
  const cart = { id: "cart_1", shipping_methods: [], currency_code: "usd" } as unknown as B2BCart
  render(
    <Shipping
      cart={cart}
      availableShippingMethods={[{ id: "so_1", name: "Standard", amount: 10 } as any]}
    />
  )
  // IMPLEMENT: await userEvent.click(screen.getByTestId("delivery-option-radio"))
  // IMPLEMENT: expect(await screen.findByTestId("delivery-option-error-message")).toHaveTextContent("Something went wrong. Please try again.")
  // IMPLEMENT: expect(screen.queryByText(/so_1 is invalid/)).not.toBeInTheDocument()
})
```

### Extend: `src/__tests__/app/quote-messages.test.tsx` (TC-7), `…/promotion-code/index.test.tsx` (TC-6)

Follow the existing file setup. Use `userEvent` for clicks and typing.

### New File: `src/__tests__/lib/data/cart.test.ts` (TC-8)

Look at `src/__tests__/lib/data/customer.test.ts` and `business-central.test.ts` for how this repo mocks `sdk`
and the cookie helpers for a `"use server"` data module, and copy that setup.

## Implementation Steps

1. Create `customer-error.ts` and `use-customer-error-message.ts`.
2. Run the catalog merge with the `CHANGES` above.
3. Update `lib/data/cart.ts` (11 messages + 2 log lines).
4. Update the UI call sites table, the action-state render sites, and the quote schema.
5. Run the grep check from "Impacted Files".
6. Add the tests (TC-1…TC-8). `pnpm test`: only the 3 baseline failures.
7. `npx tsc --noEmit -p tsconfig.json`: no new errors. `pnpm lint`: no new errors.

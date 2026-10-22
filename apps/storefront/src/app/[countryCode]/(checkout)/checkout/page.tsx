import { lookupCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import CartUnavailableNotice from "@/modules/cart/components/cart-unavailable-notice"
import Wrapper from "@/modules/checkout/components/payment-wrapper"
import CheckoutForm from "@/modules/checkout/templates/checkout-form"
import CheckoutSummary from "@/modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.checkout")

  return {
    title: t("title"),
  }
}

export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const cartId = (await searchParams).cartId as string
  const lookup = await lookupCart(cartId)

  if (lookup.status === "unavailable") {
    return (
      <div className="content-container py-24">
        <CartUnavailableNotice />
      </div>
    )
  }

  if (lookup.status !== "found") {
    return notFound()
  }

  const cart = lookup.cart
  const customer = await retrieveCustomer()

  return (
    <Wrapper cart={cart}>
      <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-2 py-24 h-full">
        <CheckoutForm cart={cart} customer={customer} />
        <div className="relative">
          <CheckoutSummary cart={cart} />
        </div>
      </div>
    </Wrapper>
  )
}

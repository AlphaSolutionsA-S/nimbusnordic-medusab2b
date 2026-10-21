import { CartProvider } from "@/lib/context/cart-context"
import { lookupCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import CartUnavailableNotice from "@/modules/cart/components/cart-unavailable-notice"
import CartTemplate from "@/modules/cart/templates"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.cart")

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function Cart() {
  const lookup = await lookupCart()

  if (lookup.status === "unavailable") {
    return (
      <div className="small:py-12 py-6 bg-neutral-100">
        <div className="content-container">
          <CartUnavailableNotice />
        </div>
      </div>
    )
  }

  const cart = lookup.status === "found" ? lookup.cart : null
  const customer = await retrieveCustomer()

  return (
    <CartProvider cart={cart}>
      <CartTemplate customer={customer} />
    </CartProvider>
  )
}

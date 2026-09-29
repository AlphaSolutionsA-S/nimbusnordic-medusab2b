import { CartProvider } from "@/lib/context/cart-context"
import { retrieveCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
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
  const cart = await retrieveCart().catch(() => null)
  const customer = await retrieveCustomer()

  return (
    <CartProvider cart={cart}>
      <CartTemplate customer={customer} />
    </CartProvider>
  )
}

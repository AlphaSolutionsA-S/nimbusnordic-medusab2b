import { retrieveCart } from "@/lib/data/cart"
import { getCountryLanguageSnapshot } from "@/lib/data/country-languages"
import { listCartFreeShippingPrices } from "@/lib/data/fulfillment"
import { getBaseURL } from "@/lib/util/env"
import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"
import FreeShippingPriceNudge from "@/modules/shipping/components/free-shipping-price-nudge"
import { StoreFreeShippingPrice } from "@/types/shipping-option/http"
import { ArrowUpRightMini, ExclamationCircleSolid } from "@medusajs/icons"
import { StoreCart } from "@medusajs/types"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const t = await getTranslations("Layout.promoBanner")
  const cart = await retrieveCart()
  // The request's snapshot, shared with the request config and the country layout.
  const countryLanguages = await getCountryLanguageSnapshot()
  let freeShippingPrices: StoreFreeShippingPrice[] = []

  if (cart) {
    freeShippingPrices = await listCartFreeShippingPrices(cart.id)
  }

  return (
    <>
      <NavigationHeader countryLanguages={countryLanguages} />

      {props.children}

      <Footer countryLanguages={countryLanguages} />

      {cart && freeShippingPrices && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart as StoreCart}
          freeShippingPrices={freeShippingPrices}
        />
      )}
    </>
  )
}

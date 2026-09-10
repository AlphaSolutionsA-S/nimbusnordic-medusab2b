import { retrieveCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import { listRegions } from "@/lib/data/regions"
import AccountButton from "@/modules/account/components/account-button"
import CartButton from "@/modules/cart/components/cart-button"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import FilePlus from "@/modules/common/icons/file-plus"
import { MegaMenuWrapper } from "@/modules/layout/components/mega-menu"
import { RegionSwitcher } from "@/modules/layout/components/region-switcher"
import { RequestQuoteConfirmation } from "@/modules/quotes/components/request-quote-confirmation"
import { RequestQuotePrompt } from "@/modules/quotes/components/request-quote-prompt"
import SkeletonAccountButton from "@/modules/skeletons/components/skeleton-account-button"
import SkeletonCartButton from "@/modules/skeletons/components/skeleton-cart-button"
import SkeletonMegaMenu from "@/modules/skeletons/components/skeleton-mega-menu"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { Suspense } from "react"

export async function NavigationHeader() {
  const t = await getTranslations("Layout.nav")
  const customer = await retrieveCustomer().catch(() => null)
  const cart = await retrieveCart()
  const regions = await listRegions()
  const regionOptions = regions.flatMap((region) =>
    (region.countries ?? []).map((country) => ({
      countryCode: country.iso_2 ?? "",
      countryName: country.display_name ?? country.iso_2 ?? "",
    }))
  )

  return (
    <div className="sticky inset-x-0 top-0 z-50 group border-b border-zinc-300 bg-[#f5f4ef] py-3 text-sm text-zinc-900 duration-200 small:py-5">
      <header className="flex w-full content-container relative small:mx-auto justify-between">
        <div className="small:mx-auto flex justify-between items-center min-w-full">
          <div className="flex items-center small:space-x-4">
            <LocalizedClientLink
              className="flex w-fit items-center hover:text-ui-fg-base"
              href="/"
            >
              <h1 className="flex items-center">
                <Image
                  src="/nimbus-logo.png"
                  alt="Nimbus"
                  width={572}
                  height={487}
                  className="h-10 w-auto small:h-12"
                  priority
                />
              </h1>
            </LocalizedClientLink>

            <nav>
              <ul className="space-x-4 hidden small:flex">
                <li>
                  <Suspense fallback={<SkeletonMegaMenu />}>
                    <MegaMenuWrapper />
                  </Suspense>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex justify-end items-center gap-2">
            <RegionSwitcher options={regionOptions} />

            <div className="relative mr-2 hidden small:inline-flex">
              <input
                disabled
                type="text"
                placeholder={t("searchPlaceholder")}
                className="hidden border border-zinc-300 bg-transparent px-4 py-2 pr-10 text-zinc-900 shadow-none hover:cursor-not-allowed small:inline-block"
                title={t("searchDisabledTooltip")}
              />
            </div>

            <div className="h-4 w-px bg-neutral-300" />

            {customer && cart?.items && cart.items.length > 0 ? (
              <RequestQuoteConfirmation>
                <button
                  className="flex items-center gap-1.5 border border-transparent px-2 py-1 uppercase tracking-[0.1em] hover:border-zinc-300"
                  // disabled={isPendingApproval}
                >
                  <FilePlus />
                  <span className="hidden small:inline-block">
                    {t("quoteLabel")}
                  </span>
                </button>
              </RequestQuoteConfirmation>
            ) : (
              <RequestQuotePrompt>
                <button className="flex items-center gap-1.5 border border-transparent px-2 py-1 uppercase tracking-[0.1em] hover:border-zinc-300">
                  <FilePlus />
                  <span className="hidden small:inline-block">
                    {t("quoteLabel")}
                  </span>
                </button>
              </RequestQuotePrompt>
            )}

            <Suspense fallback={<SkeletonAccountButton />}>
              <AccountButton customer={customer} />
            </Suspense>

            <Suspense fallback={<SkeletonCartButton />}>
              <CartButton />
            </Suspense>
          </div>
        </div>
      </header>
    </div>
  )
}

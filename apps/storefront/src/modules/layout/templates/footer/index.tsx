import { listRegions } from "@/lib/data/regions"
import { Text } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

import { RegionSwitcher } from "@/modules/layout/components/region-switcher"

export default async function Footer() {
  const t = await getTranslations("Layout.footer")
  const regions = await listRegions()
  const regionOptions = regions.flatMap((region) =>
    (region.countries ?? []).map((country) => ({
      countryCode: country.iso_2 ?? "",
      countryName: country.display_name ?? country.iso_2 ?? "",
    }))
  )

  return (
    <footer className="storefront-footer w-full border-t border-zinc-300 bg-[#f5f4ef] text-zinc-900">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-4 py-16 max-w-xl small:py-20">
          <h2 className="txt-compact-xlarge-plus uppercase tracking-[0.16em]">
            {t("aboutHeading")}
          </h2>
          <Text className="txt-medium text-zinc-700">{t("aboutCopy")}</Text>
        </div>
        <div className="mb-8 flex items-center gap-x-6 border-t border-zinc-300 pt-6 text-zinc-600">
          <RegionSwitcher options={regionOptions} />
          <Text className="txt-compact-small">{t("siteTagline")}</Text>
        </div>
      </div>
    </footer>
  )
}

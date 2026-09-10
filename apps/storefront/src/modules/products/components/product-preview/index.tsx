import { getProductPrice } from "@/lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { Text, clx } from "@medusajs/ui"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getTranslations } from "next-intl/server"
import Thumbnail from "../thumbnail"
import PreviewAddToCart from "./preview-add-to-cart"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  if (!product) {
    return null
  }

  const t = await getTranslations("Products.preview")
  const { cheapestPrice } = getProductPrice({
    product,
  })

  const inventoryQuantity = product.variants?.reduce((acc, variant) => {
    return acc + (variant?.inventory_quantity || 0)
  }, 0)

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div
        data-testid="product-wrapper"
        className="relative flex aspect-[3/5] w-full flex-col gap-4 overflow-hidden border border-transparent bg-neutral-100 p-5 transition-colors duration-200 ease-in-out group-hover:border-zinc-400"
      >
        <div className="h-full w-full p-8">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="square"
            isFeatured={isFeatured}
          />
        </div>
        <div className="flex flex-col text-sm">
          <Text className="text-xs uppercase tracking-[0.14em] text-neutral-500">
            {t("brandLabel")}
          </Text>
          <Text className="text-ui-fg-base" data-testid="product-title">
            {product.title}
          </Text>
        </div>
        <div className="flex flex-col gap-0">
          {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          <Text className="text-[0.6rem] uppercase tracking-[0.12em] text-neutral-500">
            {t("exclVatLabel")}
          </Text>
        </div>
        <div className="flex justify-between">
          <div className="flex flex-row gap-1 items-center">
            <span
              className={clx({
                "text-green-500": inventoryQuantity && inventoryQuantity > 50,
                "text-orange-500":
                  inventoryQuantity &&
                  inventoryQuantity <= 50 &&
                  inventoryQuantity > 0,
                "text-red-500": inventoryQuantity === 0,
              })}
            >
              •
            </span>
            <Text className="text-xs text-neutral-500">
              {t("leftLabel", { count: inventoryQuantity ?? 0 })}
            </Text>
          </div>
          <PreviewAddToCart product={product} region={region} />
        </div>
      </div>
    </LocalizedClientLink>
  )
}

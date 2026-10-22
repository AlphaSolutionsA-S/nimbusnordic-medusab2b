import InteractiveLink from "@/modules/common/components/interactive-link"
import { Heading, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"

// Shown where a cart was expected but the backend refused it (for example a
// cart cookie left by another account). Adding a product starts a new cart.
const CartUnavailableNotice = () => {
  const t = useTranslations("Cart.unavailableNotice")

  return (
    <div
      className="py-48 px-2 flex flex-col justify-center items-start"
      data-testid="cart-unavailable-notice"
    >
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        {t("heading")}
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        {t("message")}
      </Text>
      <div>
        <InteractiveLink href="/store">
          {t("exploreProductsLabel")}
        </InteractiveLink>
      </div>
    </div>
  )
}

export default CartUnavailableNotice

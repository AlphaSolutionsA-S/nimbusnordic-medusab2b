import { HttpTypes } from "@medusajs/types"
import { Badge, Container, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"

const AppliedPromotions = ({
  promotions,
}: {
  promotions: HttpTypes.StorePromotion[]
}) => {
  const t = useTranslations("Cart.appliedPromotions")

  return (
    <Container className="flex gap-2 items-center py-3 flex-wrap">
      <Text>{t("label")}</Text>
      {promotions?.map((promotion) => (
        <Badge
          key={promotion.id}
          color={promotion.is_automatic ? "green" : "blue"}
          className="font-mono text-[0.7rem] p-1 py-px h-fit"
        >
          {promotion.code}
        </Badge>
      ))}
    </Container>
  )
}

export default AppliedPromotions

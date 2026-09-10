import { Badge } from "@medusajs/ui"
import { useTranslations } from "next-intl"

const PaymentTest = ({ className }: { className?: string }) => {
  const t = useTranslations("Checkout.paymentTest")

  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">{t("attentionLabel")}</span>{" "}
      {t("testingOnlyMessage")}
    </Badge>
  )
}

export default PaymentTest

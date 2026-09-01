import ApprovalCard from "@/modules/account/components/approval-card"
import { Text } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

const PendingCustomerApprovals = async ({
  cartsWithApprovals,
}: {
  cartsWithApprovals: any[]
}) => {
  const t = await getTranslations("Account.pendingCustomerApprovals")

  if (cartsWithApprovals.length) {
    return (
      <div className="flex flex-col gap-y-2 w-full">
        {cartsWithApprovals.map((cart) => (
          <ApprovalCard
            key={cart.id}
            cartWithApprovals={cart}
            type="customer"
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="w-full flex flex-col items-center gap-y-4"
      data-testid="no-approvals-container"
    >
      <Text className="text-large-semi">{t("emptyHeading")}</Text>
      <Text className="text-base-regular">{t("emptyMessage")}</Text>
    </div>
  )
}

export default PendingCustomerApprovals

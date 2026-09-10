import BcOrderCard from "@/modules/account/components/bc-order-card"
import ResourcePagination from "@/modules/account/components/resource-pagination"
import type { BCOrderListResponse } from "@/types/bc-order"
import { getTranslations } from "next-intl/server"

type BcOrderOverviewProps = {
  result: BCOrderListResponse | null
  error: boolean
  currentPage: number
  limit: number
}

const BcOrderOverview = async ({
  result,
  error,
  currentPage,
  limit,
}: BcOrderOverviewProps) => {
  const t = await getTranslations("Account.bcOrderOverview")

  if (error) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-orders-error"
      >
        <h2 className="text-large-semi">{t("errorHeading")}</h2>
        <p className="text-base-regular text-neutral-500">
          {t("errorMessage")}
        </p>
        <a
          href=""
          className="text-sm text-neutral-900 underline"
          data-testid="bc-orders-try-again"
        >
          {t("tryAgainLabel")}
        </a>
      </div>
    )
  }

  if (!result || result.orders.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-orders-empty"
      >
        <h2 className="text-large-semi">{t("emptyHeading")}</h2>
        <p className="text-base-regular text-neutral-500">
          {t("emptyMessage")}
        </p>
      </div>
    )
  }

  const totalPages = Math.ceil(result.count / limit)

  return (
    <div className="flex flex-col gap-y-4 w-full" data-testid="bc-orders-list">
      {result.orders.map((order) => (
        <BcOrderCard key={order.id} order={order} />
      ))}
      {totalPages > 1 && (
        <ResourcePagination
          totalPages={totalPages}
          currentPage={currentPage}
          pageParam="page"
        />
      )}
    </div>
  )
}

export default BcOrderOverview

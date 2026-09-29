import BcReturnCard from "@/modules/account/components/bc-return-card"
import ResourcePagination from "@/modules/account/components/resource-pagination"
import type { BCReturnListResponse } from "@/types/bc-order"
import { getTranslations } from "next-intl/server"

type BcReturnOverviewProps = {
  result: BCReturnListResponse | null
  error: boolean
  currentPage: number
  limit: number
}

const BcReturnOverview = async ({
  result,
  error,
  currentPage,
  limit,
}: BcReturnOverviewProps) => {
  const t = await getTranslations("Account.bcReturnOverview")

  if (error) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-returns-error"
      >
        <h2 className="text-large-semi">{t("errorHeading")}</h2>
        <p className="text-base-regular text-neutral-500">
          {t("errorMessage")}
        </p>
        <a
          href=""
          className="text-sm text-neutral-900 underline"
          data-testid="bc-returns-try-again"
        >
          {t("tryAgainLabel")}
        </a>
      </div>
    )
  }

  if (!result || result.returns.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-returns-empty"
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
    <div className="flex flex-col gap-y-4 w-full" data-testid="bc-returns-list">
      {result.returns.map((item) => (
        <BcReturnCard key={item.id} item={item} />
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

export default BcReturnOverview

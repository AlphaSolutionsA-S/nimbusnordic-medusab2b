import { listBCReturns } from "@/lib/data/business-central"
import BcReturnFilters from "@/modules/account/components/bc-return-filters"
import BcReturnOverview from "@/modules/account/components/bc-return-overview"
import type { BCReturnListResponse } from "@/types/bc-order"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const metadata: Metadata = {
  title: "Returns",
  description: "Company-wide Business Central return history.",
}

const LIMIT = 20

export default async function Returns({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
    date_from?: string
    date_to?: string
    search?: string
  }>
}) {
  const t = await getTranslations("Account.bcReturnsPage")
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1)
  const offset = (currentPage - 1) * LIMIT
  const { status, date_from, date_to, search } = params

  let result: BCReturnListResponse | null = null
  let hasError = false

  try {
    result = await listBCReturns({
      limit: LIMIT,
      offset,
      status,
      date_from,
      date_to,
      search,
    })
  } catch {
    hasError = true
  }

  return (
    <div
      className="w-full flex flex-col gap-y-4"
      data-testid="bc-returns-page-wrapper"
    >
      <div className="mb-4">
        <Heading>{t("heading")}</Heading>
      </div>
      <BcReturnFilters
        currentStatus={status}
        currentDateFrom={date_from}
        currentDateTo={date_to}
        currentSearch={search}
      />
      <BcReturnOverview
        result={result}
        error={hasError}
        currentPage={currentPage}
        limit={LIMIT}
      />
    </div>
  )
}

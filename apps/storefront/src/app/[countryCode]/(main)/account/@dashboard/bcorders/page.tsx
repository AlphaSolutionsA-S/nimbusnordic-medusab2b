import { listBCOrders } from "@/lib/data/business-central"
import BcOrderFilters from "@/modules/account/components/bc-order-filters"
import BcOrderOverview from "@/modules/account/components/bc-order-overview"
import type { BCOrderListResponse } from "@/types/bc-order"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "BC Orders",
  description: "Company-wide Business Central order history.",
}

const LIMIT = 20

export default async function BCOrders({
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
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1)
  const offset = (currentPage - 1) * LIMIT
  const { status, date_from, date_to, search } = params

  let result: BCOrderListResponse | null = null
  let hasError = false

  try {
    result = await listBCOrders({
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
      data-testid="bc-orders-page-wrapper"
    >
      <div className="mb-4">
        <Heading>BC Orders</Heading>
      </div>
      <BcOrderFilters
        currentStatus={status}
        currentDateFrom={date_from}
        currentDateTo={date_to}
        currentSearch={search}
      />
      <BcOrderOverview
        result={result}
        error={hasError}
        currentPage={currentPage}
        limit={LIMIT}
      />
    </div>
  )
}

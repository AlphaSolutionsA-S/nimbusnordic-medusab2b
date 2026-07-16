import BcOrderCard from "@/modules/account/components/bc-order-card"
import ResourcePagination from "@/modules/account/components/resource-pagination"
import type { BCOrderListResponse } from "@/types/bc-order"

type BcOrderOverviewProps = {
  result: BCOrderListResponse | null
  error: boolean
  currentPage: number
  limit: number
}

const BcOrderOverview = ({
  result,
  error,
  currentPage,
  limit,
}: BcOrderOverviewProps) => {
  if (error) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-orders-error"
      >
        <h2 className="text-large-semi">Something went wrong</h2>
        <p className="text-base-regular text-neutral-500">
          We were unable to load your company orders. Please try again.
        </p>
        <a
          href=""
          className="text-sm text-neutral-900 underline"
          data-testid="bc-orders-try-again"
        >
          Try again
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
        <h2 className="text-large-semi">No company orders found</h2>
        <p className="text-base-regular text-neutral-500">
          Try adjusting your filters to see more results.
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

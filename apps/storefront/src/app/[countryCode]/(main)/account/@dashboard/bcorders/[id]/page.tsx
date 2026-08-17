import { retrieveBCOrder } from "@/lib/data/business-central"
import BcOrderDetailTemplate from "@/modules/account/templates/bc-order-detail-template"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export default async function BCOrderDetailPage({ params }: Props) {
  const { id } = await params

  try {
    const order = await retrieveBCOrder(id)

    if (!order) {
      notFound()
    }

    return <BcOrderDetailTemplate order={order} />
  } catch {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-order-detail-error"
      >
        <h1 className="text-large-semi">Something went wrong</h1>
        <p className="text-base-regular text-neutral-500">
          We were unable to load this order. Please try again.
        </p>
      </div>
    )
  }
}
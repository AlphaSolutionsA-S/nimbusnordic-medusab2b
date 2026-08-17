import LocalizedClientLink from "@/modules/common/components/localized-client-link"

export default function NotFound() {
  return (
    <div
      className="w-full flex flex-col items-center gap-y-4 py-8"
      data-testid="bc-order-detail-not-found"
    >
      <h1 className="text-large-semi">Order not found</h1>
      <p className="text-base-regular text-neutral-500">
        This order is unavailable.
      </p>
      <LocalizedClientLink
        href="/account/bcorders"
        className="text-small-regular text-ui-fg-base underline"
      >
        Back to BC orders
      </LocalizedClientLink>
    </div>
  )
}
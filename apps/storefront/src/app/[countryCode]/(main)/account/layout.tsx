import { retrieveCustomer } from "@/lib/data/customer"
import { headers } from "next/headers"

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  const customer = await retrieveCustomer().catch(() => null)
  const isLivePreview = (await headers()).get("x-payload-live-preview") === "true"

  return <>{customer || isLivePreview ? dashboard : login}</>
}

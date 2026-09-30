import { retrieveOrder } from "@/lib/data/orders"
import OrderCompletedTemplate from "@/modules/order/templates/order-completed-template"
import { B2BOrder } from "@/types/global"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.orderConfirmed")

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = (await retrieveOrder(params.id).catch(() => null)) as B2BOrder

  if (!order) {
    return notFound()
  }

  return <OrderCompletedTemplate order={order} />
}

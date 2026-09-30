import { retrieveBCReturn } from "@/lib/data/business-central"
import BcReturnDetailTemplate from "@/modules/account/templates/bc-return-detail-template"
import type { BCReturnDetail } from "@/types/bc-order"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ number: string }>
}

export default async function BCReturnDetailPage({ params }: Props) {
  const { number } = await params
  let bcReturn: BCReturnDetail | null

  try {
    bcReturn = await retrieveBCReturn(number)
  } catch {
    const t = await getTranslations("Account.bcReturnDetailPage")

    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-return-detail-error"
      >
        <h1 className="text-large-semi">{t("errorHeading")}</h1>
        <p className="text-base-regular text-neutral-500">{t("errorMessage")}</p>
      </div>
    )
  }

  // notFound() throws, so it must stay outside the try/catch above.
  if (!bcReturn) {
    notFound()
  }

  return <BcReturnDetailTemplate bcReturn={bcReturn} />
}

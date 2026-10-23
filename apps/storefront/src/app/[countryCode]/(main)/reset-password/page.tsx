import PasswordRecovery from "@/modules/account/components/password-recovery"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account.recovery")
  return { title: t("resetHeading"), robots: { index: false, follow: false } }
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ token?: string | string[] }>
}): Promise<React.ReactNode> {
  const { countryCode } = await params
  const { token } = await searchParams
  return (
    <PasswordRecovery
      countryCode={countryCode}
      token={typeof token === "string" ? token : ""}
    />
  )
}

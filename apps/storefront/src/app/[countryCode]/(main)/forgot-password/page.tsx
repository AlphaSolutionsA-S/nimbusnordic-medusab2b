import PasswordRecovery from "@/modules/account/components/password-recovery"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account.recovery")
  return { title: t("requestHeading"), robots: { index: false, follow: false } }
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}): Promise<React.ReactNode> {
  const { countryCode } = await params
  return <PasswordRecovery countryCode={countryCode} />
}

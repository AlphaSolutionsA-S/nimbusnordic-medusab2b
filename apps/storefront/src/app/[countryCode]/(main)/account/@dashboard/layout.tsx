import { retrieveCustomer } from "@/lib/data/customer"
import AccountLayout from "@/modules/account/templates/account-layout"
import { getTranslations } from "next-intl/server"
import Image from "next/image"

export default async function AccountPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Reuses the identical banner alt text already extracted for
  // `@/modules/account/components/login`.
  const tLogin = await getTranslations("Account.login")
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <div className="flex flex-col gap-2 p-2">
      <Image
        src="/account-block.jpg"
        alt={tLogin("bannerAlt")}
        className="object-cover transition-opacity duration-300 w-full h-44"
        width={2000}
        height={200}
        quality={100}
        priority
      />
      <AccountLayout customer={customer}>{children}</AccountLayout>
    </div>
  )
}

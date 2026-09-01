import { retrieveCustomer } from "@/lib/data/customer"
import { listRegions } from "@/lib/data/regions"
import ProfileCard from "@/modules/account/components/profile-card"
import SecurityCard from "@/modules/account/components/security-card"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Profile",
  description: "View and edit your Medusa Store profile.",
}

export default async function Profile() {
  const t = await getTranslations("Account.profilePage")
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  if (!customer || !regions) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <Heading level="h2" className="text-lg text-neutral-950">
          {t("detailsHeading")}
        </Heading>
        <ProfileCard customer={customer} />
      </div>
      <div className="mb-8 flex flex-col gap-y-4">
        <Heading level="h2" className="text-lg text-neutral-950">
          {t("securityHeading")}
        </Heading>
        <SecurityCard customer={customer} />
      </div>
    </div>
  )
}

const Divider = () => {
  return <div className="w-full h-px bg-gray-200" />
}

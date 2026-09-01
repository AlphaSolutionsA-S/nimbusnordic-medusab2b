import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import User from "@/modules/common/icons/user"
import { B2BCustomer } from "@/types/global"
import { getTranslations } from "next-intl/server"

export default async function AccountButton({
  customer,
}: {
  customer: B2BCustomer | null
}) {
  const t = await getTranslations("Account.accountButton")

  return (
    <LocalizedClientLink className="hover:text-ui-fg-base" href="/account">
      <button className="flex gap-1.5 items-center rounded-2xl bg-none shadow-none border-none hover:bg-neutral-100 px-2 py-1">
        <User />
        <span className="hidden small:inline-block">
          {customer ? customer.first_name : t("loginLabel")}
        </span>
      </button>
    </LocalizedClientLink>
  )
}

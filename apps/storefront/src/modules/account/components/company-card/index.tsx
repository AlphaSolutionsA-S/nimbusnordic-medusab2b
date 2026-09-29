import { currencySymbolMap } from "@/lib/constants"
import { formatAmount } from "@/modules/common/components/amount-cell"
import { ModuleCompanyBlockedState, StoreCompanyResponse } from "@/types"
import { HttpTypes } from "@medusajs/types"
import { Container, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"

const BLOCKED_VALUE_KEYS: Record<ModuleCompanyBlockedState, string> = {
  not_blocked: "blockedNotBlockedValue",
  Ship: "blockedShipValue",
  Invoice: "blockedInvoiceValue",
  All: "blockedAllValue",
}

const CompanyCard = ({
  company,
  regions,
}: StoreCompanyResponse & { regions: HttpTypes.StoreRegion[] }) => {
  const t = useTranslations("Account.companyCard")

  const countryName = regions
    .flatMap((region) => region.countries ?? [])
    .find(
      (country) =>
        !!company.country &&
        country.iso_2?.toLowerCase() === company.country.toLowerCase()
    )?.display_name

  const currencyCode = company.currency_code
  const currencySymbol = currencyCode ? currencySymbolMap[currencyCode] : null

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: t("companyNameLabel"), value: company.name },
    { label: t("emailLabel"), value: company.email },
    { label: t("phoneLabel"), value: company.phone },
    { label: t("addressLabel"), value: company.address },
    { label: t("cityLabel"), value: company.city },
    { label: t("stateLabel"), value: company.state },
    { label: t("zipLabel"), value: company.zip },
    {
      label: t("countryLabel"),
      value: countryName ?? company.country?.toUpperCase(),
    },
    {
      label: t("currencyLabel"),
      value: currencyCode
        ? `${currencyCode.toUpperCase()}${currencySymbol ? ` (${currencySymbol})` : ""}`
        : null,
    },
    { label: t("vatNumberLabel"), value: company.vat_number },
    {
      label: t("bcCustomerNumberLabel"),
      value: company.business_central_customer_number,
    },
  ]

  // Financial fields are only present when the server authorized them.
  if ("credit_limit" in company) {
    rows.push({
      label: t("creditLimitLabel"),
      value:
        company.credit_limit != null && currencyCode
          ? formatAmount(company.credit_limit, currencyCode)
          : company.credit_limit?.toString(),
    })
  }
  if ("blocked" in company) {
    rows.push({
      label: t("blockedLabel"),
      value: company.blocked
        ? t(BLOCKED_VALUE_KEYS[company.blocked] ?? "blockedNotBlockedValue")
        : null,
    })
  }
  if ("spending_limit_reset_frequency" in company) {
    const frequency = company.spending_limit_reset_frequency
    rows.push({
      label: t("spendingLimitResetFrequencyLabel"),
      value: frequency
        ? frequency.charAt(0).toUpperCase() + frequency.slice(1)
        : null,
    })
  }

  return (
    <div className="h-fit">
      <Container className="p-0 overflow-hidden">
        <dl className="grid grid-cols-1 small:grid-cols-2 gap-4 p-4">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-y-2 min-w-0">
              <dt>
                <Text className="font-medium text-neutral-950">{row.label}</Text>
              </dt>
              <dd>
                <Text className="text-neutral-500 break-words">
                  {row.value ?? ""}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  )
}

export default CompanyCard

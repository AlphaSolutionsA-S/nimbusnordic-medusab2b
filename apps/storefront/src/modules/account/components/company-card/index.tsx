"use client"

import { currencySymbolMap } from "@/lib/constants"
import { updateCompany } from "@/lib/data/companies"
import Button from "@/modules/common/components/button"
import Input from "@/modules/common/components/input"
import Select from "@/modules/common/components/native-select"
import {
  ModuleCompanySpendingLimitResetFrequency,
  StoreCompanyResponse,
  StoreUpdateCompany,
} from "@/types"
import { AdminRegionCountry, HttpTypes } from "@medusajs/types"
import { Container, Text, clx, toast } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { useState } from "react"

const CompanyCard = ({
  company,
  regions,
}: StoreCompanyResponse & { regions: HttpTypes.StoreRegion[] }) => {
  const t = useTranslations("Account.companyCard")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const {
    updated_at,
    created_at,
    employees,
    approval_settings,
    business_central_customer_number,
    ...companyUpdateData
  } = company

  const [companyData, setCompanyData] = useState(
    companyUpdateData as StoreUpdateCompany
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateCompany(companyData)
      setIsEditing(false)
      toast.success(t("companyUpdatedToast"))
    } catch {
      toast.error(t("companyUpdateErrorToast"))
    } finally {
      setIsSaving(false)
    }
  }

  const currenciesInRegions = Array.from(
    new Set(regions.map((region) => region.currency_code))
  )

  const countriesInRegions = Array.from(
    new Set(
      regions.flatMap((region) => region.countries).map((country) => country)
    )
  ) as AdminRegionCountry[]

  return (
    <div className="h-fit">
      <Container className="p-0 overflow-hidden">
        <form
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 overflow-hidden transition-all duration-300 ease-in-out ",
            {
              "max-h-[560px] opacity-100 p-4": isEditing,
              "max-h-0 opacity-0": !isEditing,
            }
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSave()
            }
          }}
        >
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("companyNameLabel")}</Text>
            <Input
              label={t("companyNameLabel")}
              name="name"
              value={companyData.name || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, name: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("emailLabel")}</Text>
            <Input
              label={t("emailLabel")}
              name="email"
              value={companyData.email || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, email: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("phoneLabel")}</Text>
            <Input
              label={t("phoneLabel")}
              name="phone"
              value={companyData.phone || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, phone: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("addressLabel")}</Text>
            <Input
              label={t("addressLabel")}
              name="address"
              value={companyData.address || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, address: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("cityLabel")}</Text>
            <Input
              label={t("cityLabel")}
              name="city"
              value={companyData.city || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, city: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("stateLabel")}</Text>
            <Input
              label={t("stateLabel")}
              name="state"
              value={companyData.state || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, state: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("zipLabel")}</Text>
            <Input
              label={t("zipLabel")}
              name="zip"
              value={companyData.zip || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, zip: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("countryLabel")}</Text>
            <Select
              name="country"
              value={companyData.country || ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, country: e.target.value })
              }
            >
              {countriesInRegions.map((country, index) => (
                <option key={index} value={country.id}>
                  {country.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("currencyLabel")}</Text>
            <Select
              name="currency_code"
              value={companyData.currency_code || ""}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  currency_code: e.target.value as string,
                })
              }
            >
              {currenciesInRegions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency.toUpperCase()} ({currencySymbolMap[currency]})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              {t("spendingLimitResetFrequencyLabel")}
            </Text>
            <Select
              name="spending_limit_reset_frequency"
              value={companyData.spending_limit_reset_frequency || ""}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  spending_limit_reset_frequency: e.target
                    .value as ModuleCompanySpendingLimitResetFrequency,
                })
              }
            >
              {Object.values(ModuleCompanySpendingLimitResetFrequency).map(
                (value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                )
              )}
            </Select>
          </div>
          {company.business_central_customer_number && (
            <div className="flex flex-col gap-y-2">
              <Text className="font-medium text-neutral-950">
                {t("bcCustomerNumberLabel")}
              </Text>
              <Text className="text-neutral-500">
                {company.business_central_customer_number}
              </Text>
            </div>
          )}
        </form>
        <div
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
            {
              "opacity-0 max-h-0": isEditing,
              "opacity-100 max-h-[280px] p-4": !isEditing,
            }
          )}
        >
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("companyNameLabel")}</Text>
            <Text className=" text-neutral-500">{company.name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("emailLabel")}</Text>
            <Text className=" text-neutral-500">{company.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("phoneLabel")}</Text>
            <Text className=" text-neutral-500">{company.phone}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("addressLabel")}</Text>
            <Text className=" text-neutral-500">
              {company.address}, {company.city}, {company.state}, {company.zip},{" "}
              {company.country?.toUpperCase()}
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("currencyLabel")}</Text>
            <Text className=" text-neutral-500">
              {company.currency_code?.toUpperCase()} (
              {currencySymbolMap[company.currency_code!]})
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              {t("spendingLimitResetFrequencyLabel")}
            </Text>
            <Text className=" text-neutral-500">
              {company.spending_limit_reset_frequency?.charAt(0).toUpperCase() +
                company.spending_limit_reset_frequency?.slice(1)}
            </Text>
          </div>
          {company.business_central_customer_number && (
            <div className="flex flex-col gap-y-2">
              <Text className="font-medium text-neutral-950">
                {t("bcCustomerNumberLabel")}
              </Text>
              <Text className=" text-neutral-500">
                {company.business_central_customer_number}
              </Text>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 bg-neutral-50 p-4">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                {t("cancelLabel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={isSaving}
              >
                {t("saveLabel")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              {t("editLabel")}
            </Button>
          )}
        </div>
      </Container>
    </div>
  )
}

export default CompanyCard

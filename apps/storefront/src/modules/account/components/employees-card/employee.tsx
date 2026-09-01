"use client"

import { currencySymbolMap } from "@/lib/constants"
import { deleteEmployee, updateEmployee } from "@/lib/data/companies"
import {
  getOrderTotalInSpendWindow,
  getSpendWindow,
} from "@/lib/util/check-spending-limit"
import { formatAmount } from "@/modules/common/components/amount-cell"
import Button from "@/modules/common/components/button"
import NativeSelect from "@/modules/common/components/native-select"
import {
  B2BCustomer,
  QueryCompany,
  QueryEmployee,
  StoreUpdateEmployee,
} from "@/types"
import { HttpTypes } from "@medusajs/types"
import {
  Checkbox,
  CurrencyInput,
  Label,
  Prompt,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { useState } from "react"

const RemoveEmployeePrompt = ({ employee }: { employee: QueryEmployee }) => {
  const t = useTranslations("Account.employeeCard")
  const [isRemoving, setIsRemoving] = useState(false)
  const [deleteCustomerAccount, setDeleteCustomerAccount] = useState(false)

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await deleteEmployee(
        employee.company_id,
        employee.id,
        deleteCustomerAccount
      )
      toast.success(t("employeeDeletedToast"))
    } catch {
      toast.error(t("employeeDeleteErrorToast"))
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Prompt variant="danger">
      <Prompt.Trigger asChild>
        <Button variant="transparent">{t("removeLabel")}</Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>{t("removeEmployeeHeading")}</Prompt.Title>
          <Prompt.Description>
            {t.rich("removeConfirmMessage", {
              email: () => <strong>{employee.customer.email}</strong>,
            })}
          </Prompt.Description>
        </Prompt.Header>
        <div className="flex items-center gap-3 px-6 pb-6">
          <Checkbox
            checked={deleteCustomerAccount}
            onCheckedChange={(checked) =>
              setDeleteCustomerAccount(Boolean(checked))
            }
          />
          <Label className="txt-compact-small font-medium">
            {t("deleteCustomerAccountLabel")}
          </Label>
        </div>
        <Prompt.Footer>
          <Prompt.Cancel className="h-10 rounded-full shadow-borders-base">
            {t("cancelLabel")}
          </Prompt.Cancel>
          <Prompt.Action
            className="h-10 px-4 rounded-full shadow-none"
            onClick={handleRemove}
            disabled={isRemoving}
          >
            {t("removeLabel")}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}

const Employee = ({
  employee,
  company,
  orders,
  customer,
}: {
  employee: QueryEmployee
  company: QueryCompany
  orders: HttpTypes.StoreOrder[]
  customer: B2BCustomer | null
}) => {
  const t = useTranslations("Account.employeeCard")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [employeeData, setEmployeeData] = useState({
    id: employee.id,
    company_id: employee.company_id,
    spending_limit: employee.spending_limit.toString(),
    is_admin: employee.is_admin,
  })

  const isCurrentUser = employee.customer.id === customer?.id

  const handleSubmit = async () => {
    const updateData = {
      ...employeeData,
      spending_limit: parseFloat(employeeData.spending_limit),
    }

    setIsSaving(true)
    await updateEmployee(updateData as StoreUpdateEmployee).catch(() => {
      toast.error(t("employeeUpdateErrorToast"))
    })

    setIsSaving(false)
    setIsEditing(false)

    toast.success(t("employeeUpdatedToast"))
  }

  const spent = getOrderTotalInSpendWindow(orders, getSpendWindow(company)) || 0
  const amountSpent = formatAmount(spent, company.currency_code!)

  return (
    <div className="flex flex-col">
      <div className="flex justify-between p-4 border-b border-neutral-200">
        <div className="flex flex-col">
          <Text className=" text-neutral-950 font-medium">
            {employee.customer.first_name} {employee.customer.last_name}{" "}
            {isCurrentUser && t("youSuffixLabel")}{" "}
            {employee.is_admin && (
              <>
                {" • "}
                <span className="text-blue-500">{t("adminBadgeLabel")}</span>
              </>
            )}
          </Text>
          <div className="flex gap-x-2 small:flex-row flex-col">
            <Text className=" text-neutral-500">{employee.customer.email}</Text>
            <Text className=" text-neutral-500 hidden small:block">
              {" • "}
            </Text>
            <Text className=" text-neutral-500">{employee.customer.phone}</Text>
            <Text className=" text-neutral-500 hidden small:block">
              {" • "}
            </Text>
            <Text className=" text-neutral-500">
              {t("amountSpentMessage", {
                amountSpent,
                limit:
                  employee.spending_limit > 0
                    ? formatAmount(
                        employee.spending_limit,
                        company.currency_code!
                      )
                    : t("noLimitLabel"),
              })}
            </Text>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
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
                onClick={handleSubmit}
                isLoading={isSaving}
              >
                {t("saveLabel")}
              </Button>
            </>
          ) : (
            <>
              {!isCurrentUser && <RemoveEmployeePrompt employee={employee} />}
              <Button
                variant="secondary"
                onClick={() => setIsEditing((prev) => !prev)}
              >
                {t("editLabel")}
              </Button>
            </>
          )}
        </div>
      </div>
      <form
        className={clx(
          "bg-neutral-50 grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
          {
            "max-h-[98px] opacity-100 p-4": isEditing,
            "max-h-0 h-0 opacity-0 border-b-0": !isEditing,
          }
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
          }
        }}
      >
        <div className="flex flex-col gap-y-2">
          <Text className=" text-neutral-950 font-medium">
            {t("spendingLimitLabel")}
          </Text>
          <CurrencyInput
            symbol={currencySymbolMap[company.currency_code!]}
            code={company.currency_code!}
            className="bg-white rounded-full"
            name="spending_limit"
            value={employeeData.spending_limit}
            onChange={(e) => {
              setEmployeeData({
                ...employeeData,
                spending_limit: e.target.value.replace(/[^0-9.]/g, ""),
              })
            }}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Text className=" text-neutral-950 font-medium">
            {t("permissionsLabel")}
          </Text>
          <NativeSelect
            className="bg-white"
            name="permissions"
            value={employeeData.is_admin ? "true" : "false"}
            disabled={!customer?.employee?.is_admin}
            onChange={(e) => {
              setEmployeeData({
                ...employeeData,
                is_admin: e.target.value === "true",
              })
            }}
          >
            <option value="true">{t("adminOptionLabel")}</option>
            <option value="false">{t("employeeOptionLabel")}</option>
          </NativeSelect>
        </div>
      </form>
    </div>
  )
}

export default Employee

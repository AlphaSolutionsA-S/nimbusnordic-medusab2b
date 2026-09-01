"use client"

import { updateCustomer, updatePassword } from "@/lib/data/customer"
import Button from "@/modules/common/components/button"
import Input from "@/modules/common/components/input"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"
import { Container, Text, clx, toast } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"

const ProfileCard = ({ customer }: { customer: B2BCustomer }) => {
  const t = useTranslations("Account.profileCard")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const [isEditingPassword, setIsEditingPassword] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const { first_name, last_name, phone } = customer

  const [customerData, setCustomerData] = useState({
    first_name,
    last_name,
    phone,
  } as HttpTypes.StoreUpdateCustomer)

  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateCustomer(customerData)
      router.refresh()
      setIsEditing(false)
      toast.success(t("customerUpdatedToast"))
    } catch {
      toast.error(t("customerUpdateErrorToast"))
    } finally {
      setIsSaving(false)
    }
  }

  const resetPasswordForm = () => {
    setPasswordData({
      old_password: "",
      new_password: "",
      confirm_password: "",
    })
  }

  const handleSavePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error(t("passwordMismatchToast"))
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.error(t("passwordTooShortToast"))
      return
    }

    setIsSavingPassword(true)

    try {
      await updatePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      })
      setIsEditingPassword(false)
      resetPasswordForm()
      toast.success(t("passwordUpdatedToast"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("passwordUpdateErrorToast")
      )
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="h-fit">
      <Container className="p-0 overflow-hidden">
        <form
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 overflow-hidden transition-all duration-300 ease-in-out",
            {
              "max-h-[244px] opacity-100 p-4": isEditing,
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
            <Text className="font-medium text-neutral-950">{t("firstNameLabel")}</Text>
            <Input
              label={t("firstNameLabel")}
              name="first_name"
              value={customerData.first_name}
              onChange={(e) =>
                setCustomerData({
                  ...customerData,
                  first_name: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("lastNameLabel")}</Text>
            <Input
              label={t("lastNameLabel")}
              name="last_name"
              value={customerData.last_name}
              onChange={(e) =>
                setCustomerData({
                  ...customerData,
                  last_name: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("emailLabel")}</Text>
            <Text className=" text-neutral-500">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("phoneLabel")}</Text>
            <Input
              label={t("phoneLabel")}
              name="phone"
              value={customerData.phone}
              onChange={(e) =>
                setCustomerData({ ...customerData, phone: e.target.value })
              }
            />
          </div>
        </form>
        <div
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
            {
              "opacity-0 max-h-0": isEditing,
              "opacity-100 max-h-[214px] p-4": !isEditing,
            }
          )}
        >
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("firstNameLabel")}</Text>
            <Text className=" text-neutral-500">{customer.first_name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("lastNameLabel")}</Text>
            <Text className=" text-neutral-500">{customer.last_name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("emailLabel")}</Text>
            <Text className=" text-neutral-500">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">{t("phoneLabel")}</Text>
            <Text className=" text-neutral-500">{customer.phone}</Text>
          </div>
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

      <Container className="p-0 overflow-hidden mt-4">
        <form
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 overflow-hidden transition-all duration-300 ease-in-out",
            {
              "max-h-[244px] opacity-100 p-4": isEditingPassword,
              "max-h-0 opacity-0": !isEditingPassword,
            }
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSavePassword()
            }
          }}
        >
          <div className="flex flex-col gap-y-2 col-span-2">
            <Text className="font-medium text-neutral-950">
              {t("currentPasswordLabel")}
            </Text>
            <Input
              label={t("currentPasswordLabel")}
              name="old_password"
              type="password"
              autoComplete="current-password"
              value={passwordData.old_password}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  old_password: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              {t("newPasswordLabel")}
            </Text>
            <Input
              label={t("newPasswordLabel")}
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordData.new_password}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  new_password: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              {t("confirmPasswordLabel")}
            </Text>
            <Input
              label={t("confirmPasswordLabel")}
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordData.confirm_password}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  confirm_password: e.target.value,
                })
              }
            />
          </div>
        </form>
        <div
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
            {
              "opacity-0 max-h-0": isEditingPassword,
              "opacity-100 max-h-[214px] p-4": !isEditingPassword,
            }
          )}
        >
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              {t("passwordLabel")}
            </Text>
            <Text className=" text-neutral-500">••••••••</Text>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 bg-neutral-50 p-4">
          {isEditingPassword ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditingPassword(false)
                  resetPasswordForm()
                }}
                disabled={isSavingPassword}
              >
                {t("cancelLabel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePassword}
                isLoading={isSavingPassword}
              >
                {t("saveLabel")}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setIsEditingPassword(true)}
            >
              {t("changePasswordLabel")}
            </Button>
          )}
        </div>
      </Container>
    </div>
  )
}

export default ProfileCard

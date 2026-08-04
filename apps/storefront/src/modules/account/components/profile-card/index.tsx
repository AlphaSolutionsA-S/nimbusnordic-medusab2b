"use client"

import { updateCustomer, updatePassword } from "@/lib/data/customer"
import Button from "@/modules/common/components/button"
import Input from "@/modules/common/components/input"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"
import { Container, Text, clx, toast } from "@medusajs/ui"
import { useState } from "react"

const ProfileCard = ({ customer }: { customer: B2BCustomer }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
    await updateCustomer(customerData).catch(() => {
      toast.error("Error updating customer")
    })
    setIsSaving(false)
    setIsEditing(false)

    toast.success("Customer updated")
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
      toast.error("New passwords do not match")
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.error("Password must be at least 8 characters")
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
      toast.success("Password updated")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error updating password"
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
            <Text className="font-medium text-neutral-950">First Name</Text>
            <Input
              label="First Name"
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
            <Text className="font-medium text-neutral-950">Last Name</Text>
            <Input
              label="Last Name"
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
            <Text className="font-medium text-neutral-950">Email</Text>
            <Text className=" text-neutral-500">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Phone</Text>
            <Input
              label="Phone"
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
            <Text className="font-medium text-neutral-950">First Name</Text>
            <Text className=" text-neutral-500">{customer.first_name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Last Name</Text>
            <Text className=" text-neutral-500">{customer.last_name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Email</Text>
            <Text className=" text-neutral-500">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Phone</Text>
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
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={isSaving}
              >
                Save
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Edit
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
              Current Password
            </Text>
            <Input
              label="Current Password"
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
            <Text className="font-medium text-neutral-950">New Password</Text>
            <Input
              label="New Password"
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
              Confirm Password
            </Text>
            <Input
              label="Confirm Password"
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
            <Text className="font-medium text-neutral-950">Password</Text>
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
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePassword}
                isLoading={isSavingPassword}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setIsEditingPassword(true)}
            >
              Change Password
            </Button>
          )}
        </div>
      </Container>
    </div>
  )
}

export default ProfileCard

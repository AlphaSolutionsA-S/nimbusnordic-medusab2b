"use client"

import { createEmployee } from "@/lib/data/companies"
import Button from "@/modules/common/components/button"
import Input from "@/modules/common/components/input"
import { QueryCompany } from "@/types"
import { Container, Text, toast } from "@medusajs/ui"
import { useState } from "react"

const InviteEmployeeCard = ({ company }: { company: QueryCompany }) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    setIsLoading(true)
    try {
      await createEmployee({
        company_id: company.id,
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        spending_limit: 0,
        is_admin: false,
      })

      toast.success("Employee invited")
      form.reset()
    } catch (error) {
      toast.error("Error inviting employee")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container className="p-0 overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div className="grid small:grid-cols-4 grid-cols-2 gap-4 p-4 border-b border-neutral-200">
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Name</Text>
            <Input name="first_name" label="First name" required />
          </div>
          <div className="flex flex-col gap-y-2 justify-end">
            <Input name="last_name" label="Last name" required />
          </div>
          <div className="flex flex-col col-span-2 gap-y-2">
            <Text className="font-medium text-neutral-950">Email</Text>
            <Input name="email" label="Enter an email" type="email" required />
          </div>
          <div className="flex flex-col col-span-2 gap-y-2">
            <Text className="font-medium text-neutral-950">
              Initial password
            </Text>
            <Input
              name="password"
              label="Set an initial password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 bg-neutral-50 p-4">
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Send Invite
          </Button>
        </div>
      </form>
    </Container>
  )
}

export default InviteEmployeeCard

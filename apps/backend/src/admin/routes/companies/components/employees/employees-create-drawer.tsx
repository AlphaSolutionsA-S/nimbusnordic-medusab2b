import { Button, Drawer, toast } from "@medusajs/ui";
import { AdminCreateEmployee, QueryCompany } from "../../../../../types";
import { useState } from "react";
import { useCreateEmployee } from "../../../../hooks/api";
import { EmployeesCreateForm } from "./employees-create-form";

export function EmployeeCreateDrawer({ company }: { company: QueryCompany }) {
  const [open, setOpen] = useState(false);

  const {
    mutateAsync: createEmployee,
    isPending: createEmployeeLoading,
    error: createEmployeeError,
  } = useCreateEmployee(company.id);

  const handleSubmit = async (formData: AdminCreateEmployee) => {
    if (!formData.email || !formData.password) {
      toast.error("Email and an initial password are required");
      return;
    }

    const response = await createEmployee({
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      spending_limit: formData.spending_limit,
      is_admin: formData.is_admin,
    }).catch(() => null);

    if (!response?.employee) {
      toast.error("Failed to create employee");
      return;
    }

    setOpen(false);
    toast.success(
      `Employee ${formData.first_name ?? ""} ${
        formData.last_name ?? ""
      } created successfully`
    );
  };

  const loading = createEmployeeLoading;
  const error = createEmployeeError;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          Add
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Add Company Customer</Drawer.Title>
        </Drawer.Header>
        <EmployeesCreateForm
          handleSubmit={handleSubmit}
          loading={loading}
          error={error}
          company={company}
        />
      </Drawer.Content>
    </Drawer>
  );
}

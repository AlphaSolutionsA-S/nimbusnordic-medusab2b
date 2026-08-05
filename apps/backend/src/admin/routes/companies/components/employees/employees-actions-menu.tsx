import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons";
import { Checkbox, DropdownMenu, IconButton, Label, toast } from "@medusajs/ui";
import { useState } from "react";
import { EmployeesUpdateDrawer } from ".";
import { QueryCompany, QueryEmployee } from "../../../../../types";
import { DeletePrompt } from "../../../../components/common";
import { useDeleteEmployee } from "../../../../hooks/api";

export const EmployeesActionsMenu = ({
  company,
  employee,
}: {
  company: QueryCompany;
  employee: QueryEmployee;
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCustomerAccount, setDeleteCustomerAccount] = useState(false);
  const { mutateAsync: mutateDelete, isPending: loadingDelete } =
    useDeleteEmployee(employee.company_id);

  const handleDelete = async () => {
    await mutateDelete(
      {
        employeeId: employee.id,
        delete_customer_account: deleteCustomerAccount,
      },
      {
        onSuccess: () => {
          toast.success(`Employee deleted successfully`);
        },
      }
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton variant="transparent">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            className="gap-x-2"
            onClick={() => setEditOpen(true)}
          >
            <PencilSquare />
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            className="gap-x-2"
            onClick={() => {
              setDeleteCustomerAccount(false);
              setDeleteOpen(true);
            }}
          >
            <Trash />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <EmployeesUpdateDrawer
        company={company}
        employee={employee}
        open={editOpen}
        setOpen={setEditOpen}
        toast={toast}
      />
      <DeletePrompt
        handleDelete={handleDelete}
        children={
          <div className="flex items-center gap-3">
            <Checkbox
              checked={deleteCustomerAccount}
              onCheckedChange={(checked) =>
                setDeleteCustomerAccount(Boolean(checked))
              }
            />
            <Label className="txt-compact-small font-medium">
              Also delete the linked customer account and login
            </Label>
          </div>
        }
        loading={loadingDelete}
        open={deleteOpen}
        setOpen={setDeleteOpen}
      />
    </>
  );
};

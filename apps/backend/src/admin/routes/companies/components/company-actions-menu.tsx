import { HttpTypes } from "@medusajs/framework/types";
import {
  ArrowPath,
  Link,
  LockClosedSolid,
  PencilSquare,
  Trash,
} from "@medusajs/icons";
import { toast } from "@medusajs/ui";
import {
  AdminSyncCompanyBusinessCentralResponse,
  QueryCompany,
} from "../../../../types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionMenu } from "../../../components/common";
import { DeletePrompt } from "../../../components/common/delete-prompt";
import {
  useDeleteCompany,
  useSyncCompanyFromBusinessCentral,
} from "../../../hooks/api";

const SYNC_OUTCOME_TOASTS: Record<
  AdminSyncCompanyBusinessCentralResponse["status"],
  () => void
> = {
  updated: () => toast.success("Company synced from Business Central"),
  skipped: () =>
    toast.info("Nothing to sync", {
      description:
        "Business Central has no customer for this company's customer number. Nothing was changed.",
    }),
  failed: () =>
    toast.error("Business Central sync failed", {
      description:
        "Business Central could not be reached or returned an error, so nothing was changed.",
    }),
};
import {
  CompanyApprovalSettingsDrawer,
  CompanyCustomerGroupDrawer,
  CompanyUpdateDrawer,
} from "./";

export const CompanyActionsMenu = ({
  company,
  customerGroups,
}: {
  company: QueryCompany;
  customerGroups?: HttpTypes.AdminCustomerGroup[];
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [customerGroupOpen, setCustomerGroupOpen] = useState(false);
  const [approvalSettingsOpen, setApprovalSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutateAsync: mutateDelete, isPending: loadingDelete } =
    useDeleteCompany(company.id);
  const { mutate: mutateSync } = useSyncCompanyFromBusinessCentral(company.id);

  const navigate = useNavigate();

  const handleSync = () => {
    mutateSync(undefined, {
      onSuccess: ({ status }) => SYNC_OUTCOME_TOASTS[status](),
      onError: () =>
        toast.error("Could not sync the company from Business Central", {
          description: "Something went wrong. Try again later.",
        }),
    });
  };

  const handleDelete = () => {
    mutateDelete(company.id, {
      onSuccess: () => {
        navigate("/companies");
        toast.success(`Company ${company.name} deleted successfully`);
      },
    });
  };

  return (
    <>
      <ActionMenu
        groups={[
          {
            actions: [
              {
                icon: <PencilSquare />,
                label: "Edit details",
                onClick: () => setEditOpen(true),
              },
              {
                icon: <Link />,
                label: "Manage customer group",
                onClick: () => setCustomerGroupOpen(true),
              },
              {
                icon: <LockClosedSolid />,
                label: "Approval settings",
                onClick: () => setApprovalSettingsOpen(true),
              },
              {
                icon: <ArrowPath />,
                label: "Sync from Business Central",
                onClick: handleSync,
                disabled: !company.business_central_customer_number,
                tooltip: company.business_central_customer_number
                  ? undefined
                  : "Add a Business Central customer number to sync this company.",
              },
            ],
          },
          {
            actions: [
              {
                icon: <Trash />,
                label: "Delete",
                onClick: () => setDeleteOpen(true),
              },
            ],
          },
        ]}
      />

      <CompanyUpdateDrawer
        company={company}
        open={editOpen}
        setOpen={setEditOpen}
      />
      <CompanyCustomerGroupDrawer
        company={company}
        customerGroups={customerGroups}
        open={customerGroupOpen}
        setOpen={setCustomerGroupOpen}
      />
      <CompanyApprovalSettingsDrawer
        company={company}
        open={approvalSettingsOpen}
        setOpen={setApprovalSettingsOpen}
      />
      <DeletePrompt
        handleDelete={handleDelete}
        loading={loadingDelete}
        open={deleteOpen}
        setOpen={setDeleteOpen}
      />
    </>
  );
};

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { APPROVAL_MODULE } from "../../../modules/approval";
import {
  ApprovalStatusType,
  ApprovalType,
  IApprovalModuleService,
  ModuleCreateApproval,
} from "../../../types";

export const createApprovalStep = createStep(
  "create-approval",
  async (
    input:
      | Omit<ModuleCreateApproval, "type">
      | Omit<ModuleCreateApproval, "type">[],
    { container }
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const approvalData = Array.isArray(input) ? input : [input];

    const {
      data: [cart],
    } = await query.graph(
      {
        entity: "cart",
        fields: [
          "id",
          "approvals.*",
          "approval_status.*",
          "company.id",
          "company.approval_settings.*",
        ],
        filters: {
          id: approvalData[0].cart_id,
          customer_id: approvalData[0].created_by,
        },
      },
      {
        throwIfKeyNotFound: true,
      }
    );

    if (
      (cart.approval_status?.status as unknown as ApprovalStatusType) ===
      ApprovalStatusType.PENDING
    ) {
      throw new Error("Cart already has a pending approval");
    }

    if (
      (cart.approval_status?.status as unknown as ApprovalStatusType) ===
      ApprovalStatusType.APPROVED
    ) {
      throw new Error("Cart is already approved");
    }

    const { requires_admin_approval, requires_sales_manager_approval } =
      cart?.company?.approval_settings || {};

    const approvalsToCreate = [] as ModuleCreateApproval[];

    if (requires_admin_approval) {
      approvalsToCreate.push(
        ...approvalData.map((data) => ({
          ...data,
          type: ApprovalType.ADMIN,
        }))
      );
    }

    if (requires_sales_manager_approval) {
      approvalsToCreate.push(
        ...approvalData.map((data) => ({
          ...data,
          type: ApprovalType.SALES_MANAGER,
        }))
      );
    }

    if (approvalsToCreate.length === 0) {
      throw new Error("No enabled approval types found");
    }

    const approvalModuleService =
      container.resolve<IApprovalModuleService>(APPROVAL_MODULE);

    const approvals = await approvalModuleService.createApprovals(
      approvalsToCreate
    );

    const previousIds = (cart.approvals ?? [])
      .filter((approval) => approval !== null)
      .map((approval) => approval.id);
    try {
      await approvalModuleService.softDeleteApprovals(previousIds);
    } catch (error) {
      await approvalModuleService.deleteApprovals(approvals.map((approval) => approval.id));
      throw error;
    }

    return new StepResponse(
      approvals,
      { createdIds: approvals.map((approval) => approval.id), previousIds }
    );
  },
  async (data: { createdIds: string[]; previousIds: string[] } | undefined, { container }) => {
    if (!data) return;
    const approvalModuleService =
      container.resolve<IApprovalModuleService>(APPROVAL_MODULE);

    await approvalModuleService.deleteApprovals(data.createdIds);
    await approvalModuleService.restoreApprovals(data.previousIds);
  }
);

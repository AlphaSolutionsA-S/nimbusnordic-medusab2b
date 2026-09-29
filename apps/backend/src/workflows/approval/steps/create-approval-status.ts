import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { APPROVAL_MODULE } from "../../../modules/approval";
import { ApprovalStatusType, IApprovalModuleService } from "../../../types";

export const createApprovalStatusStep = createStep(
  "create-approval-status",
  async (cartIds: string[], { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const approvalModuleService =
      container.resolve<IApprovalModuleService>(APPROVAL_MODULE);

    const {
      data: [existingApprovalStatus],
    } = await query.graph({
      entity: "approval_status",
      fields: ["*"],
      filters: {
        cart_id: cartIds[0],
      },
    });

    if (existingApprovalStatus) {
      const [approvalStatus] =
        await approvalModuleService.updateApprovalStatuses([
          {
            id: existingApprovalStatus.id,
            status: ApprovalStatusType.PENDING,
          },
        ]);

      return new StepResponse({ ...approvalStatus, already_linked: true }, {
        id: approvalStatus.id,
        previous_status: existingApprovalStatus.status as ApprovalStatusType,
      });
    }

    const approvalStatusesToCreate = cartIds.map((cartId) => ({
      cart_id: cartId,
      status: ApprovalStatusType.PENDING,
    }));

    const [approvalStatus] = await approvalModuleService.createApprovalStatuses(
      approvalStatusesToCreate
    );

    return new StepResponse({ ...approvalStatus, already_linked: false }, {
      id: approvalStatus.id,
      previous_status: undefined,
    });
  },
  async (data: { id: string; previous_status?: ApprovalStatusType } | undefined, { container }) => {
    if (!data) {
      return;
    }

    const approvalModuleService =
      container.resolve<IApprovalModuleService>(APPROVAL_MODULE);

    if (data.previous_status) {
      await approvalModuleService.updateApprovalStatuses([{
        id: data.id,
        status: data.previous_status,
      }]);
    } else {
      await approvalModuleService.deleteApprovalStatuses([data.id]);
    }
  }
);

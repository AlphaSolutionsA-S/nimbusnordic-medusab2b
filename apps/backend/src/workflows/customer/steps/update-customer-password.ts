import { AuthenticationInput } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

type StepInput = {
  email: string;
  old_password: string;
  new_password: string;
};

export const updateCustomerPasswordStep = createStep(
  "update-customer-password",
  async (input: StepInput, { container }) => {
    const authModuleService = container.resolve(Modules.AUTH);

    const { success: authenticated } = await authModuleService.authenticate(
      "emailpass",
      {
        body: { email: input.email, password: input.old_password },
      } as AuthenticationInput
    );

    if (!authenticated) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Current password is incorrect"
      );
    }

    const { success } = await authModuleService.updateProvider("emailpass", {
      entity_id: input.email,
      password: input.new_password,
    });

    if (!success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Failed to update password"
      );
    }

    return new StepResponse(true);
  }
);

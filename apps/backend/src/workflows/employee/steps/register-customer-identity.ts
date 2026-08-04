import { AuthenticationInput } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

type StepInput = {
  email: string;
  password: string;
};

export const registerCustomerIdentityStep = createStep(
  "register-customer-identity",
  async (input: StepInput, { container }) => {
    const authModuleService = container.resolve(Modules.AUTH);

    const { success, authIdentity, error } = await authModuleService.register(
      "emailpass",
      {
        body: { email: input.email, password: input.password },
      } as AuthenticationInput
    );

    if (!success || !authIdentity) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        error || "Failed to create login credentials for the employee"
      );
    }

    return new StepResponse(authIdentity.id, authIdentity.id);
  },
  async (authIdentityId, { container }) => {
    if (!authIdentityId) {
      return;
    }

    const authModuleService = container.resolve(Modules.AUTH);
    await authModuleService.deleteAuthIdentities([authIdentityId]);
  }
);

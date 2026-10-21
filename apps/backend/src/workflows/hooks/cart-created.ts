import { createCartWorkflow } from "@medusajs/core-flows";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { COMPANY_MODULE } from "../../modules/company";

// The company link is derived from the owner's employee record, never from client input such as
// `metadata.company_id` (rule trust-no-client-company, NIMBUS-177).
createCartWorkflow.hooks.cartCreated(
  async (
    { cart },
    { container }
  ): Promise<
    | StepResponse<undefined, null>
    | StepResponse<undefined, { cart_id: string; company_id: string }>
  > => {
    if (!cart.customer_id) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "A signed-in customer is required to create a cart"
      );
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    // Deliberate exemption from data-core-read-workflows: a narrow lookup of the owner's company.
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ["employee.company_id"],
      filters: { id: cart.customer_id },
    });
    const companyId = customer?.employee?.company_id;
    if (!companyId) {
      return new StepResponse(undefined, null);
    }

    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
    await remoteLink.create({
      [COMPANY_MODULE]: { company_id: companyId },
      [Modules.CART]: { cart_id: cart.id },
    });

    return new StepResponse(undefined, {
      cart_id: cart.id,
      company_id: companyId,
    });
  },
  async (
    input: { cart_id: string; company_id: string } | null,
    { container }
  ) => {
    if (!input) {
      return;
    }

    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);

    await remoteLink.dismiss({
      [COMPANY_MODULE]: {
        company_id: input.company_id,
      },
      [Modules.CART]: {
        cart_id: input.cart_id,
      },
    });
  }
);

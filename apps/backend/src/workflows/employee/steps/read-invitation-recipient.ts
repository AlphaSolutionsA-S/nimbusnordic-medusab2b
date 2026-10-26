import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import type { InvitationRecipient } from "../utils/employee-invitation-notification";

export type ReadInvitationRecipientInput = {
  customer_id: string;
  company_id: string;
};

export type InvitationRecipientWithCountry = InvitationRecipient & {
  company_country: string | null;
};

/**
 * The address comes from the customer record by id, never from the event, so an invitation cannot
 * be redirected (NIMBUS-242).
 */
export const readInvitationRecipientStep = createStep(
  "read-invitation-recipient",
  async (input: ReadInvitationRecipientInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    // Deliberate exemption from data-core-read-workflows: two columns of one customer by id.
    const {
      data: [customer],
    } = await query.graph(
      { entity: "customer", fields: ["email", "first_name"], filters: { id: input.customer_id } },
      { throwIfKeyNotFound: true }
    );
    const {
      data: [company],
    } = await query.graph(
      { entity: "company", fields: ["name", "country"], filters: { id: input.company_id } },
      { throwIfKeyNotFound: true }
    );
    if (!customer.email) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Invited customer has no email address");
    }
    return new StepResponse<InvitationRecipientWithCountry>({
      email: customer.email,
      first_name: customer.first_name ?? null,
      company_name: company.name,
      company_country: company.country ?? null,
    });
  }
);

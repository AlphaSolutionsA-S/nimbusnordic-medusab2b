import { asValue } from "@medusajs/framework/awilix";
import {
  ContainerRegistrationKeys,
  createMedusaContainer,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type {
  BCCustomer,
  BusinessCentralEnvironment,
} from "../../../../modules/business-central/types";
import { COMPANY_MODULE } from "../../../../modules/company";
import { GET as getStatus } from "../[id]/business-central-customer/route";
import { GET as getLookup } from "../[id]/business-central-customer/lookup/route";
import { POST as postUse } from "../[id]/business-central-customer/use/route";
import { AdminUseBusinessCentralCustomer } from "../validators";

// The routes and their workflows run for real; only the database (Query and the company module)
// and Business Central are replaced. Admin authentication and the HTTP contract are covered in
// integration-tests/http/companies/companies.spec.ts and security/security-boundaries.spec.ts.

function card(country: string): BCCustomer {
  return {
    number: "00077777",
    displayName: `Kort ${country}`,
    email: "kort@example.com",
    phoneNumber: "77776666",
    addressLine1: "Kortgata 7",
    addressLine2: "",
    city: "Bergen",
    state: "",
    postalCode: "5003",
    country,
    blocked: "Invoice",
    creditLimit: 7000,
    taxRegistrationNumber: "NO777777777",
    currencyCode: "NOK",
  };
}

function setup(answers: Partial<Record<BusinessCentralEnvironment, BCCustomer>>) {
  const row: Record<string, unknown> & { id: string } = {
    id: "comp_1",
    business_central_customer_number: "00077777",
    country: " no ",
    business_central_not_found_at: new Date("2026-10-01T10:00:00.000Z"),
    business_central_not_found_environment: "NO",
    business_central_not_found_customer_number: "00077777",
  };
  const container = createMedusaContainer();
  container.register(
    BUSINESS_CENTRAL_MODULE,
    asValue({
      getCustomer: jest.fn(
        async (environment: BusinessCentralEnvironment) => answers[environment] ?? null
      ),
    })
  );
  container.register(
    COMPANY_MODULE,
    asValue({
      listCompanies: jest.fn(async () => [{ ...row }]),
      updateCompanies: jest.fn(async (update: Record<string, unknown>) => Object.assign(row, update)),
    })
  );
  container.register(
    ContainerRegistrationKeys.QUERY,
    asValue({ graph: jest.fn(async () => ({ data: [{ ...row }] })) })
  );
  container.register(
    ContainerRegistrationKeys.LOGGER,
    asValue({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() })
  );

  return container;
}

// The handlers read only scope, params and validatedBody, and call status().json().
function call(container: ReturnType<typeof setup>, body?: { environment: "NO" }) {
  const req = { scope: container, params: { id: "comp_1" }, validatedBody: body };
  const json = jest.fn();
  const res: { status: jest.Mock; json: jest.Mock } = { status: jest.fn(() => res), json };

  return { req: req as never, res: res as never, json };
}

describe("Admin Business Central customer routes", () => {
  it("GET status returns the routed environment, number and not-found record", async () => {
    const { req, res, json } = call(setup({}));

    await getStatus(req, res);

    expect(json).toHaveBeenCalledWith({
      routed_environment: "NO",
      customer_number: "00077777",
      not_found: {
        at: "2026-10-01T10:00:00.000Z",
        environment: "NO",
        customer_number: "00077777",
      },
    });
  });

  it("GET lookup returns per environment only the name, country and routing verdict", async () => {
    const { req, res, json } = call(setup({ DK: card("NO"), NO: card("SE") }));

    await getLookup(req, res);

    expect(json).toHaveBeenCalledWith({
      customer_number: "00077777",
      results: [
        {
          environment: "DK",
          status: "found",
          customer: { name: "Kort NO", country: "NO", routes_to: "NO", routes_elsewhere: true },
        },
        {
          environment: "NO",
          status: "found",
          customer: { name: "Kort SE", country: "SE", routes_to: "DK", routes_elsewhere: true },
        },
      ],
    });
  });

  it("POST use returns the sync outcome and the country written from the card", async () => {
    const { req, res, json } = call(setup({ NO: card("NO") }), { environment: "NO" });

    await postUse(req, res);

    expect(json).toHaveBeenCalledWith({ status: "updated", country: "NO" });
  });

  it.each([[{ environment: "NO", country: "NO" }], [{ environment: "SE" }], [{}]])(
    "the use body refuses %j, so the client can never choose the country",
    (body) => {
      expect(AdminUseBusinessCentralCustomer.safeParse(body).success).toBe(false);
    }
  );
});

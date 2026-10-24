import { validateAndTransformQuery } from "@medusajs/framework/http";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  listQuotesTransformQueryConfig,
  retrieveQuoteTransformQueryConfig,
} from "../query-config";
import { GetQuoteParams } from "../validators";

describe.each([
  ["list", listQuotesTransformQueryConfig],
  ["retrieve", retrieveQuoteTransformQueryConfig],
] as const)("store quote %s projection", (_name, config) => {
  async function transform(query: Record<string, string> = {}) {
    const request: Partial<MedusaRequest> = { query, allowed: [], storeRelationsLimit: 3 };
    const req = request as MedusaRequest;
    let failure: unknown;
    await validateAndTransformQuery(GetQuoteParams, config)(
      req,
      {} as MedusaResponse,
      (error?: unknown) => { failure = error; }
    );
    if (failure) throw failure;
    return req.queryConfig;
  }

  it("keeps the default company and author projection at scalar leaves within the local depth limit", async () => {
    const { fields } = await transform();
    expect(fields.filter((field) => field.startsWith("customer.employee.company")))
      .toEqual(["customer.employee.company.name"]);
    for (const author of ["admin", "customer"]) {
      expect(fields.filter((field) => field.startsWith(`messages.${author}.`)).sort())
        .toEqual([`messages.${author}.first_name`, `messages.${author}.last_name`]);
      expect(fields).not.toContain(`messages.${author}.*`);
    }
    expect(fields).not.toContain("customer.*");
    expect(fields).not.toContain("customer.employee.*");
    expect(fields).toEqual(expect.arrayContaining([
      "draft_order_id", "customer.email", "customer.phone", "customer.first_name",
      "customer.last_name", "customer.employee.spending_limit", "customer.employee.is_admin",
      "messages.*", "draft_order.items.variant.product.*",
    ]));
  });

  it.each([
    "customer.employee.company.credit_limit,messages.admin.email,messages.customer.email",
    "+customer.employee.company.credit_limit,+messages.admin.email,+messages.customer.email",
    "*customer,*customer.employee,*customer.employee.company,*messages.admin,*messages.customer",
    "customer.*,customer.employee.*,customer.employee.company.*,messages.admin.*,messages.customer.*",
    "customer,customer.employee,customer.employee.company,messages.admin,messages.customer",
    "+customer.employee.company.employees.spending_limit,+customer.addresses.*",
  ])("silently strips forbidden expansion %s", async (fields) => {
    const result = await transform({ fields: `+id,${fields}` });
    expect(result.fields).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^(customer(\.(employee(\.company)?)?)?(\.\*)?|messages\.(admin|customer)(\.(\*|email))?)$/),
    ]));
    expect(result.fields.filter((field) => field.startsWith("customer.employee.company")))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/company\.(?!name$)/)]));
    expect(result.fields.some((field) => field.includes(".employees") || field.includes("credit_limit") || field.includes("addresses")))
      .toBe(false);
  });

  it("retains explicit safe leaves and existing additive draft order state requests", async () => {
    expect((await transform({ fields: "id,customer.employee.company.name,messages.admin.first_name,messages.customer.last_name" })).fields.sort())
      .toEqual(["id", "customer.employee.company.name", "messages.admin.first_name", "messages.customer.last_name"].sort());
    expect((await transform({ fields: "+draft_order.is_draft_order,+draft_order.status" })).fields)
      .toEqual(expect.arrayContaining(["draft_order.is_draft_order", "draft_order.status", "customer.email"]));
  });

  it("permits existing sorting and refuses sorting on forbidden data", async () => {
    const result = await transform({ order: "-created_at" });
    if (config.isList) {
      expect(result.pagination.order).toEqual({ created_at: "DESC" });
    }
    await expect(transform({ order: "customer.employee.company.credit_limit" }))
      .rejects.toMatchObject({ message: expect.stringContaining("credit_limit") });
  });

  it("does not mutate shared configuration across repeated and concurrent requests", async () => {
    const first = await transform();
    const results = await Promise.all(Array.from({ length: 10 }, () => transform()));
    results.forEach((result) => expect(result).toEqual(first));
  });
});

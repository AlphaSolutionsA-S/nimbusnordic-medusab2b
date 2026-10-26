import { StoreCreateEmployee } from "../validators";

const account = { email: "new@example.test", password: "password123" };

describe("StoreCreateEmployee", () => {
  it("accepts an optional lower-case two-letter page country", () => {
    expect(StoreCreateEmployee.parse({ ...account, country_code: "se" })).toMatchObject({
      country_code: "se",
    });
    expect(StoreCreateEmployee.parse(account)).not.toHaveProperty("country_code");
  });

  it.each([["SE"], ["../x"], ["swe"], [""], [46], [null]])(
    "rejects the page country %p",
    (country_code) => {
      expect(StoreCreateEmployee.safeParse({ ...account, country_code }).success).toBe(false);
    }
  );

  it.each([["to"], ["company_country"]])("rejects the unknown field %s", (field) => {
    expect(StoreCreateEmployee.safeParse({ ...account, [field]: "se" }).success).toBe(false);
  });

  it.each([
    ["alone", { customer_id: "cus_existing" }],
    ["with a new account", { ...account, customer_id: "cus_existing" }],
  ])("refuses linking an existing customer %s", (_label, body) => {
    expect(StoreCreateEmployee.safeParse(body).success).toBe(false);
  });

  it.each([
    ["email", { password: account.password }],
    ["password", { email: account.email }],
  ])("requires %s for the new account", (_field, body) => {
    expect(StoreCreateEmployee.safeParse(body).success).toBe(false);
  });
});

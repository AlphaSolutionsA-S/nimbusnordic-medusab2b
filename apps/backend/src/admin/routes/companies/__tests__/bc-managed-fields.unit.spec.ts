import {
  BC_MANAGED_COMPANY_FIELDS,
  BC_MANAGED_INDICATOR_LABEL,
  BC_MANAGED_WARNING_DESCRIPTION,
  BC_MANAGED_WARNING_TITLE,
} from "../bc-managed-fields";

describe("Business Central-managed company fields", () => {
  it("marks exactly the twelve fields synchronized from Business Central", () => {
    expect([...BC_MANAGED_COMPANY_FIELDS].sort()).toEqual(
      [
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip",
        "country",
        "blocked",
        "credit_limit",
        "vat_number",
        "currency_code",
      ].sort()
    );
  });

  it("warns that Business Central is authoritative and overwrites on login", () => {
    expect(BC_MANAGED_WARNING_TITLE).toMatch(/Business Central is authoritative/);
    expect(BC_MANAGED_WARNING_DESCRIPTION).toMatch(/overwritten/);
    expect(BC_MANAGED_WARNING_DESCRIPTION).toMatch(/customer from this company logs in/);
    expect(BC_MANAGED_WARNING_DESCRIPTION).toMatch(/Medusa-only fields are preserved/);
    expect(BC_MANAGED_WARNING_DESCRIPTION).toContain(BC_MANAGED_INDICATOR_LABEL);
  });
});

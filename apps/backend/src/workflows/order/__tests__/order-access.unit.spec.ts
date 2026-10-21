import { canAccessOrder, type OrderAccessFacts } from "../utils/order-access";

const OWNER = "cus_owner";
const COLLEAGUE = "cus_colleague";
const ADMIN = "cus_admin";
const COMPANY = "comp_a";
const OTHER_COMPANY = "comp_b";

type Approvals = NonNullable<OrderAccessFacts["source_cart"]>["approvals"];

function facts(overrides: Partial<OrderAccessFacts> = {}): OrderAccessFacts {
  return {
    caller: { id: OWNER, employee: { company_id: COMPANY, is_admin: false } },
    order: { customer_id: OWNER },
    source_cart: { customer_id: OWNER, company_id: COMPANY, approvals: [] },
    owner_company_id: COMPANY,
    ...overrides,
  };
}

function asAdmin(approvals: Approvals, overrides: Partial<OrderAccessFacts> = {}): OrderAccessFacts {
  return facts({
    caller: { id: ADMIN, employee: { company_id: COMPANY, is_admin: true } },
    source_cart: { customer_id: OWNER, company_id: COMPANY, approvals },
    ...overrides,
  });
}

const APPROVED: Approvals = [{ type: "admin", status: "approved" }];

// Reading an order and creating a return for it follow one rule (NIMBUS-177), so every case is
// the verdict for both operations.
describe("canAccessOrder", () => {
  describe("owner", () => {
    it("allows the owner", () => {
      expect(canAccessOrder(facts())).toBe(true);
    });

    it("allows the owner after leaving the company", () => {
      expect(canAccessOrder(facts({
        caller: { id: OWNER, employee: null },
        owner_company_id: null,
      }))).toBe(true);
    });

    it("allows the owner of an order with no source cart", () => {
      expect(canAccessOrder(facts({ source_cart: null }))).toBe(true);
    });
  });

  describe("company administrator", () => {
    it("allows an admin of the source cart's company once the admin approval is approved", () => {
      expect(canAccessOrder(asAdmin(APPROVED))).toBe(true);
    });

    it.each(["pending", "rejected"])("refuses with an admin approval in status %s", (status) => {
      expect(canAccessOrder(asAdmin([{ type: "admin", status }]))).toBe(false);
    });

    it("refuses without any approval", () => {
      expect(canAccessOrder(asAdmin([]))).toBe(false);
    });

    it("gets nothing from an approved sales-manager approval", () => {
      expect(canAccessOrder(asAdmin([{ type: "sales_manager", status: "approved" }]))).toBe(false);
    });

    it("refuses once the owner has left the company", () => {
      expect(canAccessOrder(asAdmin(APPROVED, { owner_company_id: null }))).toBe(false);
    });

    it("refuses once the owner has moved to another company", () => {
      expect(canAccessOrder(asAdmin(APPROVED, { owner_company_id: OTHER_COMPANY }))).toBe(false);
    });

    it("refuses when the order has no source cart", () => {
      expect(canAccessOrder(asAdmin(APPROVED, { source_cart: null }))).toBe(false);
    });

    it("refuses when the source cart has no company link", () => {
      expect(canAccessOrder(asAdmin(APPROVED, {
        source_cart: { customer_id: OWNER, company_id: null, approvals: APPROVED },
      }))).toBe(false);
    });

    it("refuses when the source cart belongs to someone other than the order's owner", () => {
      expect(canAccessOrder(asAdmin(APPROVED, {
        source_cart: { customer_id: COLLEAGUE, company_id: COMPANY, approvals: APPROVED },
      }))).toBe(false);
    });

    it("refuses an admin of another company", () => {
      expect(canAccessOrder(asAdmin(APPROVED, {
        caller: { id: ADMIN, employee: { company_id: OTHER_COMPANY, is_admin: true } },
      }))).toBe(false);
    });
  });

  describe("everyone else", () => {
    it("refuses a same-company colleague even with an approved admin approval", () => {
      expect(canAccessOrder(asAdmin(APPROVED, {
        caller: { id: COLLEAGUE, employee: { company_id: COMPANY, is_admin: false } },
      }))).toBe(false);
    });

    it("refuses a foreign customer with no employee record", () => {
      expect(canAccessOrder(facts({ caller: { id: COLLEAGUE, employee: null } }))).toBe(false);
    });

    it.each([
      ["a customer", { id: COLLEAGUE, employee: null }],
      ["an administrator", { id: ADMIN, employee: { company_id: COMPANY, is_admin: true } }],
    ] as const)("refuses %s an order without a customer", (_label, caller) => {
      expect(canAccessOrder(asAdmin(APPROVED, {
        caller,
        order: { customer_id: null },
        source_cart: { customer_id: null, company_id: COMPANY, approvals: APPROVED },
        owner_company_id: null,
      }))).toBe(false);
    });
  });
});

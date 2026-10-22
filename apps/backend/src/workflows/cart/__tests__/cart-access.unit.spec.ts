import {
  canAccessCart,
  hasVerifiedCartAssociation,
  type CartAccessFacts,
  type CartOperation,
} from "../utils/cart-access";

const OPERATIONS: CartOperation[] = ["read", "owner", "pay"];

const OWNER = "cus_owner";
const COLLEAGUE = "cus_colleague";
const ADMIN = "cus_admin";
const COMPANY = "comp_a";
const OTHER_COMPANY = "comp_b";

function facts(overrides: Partial<CartAccessFacts> = {}): CartAccessFacts {
  return {
    caller: { id: OWNER, employee: { company_id: COMPANY, is_admin: false } },
    cart: { customer_id: OWNER, company_id: COMPANY, approvals: [] },
    owner_company_id: COMPANY,
    ...overrides,
  };
}

function asAdmin(
  approvals: CartAccessFacts["cart"]["approvals"],
  overrides: Partial<CartAccessFacts> = {},
): CartAccessFacts {
  return facts({
    caller: { id: ADMIN, employee: { company_id: COMPANY, is_admin: true } },
    cart: { customer_id: OWNER, company_id: COMPANY, approvals },
    ...overrides,
  });
}

describe("canAccessCart", () => {
  describe("owner", () => {
    it.each(OPERATIONS)("allows the owner of a verified cart to %s", (operation) => {
      expect(canAccessCart(operation, facts())).toBe(true);
    });

    it.each(OPERATIONS)("refuses an owner who left the company to %s", (operation) => {
      expect(canAccessCart(operation, facts({ owner_company_id: null }))).toBe(false);
    });

    it.each(OPERATIONS)("refuses an owner who changed company to %s", (operation) => {
      expect(canAccessCart(operation, facts({
        caller: { id: OWNER, employee: { company_id: OTHER_COMPANY, is_admin: false } },
        owner_company_id: OTHER_COMPANY,
      }))).toBe(false);
    });

    it.each(OPERATIONS)("allows a non-employee owner of an unlinked cart to %s", (operation) => {
      expect(canAccessCart(operation, facts({
        caller: { id: OWNER, employee: null },
        cart: { customer_id: OWNER, company_id: null, approvals: [] },
        owner_company_id: null,
      }))).toBe(true);
    });
  });

  describe("colleague and outsiders", () => {
    it.each(OPERATIONS)("refuses a same-company colleague to %s", (operation) => {
      expect(canAccessCart(operation, facts({
        caller: { id: COLLEAGUE, employee: { company_id: COMPANY, is_admin: false } },
        cart: {
          customer_id: OWNER,
          company_id: COMPANY,
          approvals: [{ type: "admin", status: "approved" }],
        },
      }))).toBe(false);
    });

    it.each(OPERATIONS)("refuses a non-employee caller on a linked cart to %s", (operation) => {
      expect(canAccessCart(operation, facts({
        caller: { id: COLLEAGUE, employee: null },
      }))).toBe(false);
    });

    it.each(OPERATIONS)("refuses an admin of another company to %s", (operation) => {
      expect(canAccessCart(operation, asAdmin(
        [{ type: "admin", status: "approved" }],
        { caller: { id: ADMIN, employee: { company_id: OTHER_COMPANY, is_admin: true } } },
      ))).toBe(false);
    });
  });

  describe("company administrator", () => {
    it.each(["pending", "approved", "rejected"])(
      "allows read with an admin approval in status %s",
      (status) => {
        expect(canAccessCart("read", asAdmin([{ type: "admin", status }]))).toBe(true);
      },
    );

    it("refuses read without any approval", () => {
      expect(canAccessCart("read", asAdmin([]))).toBe(false);
    });

    it("allows pay only with an approved admin approval", () => {
      expect(canAccessCart("pay", asAdmin([{ type: "admin", status: "approved" }]))).toBe(true);
    });

    it.each(["pending", "rejected"])("refuses pay with an admin approval in status %s", (status) => {
      expect(canAccessCart("pay", asAdmin([{ type: "admin", status }]))).toBe(false);
    });

    it.each(["pending", "approved", "rejected"])(
      "never allows owner operations (admin approval %s)",
      (status) => {
        expect(canAccessCart("owner", asAdmin([{ type: "admin", status }]))).toBe(false);
      },
    );

    it.each(OPERATIONS)("gets nothing from sales-manager approvals to %s", (operation) => {
      expect(canAccessCart(operation, asAdmin([
        { type: "sales_manager", status: "approved" },
        { type: "sales_manager", status: "pending" },
      ]))).toBe(false);
    });

    it.each(OPERATIONS)("refuses %s once the owner has left the company", (operation) => {
      expect(canAccessCart(operation, asAdmin(
        [{ type: "admin", status: "approved" }],
        { owner_company_id: null },
      ))).toBe(false);
    });

    it.each(OPERATIONS)("refuses a non-admin with an approved admin approval to %s", (operation) => {
      expect(canAccessCart(operation, asAdmin(
        [{ type: "admin", status: "approved" }],
        { caller: { id: ADMIN, employee: { company_id: COMPANY, is_admin: false } } },
      ))).toBe(false);
    });
  });

  describe("ambiguous carts", () => {
    const approved = [{ type: "admin", status: "approved" }];
    const callers: [string, CartAccessFacts["caller"]][] = [
      ["owner", { id: OWNER, employee: { company_id: COMPANY, is_admin: true } }],
      ["admin", { id: ADMIN, employee: { company_id: COMPANY, is_admin: true } }],
    ];

    describe.each(callers)("for the %s", (_name, caller) => {
      it.each(OPERATIONS)("refuses a cart with no owner to %s", (operation) => {
        expect(canAccessCart(operation, facts({
          caller,
          cart: { customer_id: null, company_id: COMPANY, approvals: approved },
        }))).toBe(false);
      });

      it.each(OPERATIONS)("refuses an employee owner's unlinked cart to %s", (operation) => {
        expect(canAccessCart(operation, facts({
          caller,
          cart: { customer_id: OWNER, company_id: null, approvals: approved },
        }))).toBe(false);
      });

      it.each(OPERATIONS)("refuses a cart linked to another company than the owner's to %s",
        (operation) => {
          expect(canAccessCart(operation, facts({
            caller,
            cart: { customer_id: OWNER, company_id: COMPANY, approvals: approved },
            owner_company_id: OTHER_COMPANY,
          }))).toBe(false);
        });
    });
  });
});

describe("hasVerifiedCartAssociation", () => {
  it("holds when the link equals the owner's current company", () => {
    expect(hasVerifiedCartAssociation({ customer_id: OWNER, company_id: COMPANY }, COMPANY))
      .toBe(true);
  });

  it("holds for an unlinked cart whose owner has no employee record", () => {
    expect(hasVerifiedCartAssociation({ customer_id: OWNER, company_id: null }, null)).toBe(true);
  });

  it("fails without an owner", () => {
    expect(hasVerifiedCartAssociation({ customer_id: null, company_id: null }, null)).toBe(false);
  });

  it("fails when the link differs from the owner's company", () => {
    expect(hasVerifiedCartAssociation({ customer_id: OWNER, company_id: COMPANY }, OTHER_COMPANY))
      .toBe(false);
  });

  it("fails for a linked cart whose owner has no employee record", () => {
    expect(hasVerifiedCartAssociation({ customer_id: OWNER, company_id: COMPANY }, null))
      .toBe(false);
  });
});

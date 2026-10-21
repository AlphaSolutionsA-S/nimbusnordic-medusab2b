import { canRequestOrderTransfer } from "../utils/order-transfer";

describe("canRequestOrderTransfer", () => {
  it("refuses an order owned by a customer with an account", () => {
    expect(canRequestOrderTransfer({ has_account: true })).toBe(false);
  });

  it("allows an order owned by a guest customer", () => {
    expect(canRequestOrderTransfer({ has_account: false })).toBe(true);
  });

  it("allows an order with no customer", () => {
    expect(canRequestOrderTransfer(null)).toBe(true);
  });
});

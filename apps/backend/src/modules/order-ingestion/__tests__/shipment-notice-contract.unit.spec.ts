import {
  ShipmentNoticeEnvelopeSchema,
  ShipmentNoticeErrorBodySchema,
  ShipmentNoticePayloadSchema,
} from "../shipment-notice-contract";
import { shipmentNoticeEnvelopeExample } from "../__fixtures__/shipment-notice-fixtures";

const [firstNotice] = shipmentNoticeEnvelopeExample.shipment_notices;

function envelopeWith(notice: Record<string, unknown>) {
  return { ...shipmentNoticeEnvelopeExample, shipment_notices: [notice] };
}

describe("ShipmentNoticeEnvelopeSchema", () => {
  it("accepts the contract's JSON example", () => {
    expect(ShipmentNoticeEnvelopeSchema.safeParse(shipmentNoticeEnvelopeExample).success).toBe(true);
  });

  it("accepts an empty page with no cursor", () => {
    const result = ShipmentNoticeEnvelopeSchema.safeParse({
      shipment_notices: [],
      next_cursor: null,
      has_more: false,
    });

    expect(result.success).toBe(true);
  });

  it.each(["shipped", "revised", "cancelled"])("accepts status %s", (status) => {
    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith({ ...firstNotice, status })).success).toBe(
      true
    );
  });

  it("rejects an unknown status", () => {
    const result = ShipmentNoticeEnvelopeSchema.safeParse(
      envelopeWith({ ...firstNotice, status: "delivered" })
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ["a number", 1041],
    ["a non-decimal string", "abc"],
  ])("rejects a cursor that is %s", (_label, cursor) => {
    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith({ ...firstNotice, cursor })).success).toBe(
      false
    );
    expect(
      ShipmentNoticeEnvelopeSchema.safeParse({ ...shipmentNoticeEnvelopeExample, next_cursor: cursor })
        .success
    ).toBe(false);
  });

  it("rejects a notice without lines", () => {
    const { lines: _lines, ...withoutLines } = firstNotice;

    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith(withoutLines)).success).toBe(false);
  });

  it("rejects a notice with a field outside the contract", () => {
    const result = ShipmentNoticeEnvelopeSchema.safeParse(
      envelopeWith({ ...firstNotice, company_id: "comp_01" })
    );

    expect(result.success).toBe(false);
  });

  it("rejects a recorded_at that is not an ISO 8601 UTC timestamp", () => {
    const result = ShipmentNoticeEnvelopeSchema.safeParse(
      envelopeWith({ ...firstNotice, recorded_at: "2026-10-20 07:32" })
    );

    expect(result.success).toBe(false);
  });

  it("rejects a shipment_date that is not YYYY-MM-DD", () => {
    const result = ShipmentNoticeEnvelopeSchema.safeParse(
      envelopeWith({ ...firstNotice, shipment_date: "20-10-2026" })
    );

    expect(result.success).toBe(false);
  });

  it("accepts null in every nullable field", () => {
    const nullParty = {
      customer_number: null,
      name: null,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state: null,
      post_code: null,
      country: null,
    };
    const notice = {
      ...firstNotice,
      previous_cursor: null,
      shipment_method_code: null,
      your_reference: null,
      sell_to: nullParty,
      bill_to: nullParty,
      ship_to: {
        name: null,
        contact: null,
        address_line_1: null,
        address_line_2: null,
        city: null,
        state: null,
        post_code: null,
        country: null,
      },
      lines: firstNotice.lines.map((line) => ({
        ...line,
        line_number: null,
        ean_no: null,
        description: null,
        description_2: null,
        unit_of_measure_code: null,
        variant_code: null,
      })),
    };

    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith(notice)).success).toBe(true);
  });

  it("carries a sized and an unsized line in the example", () => {
    expect(firstNotice.lines.map((line) => line.variant_code)).toEqual(["M", null]);
  });

  it("rejects a line without variant_code", () => {
    const { variant_code: _variantCode, ...withoutSize } = firstNotice.lines[0];
    const notice = { ...firstNotice, lines: [withoutSize] };

    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith(notice)).success).toBe(false);
  });

  it("rejects a variant_code that is not a string", () => {
    const notice = { ...firstNotice, lines: [{ ...firstNotice.lines[0], variant_code: 5 }] };

    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith(notice)).success).toBe(false);
  });

  it.each(["bc_line_number", "item_number", "quantity"])("rejects null in required line field %s", (field) => {
    const notice = {
      ...firstNotice,
      lines: [{ ...firstNotice.lines[0], [field]: null }],
    };

    expect(ShipmentNoticeEnvelopeSchema.safeParse(envelopeWith(notice)).success).toBe(false);
  });
});

describe("ShipmentNoticePayloadSchema", () => {
  it("accepts a notice without the row-column fields", () => {
    const { cursor, previous_cursor, recorded_at, revision, status, ...payload } = firstNotice;

    expect(ShipmentNoticePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a payload that carries a row-column field", () => {
    const { cursor, previous_cursor, recorded_at, status, ...payload } = firstNotice;

    expect(ShipmentNoticePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe("ShipmentNoticeErrorBodySchema", () => {
  it.each([
    ["Medusa's body", { type: "not_found", message: "Customer not found" }],
    ["Medusa's body with a code", { type: "invalid_data", message: "Invalid request", code: "invalid_request_error" }],
    ["the gateway's body", { error: "Token not recognized" }],
    ["the gateway's body with a message", { error: "Unauthorized", message: "Not allowed" }],
  ])("accepts %s", (_label, body) => {
    expect(ShipmentNoticeErrorBodySchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ["a body with neither type nor error", { message: "Customer not found" }],
    ["a Medusa body without a message", { type: "not_found" }],
  ])("rejects %s", (_label, body) => {
    expect(ShipmentNoticeErrorBodySchema.safeParse(body).success).toBe(false);
  });
});

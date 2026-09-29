import { mapCanonicalOrderHeader } from "../utils/map-canonical-order-header";
import {
  multiLineCanonicalOrder,
  singleLineCanonicalOrder,
} from "../../../modules/order-ingestion/__fixtures__/canonical-order-fixtures";

describe("mapCanonicalOrderHeader", () => {
  it("TC-1: maps shipTo and billTo onto shipping/billing addresses with the order phone on both", () => {
    const header = mapCanonicalOrderHeader({
      ...multiLineCanonicalOrder,
      email: "orders@example.com",
      phoneNumber: "+45 12 34 56 78",
      billTo: {
        name: "METZ A/S",
        addressLine1: "Skelstedet 9",
        city: "Vedbæk",
        postCode: "2950",
        country: "DK",
      },
    });

    expect(header.currency_code).toEqual("DKK");
    expect(header.email).toEqual("orders@example.com");
    expect(header.shipping_address).toEqual({
      company: "JK Tryk",
      first_name: "3. Parts Nimbus",
      address_1: "Industrikrogen 11B",
      address_2: null,
      city: "Rønnede",
      province: null,
      postal_code: "4683",
      country_code: "dk",
      phone: "+45 12 34 56 78",
    });
    expect(header.billing_address).toEqual({
      company: "METZ A/S",
      first_name: null,
      address_1: "Skelstedet 9",
      address_2: null,
      city: "Vedbæk",
      province: null,
      postal_code: "2950",
      country_code: "dk",
      phone: "+45 12 34 56 78",
    });
  });

  it("TC-2: leaves both addresses undefined when the canonical order has none", () => {
    const header = mapCanonicalOrderHeader(singleLineCanonicalOrder);

    expect(header.currency_code).toEqual("DKK");
    expect(header.shipping_address).toBeUndefined();
    expect(header.billing_address).toBeUndefined();
  });
});

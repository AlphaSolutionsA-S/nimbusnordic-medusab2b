import type { CanonicalOrder } from "../canonical-order-schema";

// Derived from issues/NIMBUS-129/example edi files/order1.xml
export const singleLineCanonicalOrder: CanonicalOrder = {
  externalOrderNumber: "FLS190518",
  orderDate: "27-08-2026",
  currencyCode: "DKK",
  lines: [
    {
      lineNumber: 1,
      itemNumber: "FLS-NIM-VESPERMNA-XL",
      custItemNo: "FLS-NIM-VESPERMNA-XL",
      eanNo: "5712094145752",
      description: "Vesper Vest Unisex, Navy - XL",
      quantity: 1,
      unitPrice: 134.75,
    },
  ],
};

// Derived from issues/NIMBUS-129/example edi files/order2.xml
export const multiLineCanonicalOrder: CanonicalOrder = {
  externalOrderNumber: "NKT004061",
  orderDate: "26-08-2026",
  currencyCode: "DKK",
  shipTo: {
    name: "JK Tryk",
    contact: "3. Parts Nimbus",
    addressLine1: "Industrikrogen 11B",
    city: "Rønnede",
    postCode: "4683",
    country: "DK",
  },
  lines: [
    {
      lineNumber: 1,
      itemNumber: "NKT-NIM-TELLURIDENA-S",
      custItemNo: "NKT-NIM-TELLURIDENA-S",
      eanNo: "5712094143628",
      description: "Telluride Jacket, Unisex, Navy - S",
      quantity: 1,
      unitPrice: 209.25,
    },
    {
      lineNumber: 2,
      itemNumber: "NKT-NIM-TELLURIDENA-M",
      custItemNo: "NKT-NIM-TELLURIDENA-M",
      eanNo: "5712094143635",
      description: "Telluride Jacket, Unisex, Navy - M",
      quantity: 10,
      unitPrice: 209.25,
    },
  ],
};

// The sender EAN endpoint id from both sample files' <SenderEndpointID qualifier="EAN">.
export const sampleCustomerNumber = "579000283084";

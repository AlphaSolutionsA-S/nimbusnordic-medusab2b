import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
} from "@medusajs/framework/types";
import type {
  CanonicalOrder,
  CanonicalOrderAddress,
} from "../../../modules/order-ingestion/canonical-order-schema";

export type CanonicalOrderHeaderColumns = Pick<
  CreateOrderDTO,
  "currency_code" | "email" | "shipping_address" | "billing_address"
>;

function mapCanonicalAddress(
  address: CanonicalOrderAddress,
  phoneNumber: string | undefined
): CreateOrderAddressDTO {
  return {
    company: address.name,
    first_name: address.contact ?? null,
    address_1: address.addressLine1,
    address_2: address.addressLine2 ?? null,
    city: address.city,
    province: address.state ?? null,
    postal_code: address.postCode,
    country_code: address.country.toLowerCase(),
    phone: phoneNumber ?? null,
  };
}

/*
  Maps the canonical order header onto the native Medusa Order columns it fits. Everything else —
  including the order lines — lives only in metadata.canonical_order.
*/
export function mapCanonicalOrderHeader(
  canonicalOrder: CanonicalOrder
): CanonicalOrderHeaderColumns {
  return {
    currency_code: canonicalOrder.currencyCode,
    email: canonicalOrder.email,
    shipping_address: canonicalOrder.shipTo
      ? mapCanonicalAddress(canonicalOrder.shipTo, canonicalOrder.phoneNumber)
      : undefined,
    billing_address: canonicalOrder.billTo
      ? mapCanonicalAddress(canonicalOrder.billTo, canonicalOrder.phoneNumber)
      : undefined,
  };
}

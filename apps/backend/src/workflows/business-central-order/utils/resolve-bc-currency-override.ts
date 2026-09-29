import { resolveCurrencyCode } from "../../company/steps/prepare-company-bc-sync";

/*
  The order's currency is sent to Business Central only as an override. When it matches the BC
  customer's own currency it is omitted, so BC applies the customer default. A blank BC customer
  currency means local currency (LCY) and is resolved exactly as the company sync resolves it
  (NIMBUS-147, d90c26a): BUSINESS_CENTRAL_LCY_CODE, default DKK.
*/
export function resolveBcCurrencyOverride(
  orderCurrencyCode: string,
  bcCustomerCurrencyCode: string | null
): string | undefined {
  const orderCurrency = orderCurrencyCode.trim().toUpperCase();
  const customerCurrency = resolveCurrencyCode(bcCustomerCurrencyCode).toUpperCase();

  return orderCurrency === customerCurrency ? undefined : orderCurrency;
}

import { getBusinessCentralLocalCurrency } from "../../../modules/business-central/environment-config";
import type { BusinessCentralEnvironment } from "../../../modules/business-central/types";

/*
  A blank Currency Code on a Business Central customer is not missing data — it means the
  customer transacts in the local currency (LCY) of the environment the card lives in, the normal
  state for domestic customers. Resolve it to an explicit code so Company.currency_code is always
  populated.
*/
export function resolveCurrencyCode(
  environment: BusinessCentralEnvironment,
  bcCurrencyCode: string | null
): string {
  const currencyCode = bcCurrencyCode?.trim();

  return currencyCode || getBusinessCentralLocalCurrency(environment);
}

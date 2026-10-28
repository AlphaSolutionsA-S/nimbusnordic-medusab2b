import type { BusinessCentralEnvironment } from '../modules/business-central/types';

/*
  The single home of "which Business Central a company belongs to" (NIMBUS-261): only a stored
  country of `NO` routes to Norway. The BC sync writes the card's upper-case code and the Admin
  form a lower-case `iso_2`, so case and surrounding whitespace are ignored; anything else,
  blank included, stays on Denmark.
*/
export function getBusinessCentralEnvironmentForCountry(
  country: string | null | undefined,
): BusinessCentralEnvironment {
  return country?.trim().toUpperCase() === 'NO' ? 'NO' : 'DK';
}

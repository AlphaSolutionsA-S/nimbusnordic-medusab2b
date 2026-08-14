const DEFAULT_STOREFRONT_URL = 'http://localhost:8000';
const DEFAULT_COUNTRY_CODE = 'dk';
const DEFAULT_CMS_URL = 'http://localhost:3000';

function getStorefrontURL(): URL {
  const configuredURL = process.env.STOREFRONT_URL;
  const url = new URL(configuredURL || DEFAULT_STOREFRONT_URL);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STOREFRONT_URL must use HTTP or HTTPS.');
  }

  if (configuredURL && process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('STOREFRONT_URL must use HTTPS in production.');
  }

  return url;
}

function getCountryCode(): string {
  const countryCode = process.env.STOREFRONT_DEFAULT_COUNTRY || DEFAULT_COUNTRY_CODE;

  if (!/^[a-z]{2}$/.test(countryCode)) {
    throw new Error('STOREFRONT_DEFAULT_COUNTRY must be a lowercase ISO-2 country code.');
  }

  return countryCode;
}

export function getClaimsPreviewURL(): string {
  const url = getStorefrontURL();
  url.pathname = `/${getCountryCode()}/account/claims`;
  url.search = '';
  url.searchParams.set('livePreview', 'true');
  url.hash = '';

  return url.toString();
}

export function getStorefrontOrigin(): string {
  return getStorefrontURL().origin;
}

export function getPayloadOrigin(): string {
  const configuredURL = process.env.PAYLOAD_PUBLIC_URL;
  const azureHostname = process.env.WEBSITE_HOSTNAME;
  const url = new URL(
    configuredURL || (azureHostname ? `https://${azureHostname}` : DEFAULT_CMS_URL),
  );

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PAYLOAD_PUBLIC_URL must use HTTP or HTTPS.');
  }

  if (
    (configuredURL || azureHostname) &&
    process.env.NODE_ENV === 'production' &&
    url.protocol !== 'https:'
  ) {
    throw new Error('PAYLOAD_PUBLIC_URL must use HTTPS in production.');
  }

  return url.origin;
}

import { MedusaError } from "@medusajs/framework/utils";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Origin of email links: the first STORE_CORS origin. It is deployment-owned; request origins and
 * redirect URLs never choose where an email links to. Plain HTTP is allowed only for local hosts.
 */
export function emailStorefrontOrigin(storeCors: string): string {
  let storefront: URL;
  try {
    storefront = new URL(storeCors.split(",")[0].trim());
  } catch {
    throw invalidConfiguration();
  }
  const secure =
    storefront.protocol === "https:" ||
    (storefront.protocol === "http:" && LOCAL_HOSTS.includes(storefront.hostname));
  if (storefront.username || storefront.password || !secure) {
    throw invalidConfiguration();
  }
  return storefront.origin;
}

function invalidConfiguration(): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, "Email storefront configuration is invalid");
}

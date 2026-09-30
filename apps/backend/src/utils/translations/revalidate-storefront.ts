import type { Logger } from "@medusajs/framework/types";
import type { RefreshInput } from "../../types/storefront-translation";

export const STOREFRONT_REFRESH_TIMEOUT_MS = 3000;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function configuredTarget(): URL | "not_configured" | "invalid_url" | "insecure_url" {
  const value = process.env.STOREFRONT_TRANSLATION_REVALIDATE_URL;
  if (!value || !process.env.REVALIDATE_SECRET) {
    return "not_configured";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid_url";
  }
  if (url.username || url.password) {
    return "invalid_url";
  }
  const secure = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  return secure ? url : "insecure_url";
}

/** Releases the connection; the callback response body is never read. */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Nothing to release; the refresh outcome is already decided by the status.
  }
}

/**
 * Asks the storefront to invalidate one locale's cache after a committed change. The URL comes only
 * from server configuration. Never throws: any failure returns "deferred" and the storefront's timed
 * refresh picks the change up. Logs carry a reason code, locale and version, never the secret, URL
 * or payload.
 */
export async function revalidateStorefrontTranslations(
  input: RefreshInput,
  logger: Logger
): Promise<"requested" | "deferred"> {
  const describe = (reason: string) =>
    `Storefront translation refresh deferred (reason=${reason}, locale=${input.locale}, version=${input.version})`;
  const target = configuredTarget();
  if (typeof target === "string") {
    logger.warn(describe(target));
    return "deferred";
  }
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REVALIDATE_SECRET}`,
      },
      body: JSON.stringify({ locale: input.locale, version: input.version, is_active: input.is_active }),
      redirect: "error",
      signal: AbortSignal.timeout(STOREFRONT_REFRESH_TIMEOUT_MS),
    });
    await discardBody(response);
    if (!response.ok) {
      logger.warn(describe(`status_${response.status}`));
      return "deferred";
    }
    return "requested";
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    logger.warn(describe(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network"));
    return "deferred";
  }
}

import { authenticate } from "@medusajs/framework";

/**
 * Admin authentication that accepts only the dashboard's session cookie. The global /admin
 * authentication also accepts bearer tokens and secret API keys; this stricter check replaces
 * its result, so the handler runs only with a current session. Logging out of the dashboard
 * (DELETE /auth/session) therefore ends access. MFA enforcement stays on (framework default).
 */
export const requireAdminSession = authenticate("user", ["session"]);

/** Small JSON command bodies (a locale, a flag and a version) never need more than 1 KiB. */
export const smallJsonBodyParser = { sizeLimit: 1024 };

import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

// The framework error handler replaces every conflict message with generic text, so a route
// could not tell the operator which rule refused the change. Workflow errors may arrive
// serialized, so the type and message are read defensively.
function errorField(error: unknown, field: "type" | "message"): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

/** Answers a domain conflict with 409 and its own message; returns false for any other error. */
export function respondToConflict(res: MedusaResponse, error: unknown): boolean {
  if (errorField(error, "type") !== MedusaError.Types.CONFLICT) {
    return false;
  }
  res.status(409).json({
    type: MedusaError.Types.CONFLICT,
    // The code the framework handler sends with a conflict, so clients see one shape.
    code: "invalid_state_error",
    message: errorField(error, "message") ?? "The request conflicted with the current state.",
  });
  return true;
}

/**
 * Answers a domain conflict with its own message (409) and an unavailable country-language
 * configuration with a generic 503. Returns false for anything else, which the caller rethrows
 * so the framework error handler keeps its normal behaviour.
 */
export function respondToWorkflowError(res: MedusaResponse, error: unknown): boolean {
  if (respondToConflict(res, error)) {
    return true;
  }
  if (errorField(error, "type") === MedusaError.Types.UNEXPECTED_STATE) {
    // The stored reason may describe database internals; callers only learn it is unavailable.
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ type: "unavailable", message: "Country languages are not available" });
    return true;
  }
  return false;
}

/** Runs a read or write, answering with its result as no-store JSON or a mapped domain error. */
export async function sendWorkflowResult<T>(
  res: MedusaResponse,
  run: () => Promise<{ result: T }>
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { result } = await run();
    res.status(200).json(result);
  } catch (error) {
    if (!respondToWorkflowError(res, error)) {
      throw error;
    }
  }
}

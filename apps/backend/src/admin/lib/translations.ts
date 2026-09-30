/** Language used for placeholder comparison and the default "compare with" source. */
export const REFERENCE_LOCALE = "en";

/** The storefront languages that must be imported once per environment before the storefront switch. */
export const INITIAL_IMPORT_LOCALES = ["da", "de", "en", "fr", "it", "no", "pl", "sv"] as const;

export function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

/** Validation messages from our own routes are safe to show; anything else gets a generic message. */
export function safeErrorMessage(error: unknown): string {
  const status = errorStatus(error);
  if (status === 409) {
    return "Someone else changed this language. Reload it and try again.";
  }
  if ((status === 400 || status === 404) && error instanceof Error && error.message) {
    return error.message;
  }
  if (status === 413) {
    return "The file is too large.";
  }
  return "Something went wrong. Your input is still here; please try again.";
}

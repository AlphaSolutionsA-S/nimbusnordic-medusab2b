import type { SendNotificationsStepInput } from "@medusajs/medusa/core-flows";

import type { MessageDocument, MissingReport } from "../../../types/storefront-translation";
import type { EmailLanguage } from "./email-language";

export interface EmailLocalization extends EmailLanguage {
  /** Active document of the chosen language; null when that language is not active. */
  chosen: MessageDocument | null;
  /** Active English document; null when English is not active. */
  english: MessageDocument | null;
}

/** A built email: the notification to send and the text fallbacks to report after sending. */
export type PreparedEmail = {
  notification: SendNotificationsStepInput[number];
  fallbacks: MissingReport[];
};

/** A subject is a mail header, not HTML: only line breaks are a risk, so all whitespace collapses to one space. */
export function emailSubject(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { MedusaError } from "@medusajs/framework/utils";

import type { MessageDocument, MissingReport } from "../../../types/storefront-translation";
import { DEFAULT_COUNTRY_LOCALE } from "../../../modules/storefront-translation/country-languages";

export interface EmailTextsInput {
  /** Full key → built-in English copy, the approved last fallback (NIMBUS-162). */
  keys: Record<string, string>;
  locale: string;
  /** The chosen language's active document; null when that language is unavailable. */
  chosen: MessageDocument | null;
  english: MessageDocument | null;
  /** Placeholder values; filled as plain text, never parsed. */
  values: Record<string, string>;
  /** Report label stored as `page_path`; must not contain personal data. */
  source: string;
}

export interface EmailTexts {
  /** Plain, filled and unescaped: the builder escapes every text. */
  texts: Record<string, string>;
  fallbacks: MissingReport[];
}

type Lookup = { state: "missing" } | { state: "unusable" } | { state: "ok"; text: string };

function textAt(document: MessageDocument, key: string): string | undefined {
  let node: string | MessageDocument | undefined = document;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || !Object.prototype.hasOwnProperty.call(node, segment)) {
      return undefined;
    }
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Only literal text and simple `{name}` placeholders with a supplied value are usable. Tags are read
 * as literal text (the builder escapes them); plurals, formats and parse errors make the text unusable.
 */
function fill(text: string, values: Record<string, string>): string | null {
  let elements: MessageFormatElement[];
  try {
    elements = parse(text, { ignoreTag: true });
  } catch {
    return null;
  }
  let result = "";
  for (const element of elements) {
    if (element.type === TYPE.literal) {
      result += element.value;
    } else if (
      element.type === TYPE.argument &&
      Object.prototype.hasOwnProperty.call(values, element.value)
    ) {
      result += values[element.value];
    } else {
      return null;
    }
  }
  return result;
}

function lookup(document: MessageDocument, key: string, values: Record<string, string>): Lookup {
  const text = textAt(document, key);
  if (text === undefined || text.trim() === "") {
    return { state: "missing" };
  }
  const filled = fill(text, values);
  return filled === null ? { state: "unusable" } : { state: "ok", text: filled };
}

/**
 * Per key: the chosen language, else English, else the built-in copy. A missing or blank text is
 * reported for its language; an unusable one is skipped without a report, and a language whose
 * document is unavailable is skipped without reports.
 */
export function resolveEmailTexts(input: EmailTextsInput): EmailTexts {
  const sources: { locale: string; document: MessageDocument | null }[] = [
    ...(input.locale === DEFAULT_COUNTRY_LOCALE ? [] : [{ locale: input.locale, document: input.chosen }]),
    { locale: DEFAULT_COUNTRY_LOCALE, document: input.english },
  ];
  const texts: Record<string, string> = {};
  const fallbacks: MissingReport[] = [];

  for (const [key, builtIn] of Object.entries(input.keys)) {
    let text: string | null = null;
    for (const { locale, document } of sources) {
      if (!document) {
        continue;
      }
      const found = lookup(document, key, input.values);
      if (found.state === "ok") {
        text = found.text;
        break;
      }
      if (found.state === "missing") {
        fallbacks.push({ kind: "key", locale, key, page_path: input.source });
      }
    }
    if (text === null) {
      text = fill(builtIn, input.values);
    }
    if (text === null) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Built-in email text "${key}" cannot be filled with the supplied values`
      );
    }
    texts[key] = text;
  }
  return { texts, fallbacks };
}

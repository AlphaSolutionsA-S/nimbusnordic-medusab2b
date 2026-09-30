import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import type { IcuWarning, MessageDocument } from "../../types/storefront-translation";
import { flattenMessages } from "./documents";

// Browser-safe: used by the backend when saving and importable by Admin.

interface Signature {
  arguments: Map<string, string>;
  tags: Set<string>;
  selects: Map<string, string>;
}

function argumentKind(element: MessageFormatElement): string | null {
  switch (element.type) {
    case TYPE.argument:
      return "text";
    case TYPE.number:
      return "number";
    case TYPE.date:
      return "date";
    case TYPE.time:
      return "time";
    case TYPE.select:
      return "select";
    case TYPE.plural:
      return element.pluralType === "ordinal" ? "selectordinal" : "plural";
    default:
      return null;
  }
}

function collect(elements: MessageFormatElement[], signature: Signature): void {
  for (const element of elements) {
    const kind = argumentKind(element);
    if (kind && "value" in element) {
      signature.arguments.set(element.value, kind);
    }
    if (element.type === TYPE.select) {
      // Plural categories legitimately differ between languages; select options do not.
      signature.selects.set(element.value, Object.keys(element.options).sort().join(","));
    }
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) {
        collect(option.value, signature);
      }
    }
    if (element.type === TYPE.tag) {
      signature.tags.add(element.value);
      collect(element.children, signature);
    }
  }
}

function signatureOf(message: string): Signature {
  const signature: Signature = { arguments: new Map(), tags: new Set(), selects: new Map() };
  collect(parse(message), signature);
  return signature;
}

function describe(names: Iterable<string>): string {
  return [...names].sort().join(", ");
}

function compareSignatures(key: string, current: Signature, reference: Signature): IcuWarning[] {
  const warnings: IcuWarning[] = [];
  const missing = [...reference.arguments.keys()].filter((name) => !current.arguments.has(name));
  const extra = [...current.arguments.keys()].filter((name) => !reference.arguments.has(name));
  const changedKind = [...current.arguments].filter(
    ([name, kind]) => reference.arguments.has(name) && reference.arguments.get(name) !== kind
  );
  if (missing.length || extra.length || changedKind.length) {
    const parts = [
      missing.length ? `missing {${describe(missing)}}` : "",
      extra.length ? `unexpected {${describe(extra)}}` : "",
      changedKind.length ? `different format for {${describe(changedKind.map(([name]) => name))}}` : "",
    ].filter(Boolean);
    warnings.push({ key, code: "arguments", message: `Placeholders differ from reference: ${parts.join("; ")}` });
  }
  const tagsDiffer =
    current.tags.size !== reference.tags.size ||
    [...reference.tags].some((tag) => !current.tags.has(tag));
  const selectsDiffer = [...reference.selects].some(
    ([name, options]) => current.selects.has(name) && current.selects.get(name) !== options
  );
  if (tagsDiffer || selectsDiffer) {
    warnings.push({
      key,
      code: "structure",
      message: tagsDiffer
        ? `Rich-text tags differ from reference (expected <${describe(reference.tags)}>)`
        : "Select options differ from reference",
    });
  }
  return warnings;
}

/**
 * Warnings only: invalid ICU and differences from the reference never block a save.
 * Plural categories are not compared because valid categories differ between languages.
 */
export function compareIcu(messages: MessageDocument, reference: MessageDocument | null): IcuWarning[] {
  const warnings: IcuWarning[] = [];
  const referenceValues = reference ? flattenMessages(reference) : null;
  if (!referenceValues) {
    warnings.push({
      key: "",
      code: "reference_unavailable",
      message: "The English reference is not available, so placeholders were not compared",
    });
  }
  const values = flattenMessages(messages);
  for (const key of Object.keys(values).sort()) {
    let current: Signature;
    try {
      current = signatureOf(values[key]);
    } catch {
      warnings.push({ key, code: "invalid_icu", message: "The text is not valid ICU message syntax" });
      continue;
    }
    const referenceValue = referenceValues && Object.prototype.hasOwnProperty.call(referenceValues, key)
      ? referenceValues[key]
      : undefined;
    if (referenceValue === undefined) {
      continue;
    }
    try {
      warnings.push(...compareSignatures(key, current, signatureOf(referenceValue)));
    } catch {
      // An invalid reference value is reported when the reference language itself is saved.
    }
  }
  return warnings;
}

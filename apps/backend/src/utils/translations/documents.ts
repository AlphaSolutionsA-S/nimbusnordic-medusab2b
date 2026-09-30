import type { DocumentDiff, MessageDocument } from "../../types/storefront-translation";

// Browser-safe: the Admin bundle imports these helpers, so no Node or Medusa runtime imports.

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export class MessageDocumentError extends Error {
  readonly key: string;

  constructor(message: string, key: string) {
    super(message);
    this.name = "MessageDocumentError";
    this.key = key;
  }
}

function isGroup(value: unknown): value is MessageDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeSegment(segment: string, key: string): void {
  if (!segment || segment.includes(".") || FORBIDDEN_SEGMENTS.has(segment)) {
    throw new MessageDocumentError(`Invalid key segment in "${key}"`, key);
  }
}

function setOwn(target: MessageDocument, segment: string, value: string | MessageDocument): void {
  Object.defineProperty(target, segment, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function collectLeaves(document: MessageDocument, prefix: string, out: Map<string, string>): void {
  for (const segment of Object.keys(document)) {
    const value = document[segment];
    const key = prefix ? `${prefix}.${segment}` : segment;
    if (typeof value === "string") {
      out.set(key, value);
    } else if (isGroup(value)) {
      collectLeaves(value, key, out);
    }
  }
}

function leafMap(document: MessageDocument): Map<string, string> {
  const out = new Map<string, string>();
  collectLeaves(document, "", out);
  return out;
}

/** String leaves only. Empty groups are not represented; never rebuild a stored document from this. */
export function flattenMessages(document: MessageDocument): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of leafMap(document)) {
    setOwn(result, key, value);
  }
  return result;
}

export function unflattenMessages(values: Readonly<Record<string, string>>): MessageDocument {
  const root: MessageDocument = {};
  for (const key of Object.keys(values).sort()) {
    const segments = key.split(".");
    segments.forEach((segment) => assertSafeSegment(segment, key));
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      const existing = Object.prototype.hasOwnProperty.call(node, segment) ? node[segment] : undefined;
      if (typeof existing === "string") {
        throw new MessageDocumentError(`Key "${key}" collides with a text value`, key);
      }
      if (!existing) {
        const group: MessageDocument = {};
        setOwn(node, segment, group);
        node = group;
      } else {
        node = existing;
      }
    }
    const last = segments[segments.length - 1];
    if (Object.prototype.hasOwnProperty.call(node, last)) {
      throw new MessageDocumentError(`Key "${key}" collides with a group`, key);
    }
    setOwn(node, last, values[key]);
  }
  return root;
}

function replaceLeaves(
  document: MessageDocument,
  prefix: string,
  values: Readonly<Record<string, string>>
): MessageDocument {
  const result: MessageDocument = {};
  for (const segment of Object.keys(document)) {
    const value = document[segment];
    const key = prefix ? `${prefix}.${segment}` : segment;
    if (typeof value === "string") {
      setOwn(result, segment, values[key]);
    } else {
      setOwn(result, segment, replaceLeaves(value, key, values));
    }
  }
  return result;
}

/** Replaces values for the document's exact existing leaf-key set, preserving every group. */
export function updateMessageLeaves(
  document: MessageDocument,
  values: Readonly<Record<string, string>>
): MessageDocument {
  const existing = leafMap(document);
  const supplied = Object.keys(values);
  for (const key of supplied) {
    if (!existing.has(key)) {
      throw new MessageDocumentError(`Key "${key}" does not exist in this language`, key);
    }
    if (typeof values[key] !== "string") {
      throw new MessageDocumentError(`Value for "${key}" must be text`, key);
    }
  }
  if (supplied.length !== existing.size) {
    const missing = [...existing.keys()].find(
      (key) => !Object.prototype.hasOwnProperty.call(values, key)
    );
    throw new MessageDocumentError(`Key "${missing}" is missing from the update`, missing ?? "");
  }
  return replaceLeaves(document, "", values);
}

/** Whether two documents have the same shape (including empty groups) apart from leaf values. */
export function sameStructure(a: MessageDocument, b: MessageDocument): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((key, index) => key !== bKeys[index])) {
    return false;
  }
  return aKeys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (typeof left === "string" || typeof right === "string") {
      return typeof left === typeof right;
    }
    return sameStructure(left, right);
  });
}

export function diffMessages(current: MessageDocument, candidate: MessageDocument): DocumentDiff {
  const before = leafMap(current);
  const after = leafMap(candidate);
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  const empty: string[] = [];
  for (const [key, value] of after) {
    if (!before.has(key)) {
      added.push(key);
    } else if (before.get(key) !== value) {
      changed.push(key);
    }
    if (value.trim() === "") {
      empty.push(key);
    }
  }
  for (const key of before.keys()) {
    if (!after.has(key)) {
      removed.push(key);
    }
  }
  return {
    added: added.sort(),
    changed: changed.sort(),
    removed: removed.sort(),
    empty: empty.sort(),
  };
}

function mergeInto(current: MessageDocument, incoming: MessageDocument, prefix: string): MessageDocument {
  const result: MessageDocument = {};
  for (const segment of Object.keys(current)) {
    setOwn(result, segment, current[segment]);
  }
  for (const segment of Object.keys(incoming)) {
    const key = prefix ? `${prefix}.${segment}` : segment;
    const next = incoming[segment];
    const previous = Object.prototype.hasOwnProperty.call(current, segment)
      ? current[segment]
      : undefined;
    if (previous === undefined) {
      setOwn(result, segment, next);
    } else if (typeof previous === "string" && typeof next === "string") {
      setOwn(result, segment, next);
    } else if (isGroup(previous) && isGroup(next)) {
      setOwn(result, segment, mergeInto(previous, next, key));
    } else {
      throw new MessageDocumentError(
        `Key "${key}" is text in one document and a group in the other`,
        key
      );
    }
  }
  return result;
}

/** Immutable deep merge: supplied leaves overwrite, omitted keys survive, structural conflicts throw. */
export function mergeMessages(current: MessageDocument, incoming: MessageDocument): MessageDocument {
  return mergeInto(current, incoming, "");
}

function humanize(segment: string): string {
  const words = segment
    .split(/[_\-\s]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)
    .filter(Boolean)
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()));
  const text = words.join(" ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : segment;
}

export function labelForKey(key: string): { section: string; group: string; label: string } {
  const segments = key.split(".");
  if (segments.length === 1) {
    return { section: segments[0], group: "", label: humanize(segments[0]) };
  }
  return {
    section: segments[0],
    group: segments.slice(1, -1).map(humanize).join(" / "),
    label: humanize(segments[segments.length - 1]),
  };
}

/** Reference keys that are absent or blank in the current document. */
export function compareMissing(current: MessageDocument, reference: MessageDocument): string[] {
  const values = leafMap(current);
  const missing: string[] = [];
  for (const key of leafMap(reference).keys()) {
    const value = values.get(key);
    if (value === undefined || value.trim() === "") {
      missing.push(key);
    }
  }
  return missing.sort();
}

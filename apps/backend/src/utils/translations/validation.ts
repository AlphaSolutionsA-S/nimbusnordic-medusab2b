import { z } from "@medusajs/framework/zod";
import type { MessageDocument } from "../../types/storefront-translation";

export const MAX_LOCALE_LENGTH = 64;
export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const MAX_LEAVES = 5000;
export const MAX_DEPTH = 12;
export const MAX_VALUE_BYTES = 16 * 1024;
export const MAX_SEGMENT_LENGTH = 128;
export const MAX_KEY_LENGTH = 512;

export const MAX_REPORT_BATCH = 50;
export const MAX_REPORT_BODY_BYTES = 32 * 1024;
export const MAX_REPORT_PATH_LENGTH = 512;
export const MAX_REPORTS_PER_LOCALE = 2500;
export const MAX_REPORTS_GLOBAL = 20000;

/** Database key for a typed whole-locale outage report; never a message key. */
export const LOCALE_UNAVAILABLE_KEY = "__locale_unavailable__";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor", LOCALE_UNAVAILABLE_KEY]);

const encoder = new TextEncoder();

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function describeKey(key: string): string {
  return key.length > 120 ? `${key.slice(0, 120)}…` : key;
}

export function canonicalizeLocale(value: string): string | null {
  if (!value || value.length > MAX_LOCALE_LENGTH || /[\s/\\]/.test(value)) {
    return null;
  }
  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length === 1 ? canonical[0] : null;
  } catch {
    return null;
  }
}

export const localeSchema = z
  .string()
  .max(MAX_LOCALE_LENGTH)
  .transform((value, ctx) => {
    const canonical = canonicalizeLocale(value);
    if (!canonical) {
      ctx.addIssue({ code: "custom", message: "Locale must be a valid BCP 47 language tag" });
      return z.NEVER;
    }
    return canonical;
  });

function segmentProblem(segment: string): string | null {
  if (!segment) {
    return "contains an empty segment";
  }
  if (segment.includes(".")) {
    return "contains a dot inside a segment";
  }
  if (FORBIDDEN_SEGMENTS.has(segment)) {
    return "uses a reserved segment";
  }
  if (segment.length > MAX_SEGMENT_LENGTH) {
    return `has a segment longer than ${MAX_SEGMENT_LENGTH} characters`;
  }
  return null;
}

/** Returns a readable problem for a dotted message key, or null when the key is acceptable. */
export function keyPathProblem(key: string): string | null {
  if (key.length > MAX_KEY_LENGTH) {
    return `is longer than ${MAX_KEY_LENGTH} characters`;
  }
  const segments = key.split(".");
  if (segments.length > MAX_DEPTH) {
    return `is nested deeper than ${MAX_DEPTH} levels`;
  }
  for (const segment of segments) {
    const problem = segmentProblem(segment);
    if (problem) {
      return problem;
    }
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Inspects own data properties only (never invokes getters). Returns the first problem found. */
export function documentProblem(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return "The document must be a JSON object";
  }
  let leaves = 0;
  const stack: Array<{ node: Record<string, unknown>; prefix: string; depth: number }> = [
    { node: value, prefix: "", depth: 1 },
  ];
  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const { node, prefix, depth } = entry;
    for (const segment of Object.keys(node)) {
      const key = prefix ? `${prefix}.${segment}` : segment;
      const segmentIssue = segmentProblem(segment);
      if (segmentIssue) {
        return `Key "${describeKey(key)}" ${segmentIssue}`;
      }
      if (key.length > MAX_KEY_LENGTH) {
        return `Key "${describeKey(key)}" is longer than ${MAX_KEY_LENGTH} characters`;
      }
      const descriptor = Object.getOwnPropertyDescriptor(node, segment);
      if (!descriptor || !("value" in descriptor)) {
        return `Key "${describeKey(key)}" must be a data property`;
      }
      const child: unknown = descriptor.value;
      if (typeof child === "string") {
        leaves += 1;
        if (leaves > MAX_LEAVES) {
          return `The document has more than ${MAX_LEAVES} texts`;
        }
        if (byteLength(child) > MAX_VALUE_BYTES) {
          return `Value for "${describeKey(key)}" is larger than ${MAX_VALUE_BYTES / 1024} KiB`;
        }
      } else if (isPlainObject(child)) {
        if (depth + 1 > MAX_DEPTH) {
          return `Key "${describeKey(key)}" is nested deeper than ${MAX_DEPTH} levels`;
        }
        stack.push({ node: child, prefix: key, depth: depth + 1 });
      } else {
        return `Value for "${describeKey(key)}" must be text or a group of texts`;
      }
    }
  }
  if (byteLength(JSON.stringify(value)) > MAX_DOCUMENT_BYTES) {
    return `The document is larger than ${MAX_DOCUMENT_BYTES / 1024} KiB`;
  }
  return null;
}

export const messageDocumentSchema: z.ZodType<MessageDocument> = z
  .custom<MessageDocument>()
  .superRefine((value, ctx) => {
    const problem = documentProblem(value);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });

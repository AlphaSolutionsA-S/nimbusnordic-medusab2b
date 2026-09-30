import type { MessageDocument } from "../../../../types/storefront-translation";

/** Client-side convenience check only; the server validates structure and size independently. */
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

export type JsonFileResult =
  | { ok: true; messages: MessageDocument }
  | { ok: false; error: string };

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read"));
    reader.readAsText(file);
  });
}

export async function readJsonFile(file: File): Promise<JsonFileResult> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: "The file is larger than 1 MB." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readText(file));
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "The file must contain a JSON object of texts." };
  }
  return { ok: true, messages: parsed as MessageDocument };
}

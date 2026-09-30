import { useRef, useState } from "react";
import { Button, FocusModal, Input, Label, RadioGroup, Select, Text } from "@medusajs/ui";
import { useCreateTranslation, usePreviewImport } from "../../../hooks/api/ui-translations";
import { REFERENCE_LOCALE, safeErrorMessage } from "../../../lib/translations";
import type {
  LocaleSummary,
  MessageDocument,
  PreviewResponse,
  TranslationDocument,
} from "../../../../types/storefront-translation";
import { readJsonFile } from "./read-json-file";

export interface CreateLanguageModalProps {
  open: boolean;
  locales: LocaleSummary[];
  onClose: () => void;
  onCreated: (document: TranslationDocument) => void;
}

function canonicalLocale(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || /[\s/\\]/.test(trimmed)) {
    return null;
  }
  try {
    const [canonical, ...rest] = Intl.getCanonicalLocales(trimmed);
    return canonical && !rest.length ? canonical : null;
  } catch {
    return null;
  }
}

export function CreateLanguageModal({ open, locales, onClose, onCreated }: CreateLanguageModalProps) {
  const [input, setInput] = useState("");
  const canonical = canonicalLocale(input);
  const exists = Boolean(canonical && locales.some((summary) => summary.locale === canonical));
  const [source, setSource] = useState<"copy" | "import">(locales.length ? "copy" : "import");
  const defaultSource = (locales.find((summary) => summary.locale === REFERENCE_LOCALE) ?? locales[0])?.locale ?? "";
  const [sourceLocale, setSourceLocale] = useState(defaultSource);
  const [messages, setMessages] = useState<MessageDocument | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateTranslation();
  const previewMutation = usePreviewImport(canonical ?? "");
  const readRequest = useRef(0);

  const sourceSummary = locales.find((summary) => summary.locale === sourceLocale);
  const localeProblem = !input.trim()
    ? null
    : !canonical
      ? "Enter a valid language code, for example nl, fi or pt-BR."
      : exists
        ? `The language ${canonical} already exists.`
        : null;
  const ready =
    Boolean(canonical) &&
    !exists &&
    (source === "copy" ? Boolean(sourceSummary) : Boolean(messages && preview && preview.locale === canonical));

  const handleFile = async (file: File | undefined) => {
    const request = ++readRequest.current;
    setMessages(null);
    setPreview(null);
    setFileError(null);
    if (!file) {
      return;
    }
    const result = await readJsonFile(file);
    if (request !== readRequest.current) {
      return;
    }
    if (result.ok) {
      setMessages(result.messages);
    } else {
      setFileError(result.error);
    }
  };

  const runPreview = () => {
    if (!messages || !canonical) {
      return;
    }
    setError(null);
    previewMutation.mutate(
      { expected_version: null, mode: "replace", messages },
      { onSuccess: setPreview, onError: (previewError) => setError(safeErrorMessage(previewError)) }
    );
  };

  const submit = () => {
    if (!canonical) {
      return;
    }
    setError(null);
    const body =
      source === "copy" && sourceSummary
        ? {
            locale: canonical,
            source: "copy" as const,
            source_locale: sourceSummary.locale,
            source_version: sourceSummary.version,
          }
        : { locale: canonical, source: "import" as const, messages: messages ?? {} };
    create.mutate(body, {
      onSuccess: (result) => onCreated(result.translation),
      onError: (createError) => setError(safeErrorMessage(createError)),
    });
  };

  return (
    <FocusModal open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Add language</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-y-4 overflow-y-auto px-6 py-4">
          <FocusModal.Description className="text-ui-fg-subtle">
            New languages start inactive. Customers only see a language after it is activated here
            and a developer maps countries to it in code (country-language-map.ts) and deploys.
          </FocusModal.Description>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="translation-new-locale" size="small" weight="plus">
              Language code
            </Label>
            <Input
              id="translation-new-locale"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setPreview(null);
              }}
              placeholder="nl"
            />
            {canonical && canonical !== input.trim() && !localeProblem && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Will be saved as {canonical}
              </Text>
            )}
            {localeProblem && (
              <Text role="alert" size="small" className="text-ui-fg-error">
                {localeProblem}
              </Text>
            )}
          </div>
          <RadioGroup
            value={source}
            onValueChange={(value) => setSource(value === "import" ? "import" : "copy")}
            aria-label="Start from"
          >
            <div className="flex items-center gap-x-2">
              <RadioGroup.Item value="copy" id="translation-source-copy" disabled={!locales.length} />
              <Label htmlFor="translation-source-copy" size="small">
                Copy an existing language
              </Label>
            </div>
            <div className="flex items-center gap-x-2">
              <RadioGroup.Item value="import" id="translation-source-import" />
              <Label htmlFor="translation-source-import" size="small">
                Import a JSON file
              </Label>
            </div>
          </RadioGroup>
          {source === "copy" && locales.length > 0 && (
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="translation-copy-source" size="small" weight="plus">
                Copy from
              </Label>
              <Select value={sourceLocale} onValueChange={setSourceLocale}>
                <Select.Trigger id="translation-copy-source" aria-label="Copy from" className="w-48">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {locales.map((summary) => (
                    <Select.Item key={summary.locale} value={summary.locale}>
                      {summary.locale}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
          {source === "import" && (
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="translation-new-file" size="small" weight="plus">
                JSON file
              </Label>
              <input
                id="translation-new-file"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Clear the input so picking the same file again fires onChange.
                  event.target.value = "";
                  void handleFile(file);
                }}
              />
              {fileError && (
                <Text role="alert" size="small" className="text-ui-fg-error">
                  {fileError}
                </Text>
              )}
              <div>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={runPreview}
                  disabled={!messages || !canonical || exists || previewMutation.isPending}
                  isLoading={previewMutation.isPending}
                >
                  Preview file
                </Button>
              </div>
              {preview && (
                <Text size="small" aria-label="File preview">
                  {preview.diff.added.length} texts will be created · {preview.diff.empty.length} empty ·{" "}
                  {preview.warnings.filter((warning) => warning.code !== "reference_unavailable").length}{" "}
                  placeholder warnings
                </Text>
              )}
            </div>
          )}
          {error && (
            <Text role="alert" size="small" className="text-ui-fg-error">
              {error}
            </Text>
          )}
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex justify-end gap-x-2">
            <Button size="small" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button size="small" onClick={submit} disabled={!ready || create.isPending} isLoading={create.isPending}>
              Create inactive language
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  );
}

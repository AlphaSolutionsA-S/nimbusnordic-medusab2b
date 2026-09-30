import { useState } from "react";
import { Button, Checkbox, FocusModal, Label, RadioGroup, Text } from "@medusajs/ui";
import { useImportTranslation, usePreviewImport } from "../../../hooks/api/ui-translations";
import { errorStatus, safeErrorMessage } from "../../../lib/translations";
import { flattenMessages } from "../../../../utils/translations/documents";
import type {
  MessageDocument,
  PreviewResponse,
  TranslationDocument,
} from "../../../../types/storefront-translation";
import { readJsonFile } from "./read-json-file";

export interface ImportModalProps {
  open: boolean;
  locale: string;
  current: TranslationDocument | null;
  onClose: () => void;
  onApplied: (document: TranslationDocument) => void;
}

const MAX_LISTED = 200;

function KeyList({
  title,
  keys,
  render,
  tone,
}: {
  title: string;
  keys: string[];
  render?: (key: string) => string;
  tone?: "danger";
}) {
  if (!keys.length) {
    return null;
  }
  return (
    <div className="flex flex-col gap-y-1">
      <Text size="small" weight="plus" className={tone === "danger" ? "text-ui-fg-error" : undefined}>
        {title} ({keys.length})
      </Text>
      <ul aria-label={title} className="flex max-h-48 flex-col gap-y-1 overflow-y-auto rounded-md border border-ui-border-base px-3 py-2">
        {keys.slice(0, MAX_LISTED).map((key) => (
          <li key={key}>
            <Text size="xsmall" className={tone === "danger" ? "font-mono text-ui-fg-error" : "font-mono"}>
              {key}
              {render ? `: ${render(key)}` : ""}
            </Text>
          </li>
        ))}
        {keys.length > MAX_LISTED && (
          <li>
            <Text size="xsmall" className="text-ui-fg-subtle">
              …and {keys.length - MAX_LISTED} more
            </Text>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Upload → choose mode → server preview → explicit apply. Closing without applying writes nothing. */
export function TranslationImportModal({ open, locale, current, onClose, onApplied }: ImportModalProps) {
  const previewMutation = usePreviewImport(locale);
  const importMutation = useImportTranslation(locale);
  const [fileName, setFileName] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDocument | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">(current ? "merge" : "replace");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [confirmRemoved, setConfirmRemoved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidatePreview = () => {
    setPreview(null);
    setConfirmRemoved(false);
    setActionError(null);
  };

  const handleFile = async (file: File | undefined) => {
    invalidatePreview();
    setMessages(null);
    setFileError(null);
    setFileName(file?.name ?? null);
    if (!file) {
      return;
    }
    const result = await readJsonFile(file);
    if (result.ok) {
      setMessages(result.messages);
    } else {
      setFileError(result.error);
    }
  };

  const expectedVersion = current?.version ?? null;

  const runPreview = () => {
    if (!messages) {
      return;
    }
    setActionError(null);
    previewMutation.mutate(
      { expected_version: expectedVersion, mode, messages },
      {
        onSuccess: (result) => setPreview(result),
        onError: (error) => setActionError(safeErrorMessage(error)),
      }
    );
  };

  const apply = () => {
    if (!messages || !preview) {
      return;
    }
    setActionError(null);
    importMutation.mutate(
      { expected_version: expectedVersion, mode, messages, confirm_removed: confirmRemoved },
      {
        onSuccess: (result) => onApplied(result.translation),
        onError: (error) => {
          if (errorStatus(error) === 409) {
            setPreview(null);
            setConfirmRemoved(false);
            setActionError(
              "This language changed after the preview. Your file is kept; close and reopen to preview it against the latest version."
            );
          } else {
            setActionError(safeErrorMessage(error));
          }
        },
      }
    );
  };

  const removed = preview?.diff.removed ?? [];
  const needsConfirmation = removed.length > 0;
  const currentValues = current ? flattenMessages(current.messages) : {};
  const incomingValues = messages ? flattenMessages(messages) : {};
  const applyDisabled =
    !preview || (needsConfirmation && !confirmRemoved) || importMutation.isPending;

  return (
    <FocusModal open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Import or compare a file for {locale}</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-y-4 overflow-y-auto px-6 py-4">
          <FocusModal.Description className="text-ui-fg-subtle">
            {current
              ? "Preview what a JSON file would change. Close the dialog to leave the language unchanged."
              : "This language does not exist yet. Applying creates it as an inactive language."}
          </FocusModal.Description>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="translation-import-file" size="small" weight="plus">
              JSON file
            </Label>
            <input
              id="translation-import-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            {fileName && !fileError && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {fileName}
              </Text>
            )}
            {fileError && (
              <Text role="alert" size="small" className="text-ui-fg-error">
                {fileError}
              </Text>
            )}
          </div>
          {current && (
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                setMode(value === "replace" ? "replace" : "merge");
                invalidatePreview();
              }}
              aria-label="Import mode"
            >
              <div className="flex items-center gap-x-2">
                <RadioGroup.Item value="merge" id="translation-mode-merge" />
                <Label htmlFor="translation-mode-merge" size="small">
                  Merge: keep existing texts, add and overwrite from the file
                </Label>
              </div>
              <div className="flex items-center gap-x-2">
                <RadioGroup.Item value="replace" id="translation-mode-replace" />
                <Label htmlFor="translation-mode-replace" size="small">
                  Replace: the file becomes the whole language
                </Label>
              </div>
            </RadioGroup>
          )}
          <div>
            <Button
              size="small"
              variant="secondary"
              onClick={runPreview}
              disabled={!messages || previewMutation.isPending}
              isLoading={previewMutation.isPending}
            >
              Preview changes
            </Button>
          </div>
          {actionError && (
            <Text role="alert" size="small" className="text-ui-fg-error">
              {actionError}
            </Text>
          )}
          {preview && (
            <section aria-label="Import preview" className="flex flex-col gap-y-3">
              <Text size="small" weight="plus">
                {preview.diff.added.length} added · {preview.diff.changed.length} changed ·{" "}
                {removed.length} removed · {preview.diff.empty.length} empty
              </Text>
              <KeyList title="Removed texts" keys={removed} tone="danger" render={(key) => currentValues[key]} />
              <KeyList title="Added texts" keys={preview.diff.added} render={(key) => incomingValues[key]} />
              <KeyList
                title="Changed texts"
                keys={preview.diff.changed}
                render={(key) => `${currentValues[key]} → ${incomingValues[key]}`}
              />
              <KeyList title="Empty texts" keys={preview.diff.empty} />
              {preview.warnings.length > 0 && (
                <KeyList
                  title="Placeholder warnings"
                  keys={preview.warnings.map((warning) => warning.key || "(language)")}
                  render={(key) =>
                    preview.warnings.find((warning) => (warning.key || "(language)") === key)?.message ?? ""
                  }
                />
              )}
              {needsConfirmation && (
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id="translation-confirm-removed"
                    checked={confirmRemoved}
                    onCheckedChange={(checked) => setConfirmRemoved(checked === true)}
                  />
                  <Label htmlFor="translation-confirm-removed" size="small">
                    I understand that {removed.length} text{removed.length === 1 ? "" : "s"} will be removed
                  </Label>
                </div>
              )}
            </section>
          )}
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex justify-end gap-x-2">
            <Button size="small" variant="secondary" onClick={onClose}>
              Close without applying
            </Button>
            <Button size="small" onClick={apply} disabled={applyDisabled} isLoading={importMutation.isPending}>
              {current ? "Apply import" : "Create language"}
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  );
}

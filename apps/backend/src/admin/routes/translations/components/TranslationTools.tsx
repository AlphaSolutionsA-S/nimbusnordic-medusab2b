import { useState } from "react";
import { Button, Checkbox, FocusModal, Label, Select, Text, usePrompt } from "@medusajs/ui";
import { useActivateTranslation, useTranslation } from "../../../hooks/api/ui-translations";
import { REFERENCE_LOCALE, safeErrorMessage } from "../../../lib/translations";
import type { LocaleSummary, TranslationDocument } from "../../../../types/storefront-translation";
import { CreateLanguageModal } from "./CreateLanguageModal";
import { LanguageComparison } from "./LanguageComparison";
import { MissingKeysTable } from "./MissingKeysTable";
import type { EditorContext } from "./TranslationEditor";
import { TranslationImportModal } from "./TranslationImportModal";

export interface TranslationToolsProps {
  context: EditorContext;
  locales: LocaleSummary[];
  /** A locale the readiness panel asked to import; opens the import dialog for it. */
  importRequest: string | null;
  onImportRequestHandled: () => void;
}

function downloadJson(document: TranslationDocument): void {
  const blob = new Blob([`${JSON.stringify(document.messages, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${document.locale}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TranslationTools({
  context,
  locales,
  importRequest,
  onImportRequestHandled,
}: TranslationToolsProps) {
  const prompt = usePrompt();
  const activate = useActivateTranslation(context.locale);
  const [ownImport, setOwnImport] = useState<string | null>(null);
  const [importNonce, setImportNonce] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [allLanguages, setAllLanguages] = useState(!context.document);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const others = locales.filter((summary) => summary.locale !== context.locale);
  const defaultCompare =
    (others.find((summary) => summary.locale === REFERENCE_LOCALE) ?? others[0])?.locale ?? "";
  const [compareChoice, setCompareChoice] = useState<string | null>(null);
  const compareLocale =
    compareChoice && others.some((summary) => summary.locale === compareChoice) ? compareChoice : defaultCompare;
  const comparison = useTranslation(compareLocale, { enabled: compareOpen && Boolean(compareLocale) });

  const importLocale = importRequest ?? ownImport;
  const document = context.document;

  /** Adopts a committed document, but never silently drops unsaved editor work. */
  const adoptSafely = async (next: TranslationDocument) => {
    if (!context.dirty || (await context.confirmDiscard())) {
      context.adopt(next);
      setNotice(null);
    } else {
      setNotice(
        `${next.locale} was updated. Your unsaved edits are kept; saving them will ask you to reload first.`
      );
    }
  };

  const closeImport = () => {
    setOwnImport(null);
    onImportRequestHandled();
  };

  const toggleActivation = async () => {
    if (!document) {
      return;
    }
    const activating = !document.is_active;
    const confirmed = await prompt({
      title: activating ? `Activate ${document.locale}?` : `Deactivate ${document.locale}?`,
      description: activating
        ? "The storefront will serve these texts to customers whose country is mapped to this language."
        : "Customers whose country is mapped to this language will see raw text keys until it is activated again.",
      confirmText: activating ? "Activate" : "Deactivate",
      cancelText: "Cancel",
    });
    if (!confirmed) {
      return;
    }
    setError(null);
    activate.mutate(
      { expected_version: document.version, is_active: activating },
      {
        onSuccess: (result) => void adoptSafely(result.translation),
        onError: (activationError) => setError(safeErrorMessage(activationError)),
      }
    );
  };

  return (
    <div className="flex flex-col gap-y-2 px-6">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Translation tools">
        {document && (
          <>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setImportNonce((value) => value + 1);
                setOwnImport(context.locale);
              }}
            >
              Import or compare file
            </Button>
            <Button size="small" variant="secondary" onClick={() => setCompareOpen(true)} disabled={!others.length}>
              Compare languages
            </Button>
            <Button size="small" variant="secondary" onClick={() => downloadJson(document)}>
              Export saved {document.locale}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => void toggleActivation()}
              disabled={activate.isPending}
              isLoading={activate.isPending}
            >
              {document.is_active ? "Deactivate" : "Activate"}
            </Button>
          </>
        )}
        <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
          Add language
        </Button>
        <Button size="small" variant="secondary" onClick={() => setMissingOpen(true)}>
          Missing texts
        </Button>
      </div>
      {document && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Export downloads the saved version of this language, not unsaved edits.
        </Text>
      )}
      {error && (
        <Text role="alert" size="small" className="text-ui-fg-error">
          {error}
        </Text>
      )}
      {notice && (
        <Text role="status" size="small" className="text-ui-fg-subtle">
          {notice}
        </Text>
      )}

      {importLocale && (
        <TranslationImportModal
          key={`${importLocale}:${importNonce}:${importRequest ?? ""}`}
          open
          locale={importLocale}
          current={importLocale === context.locale ? document : null}
          onClose={closeImport}
          onApplied={(next) => {
            closeImport();
            void adoptSafely(next);
          }}
        />
      )}
      {createOpen && (
        <CreateLanguageModal
          open
          locales={locales}
          onClose={() => setCreateOpen(false)}
          onCreated={(next) => {
            setCreateOpen(false);
            void adoptSafely(next);
          }}
        />
      )}

      <FocusModal open={compareOpen} onOpenChange={setCompareOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <FocusModal.Title>Compare {context.locale} with another language</FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-y-4 overflow-y-auto px-6 py-4">
            <FocusModal.Description className="text-ui-fg-subtle">
              Lists texts that exist in the reference language but are missing or empty in {context.locale}.
            </FocusModal.Description>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="translation-compare-with" size="small" weight="plus">
                Reference language
              </Label>
              <Select value={compareLocale} onValueChange={setCompareChoice}>
                <Select.Trigger id="translation-compare-with" aria-label="Reference language" className="w-48">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {others.map((summary) => (
                    <Select.Item key={summary.locale} value={summary.locale}>
                      {summary.locale}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {document && comparison.data && (
              <LanguageComparison current={document.messages} reference={comparison.data.translation.messages} />
            )}
            {comparison.isPending && compareOpen && (
              <Text role="status" size="small">
                Loading…
              </Text>
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      <FocusModal open={missingOpen} onOpenChange={setMissingOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <FocusModal.Title>Missing texts</FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-y-4 overflow-y-auto px-6 py-4">
            <FocusModal.Description className="text-ui-fg-subtle">
              Texts the storefront asked for but did not find. Adding a text saves it to the language.
            </FocusModal.Description>
            {document && (
              <div className="flex items-center gap-x-2">
                <Checkbox
                  id="translation-missing-all"
                  checked={allLanguages}
                  onCheckedChange={(checked) => setAllLanguages(checked === true)}
                />
                <Label htmlFor="translation-missing-all" size="small">
                  Show all languages
                </Label>
              </div>
            )}
            {missingOpen && (
              <MissingKeysTable
                locale={allLanguages || !document ? undefined : context.locale}
                document={document}
                onResolved={(next) => void adoptSafely(next)}
              />
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </div>
  );
}

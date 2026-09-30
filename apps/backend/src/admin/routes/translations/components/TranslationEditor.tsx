import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  Tabs,
  Text,
  Textarea,
  usePrompt,
} from "@medusajs/ui";
import {
  useSaveTranslation,
  useTranslation,
  useTranslationLocales,
} from "../../../hooks/api/ui-translations";
import { errorStatus, REFERENCE_LOCALE, safeErrorMessage } from "../../../lib/translations";
import {
  flattenMessages,
  labelForKey,
  updateMessageLeaves,
} from "../../../../utils/translations/documents";
import { compareIcu } from "../../../../utils/translations/icu";
import type {
  IcuWarning,
  MessageDocument,
  TranslationDocument,
} from "../../../../types/storefront-translation";

const MAX_SEARCH_RESULTS = 200;

const DISCARD_PROMPT = {
  title: "Discard unsaved changes?",
  description: "You have unsaved changes in this language. They will be lost.",
  confirmText: "Discard changes",
  cancelText: "Keep editing",
};

interface Draft {
  locale: string;
  version: number;
  original: MessageDocument;
  baseline: Record<string, string>;
  values: Record<string, string>;
}

function makeDraft(document: TranslationDocument): Draft {
  const flat = flattenMessages(document.messages);
  return {
    locale: document.locale,
    version: document.version,
    original: document.messages,
    baseline: flat,
    values: flat,
  };
}

/** Adopts a saved document, keeping values edited after `submitted` was sent for saving. */
function rebaseDraft(
  current: Draft | null,
  submitted: Readonly<Record<string, string>>,
  saved: TranslationDocument
): Draft {
  const next = makeDraft(saved);
  if (!current || current.locale !== saved.locale) {
    return next;
  }
  const values = { ...next.values };
  for (const key of Object.keys(values)) {
    const hasCurrent = Object.prototype.hasOwnProperty.call(current.values, key);
    if (hasCurrent && current.values[key] !== submitted[key]) {
      values[key] = current.values[key];
    }
  }
  return { ...next, values };
}

/** `undefined`: the reference lacks the key; `null`: no reference document is available. */
type ReferenceValue = string | undefined | null;

interface CachedWarnings {
  value: string;
  referenceValue: ReferenceValue;
  warnings: IcuWarning[];
}

/** Compares one text with its reference text, with the same rules as a whole-document compareIcu. */
function keyWarnings(key: string, value: string, referenceValue: ReferenceValue): IcuWarning[] {
  const reference: MessageDocument | null =
    referenceValue === null ? null : referenceValue === undefined ? {} : { text: referenceValue };
  return compareIcu({ text: value }, reference)
    .filter((warning) => warning.key === "text")
    .map((warning) => ({ ...warning, key }));
}

function isDirty(draft: Draft | null): boolean {
  return Boolean(draft && Object.keys(draft.values).some((key) => draft.values[key] !== draft.baseline[key]));
}

function sectionOf(key: string): string {
  return key.split(".")[0];
}

interface FieldGroup {
  title: string;
  keys: string[];
}

function groupKeys(keys: string[], withSection: boolean): FieldGroup[] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const { section, group } = labelForKey(key);
    const title = withSection ? [section, group].filter(Boolean).join(" › ") : group;
    groups.set(title, [...(groups.get(title) ?? []), key]);
  }
  return [...groups].map(([title, groupKeysList]) => ({ title, keys: groupKeysList }));
}

interface FieldProps {
  translationKey: string;
  value: string;
  multiline: boolean;
  warnings: IcuWarning[];
  onChange: (key: string, value: string) => void;
}

function TranslationField({ translationKey, value, multiline, warnings, onChange }: FieldProps) {
  const { label } = labelForKey(translationKey);
  const id = `translation-${translationKey}`;
  const accessibleName = `${label} (${translationKey})`;
  return (
    <div className="flex flex-col gap-y-1">
      <Label htmlFor={id} size="small" weight="plus">
        {label}
      </Label>
      <Text size="xsmall" leading="compact" className="text-ui-fg-muted font-mono">
        {translationKey}
      </Text>
      {multiline ? (
        <Textarea
          id={id}
          aria-label={accessibleName}
          value={value}
          onChange={(event) => onChange(translationKey, event.target.value)}
        />
      ) : (
        <Input
          id={id}
          aria-label={accessibleName}
          value={value}
          onChange={(event) => onChange(translationKey, event.target.value)}
        />
      )}
      {warnings.map((warning) => (
        <Text key={warning.code} size="small" leading="compact" className="text-ui-fg-error">
          {warning.message}
        </Text>
      ))}
    </div>
  );
}

export interface TranslationEditorProps {
  /** Optional tools (import, export, languages, missing texts) that operate on the editor. */
  renderTools?: (context: EditorContext) => ReactNode;
}

export interface EditorContext {
  locale: string;
  document: TranslationDocument | null;
  reference: TranslationDocument | null;
  dirty: boolean;
  /** Resolves true when there is no unsaved work, or the admin chose to discard it. */
  confirmDiscard: () => Promise<boolean>;
  /** Replaces the draft with a document committed by another tool and selects its language. */
  adopt: (document: TranslationDocument) => void;
  selectLocale: (locale: string) => Promise<void>;
}

export function TranslationEditor({ renderTools }: TranslationEditorProps = {}) {
  const prompt = usePrompt();
  const locales = useTranslationLocales();
  const summaries = locales.data?.locales ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const locale =
    selected ??
    (summaries.find((summary) => summary.locale === REFERENCE_LOCALE) ?? summaries[0])?.locale ??
    "";
  const detail = useTranslation(locale);
  const hasReference = summaries.some((summary) => summary.locale === REFERENCE_LOCALE);
  const reference = useTranslation(REFERENCE_LOCALE, {
    enabled: hasReference && locale !== REFERENCE_LOCALE,
  });
  const save = useSaveTranslation(locale);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Adopt server data for a new language, or a newer version while there is no unsaved work.
  // Re-fetches (including the reference language) never replace dirty input.
  const serverDocument = detail.data?.translation;
  if (serverDocument && serverDocument.locale === locale) {
    const stale = !draft || draft.locale !== locale;
    const newer = draft && !isDirty(draft) && !conflict && serverDocument.version > draft.version;
    if (stale || newer) {
      setDraft(makeDraft(serverDocument));
    }
  }
  const activeDraft = draft && draft.locale === locale ? draft : null;
  const dirty = isDirty(activeDraft);

  // Warnings are computed per rendered field and cached per key, so a keystroke re-checks one text
  // instead of the whole document. The reference language is compared with itself.
  const referenceDocument = reference.data?.translation.messages;
  const referenceValues = useMemo(
    () => (referenceDocument ? flattenMessages(referenceDocument) : null),
    [referenceDocument]
  );
  const warningCache = useRef(new Map<string, CachedWarnings>());
  const warningsFor = (key: string, value: string): IcuWarning[] => {
    const hasReferenceKey = Boolean(
      referenceValues && Object.prototype.hasOwnProperty.call(referenceValues, key)
    );
    const referenceValue: ReferenceValue =
      locale === REFERENCE_LOCALE
        ? value
        : referenceValues && (hasReferenceKey ? referenceValues[key] : undefined);
    const cached = warningCache.current.get(key);
    if (cached && cached.value === value && cached.referenceValue === referenceValue) {
      return cached.warnings;
    }
    const warnings = keyWarnings(key, value, referenceValue);
    warningCache.current.set(key, { value, referenceValue, warnings });
    return warnings;
  };

  const confirmDiscard = async (): Promise<boolean> => {
    if (!isDirty(activeDraft)) {
      return true;
    }
    return prompt(DISCARD_PROMPT);
  };

  // Guard unsaved work against closing the tab and against navigating away inside Admin.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }
    void prompt(DISCARD_PROMPT).then((discard) => (discard ? blocker.proceed() : blocker.reset()));
    // Runs once per blocked navigation; `prompt` is not a dependency so it cannot prompt twice.
  }, [blocker]);

  const resetFor = (next: string) => {
    setDraft(null);
    setConflict(false);
    setNotice(null);
    setError(null);
    setSection(null);
    setSelected(next);
  };

  const selectLocale = async (next: string) => {
    if (next === locale || !(await confirmDiscard())) {
      return;
    }
    resetFor(next);
  };

  const adopt = (document: TranslationDocument) => {
    resetFor(document.locale);
    setDraft(makeDraft(document));
  };

  const context: EditorContext = {
    locale,
    document: serverDocument && serverDocument.locale === locale ? serverDocument : null,
    reference: reference.data?.translation ?? (locale === REFERENCE_LOCALE ? serverDocument ?? null : null),
    dirty,
    confirmDiscard,
    adopt,
    selectLocale,
  };

  if (locales.isPending) {
    return (
      <Text role="status" size="small">
        Loading languages…
      </Text>
    );
  }
  if (locales.isError) {
    return (
      <div className="flex flex-col items-start gap-y-2 px-6 py-4">
        <Text size="small">The languages could not be loaded.</Text>
        <Button size="small" variant="secondary" onClick={() => locales.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!summaries.length) {
    return (
      <div className="flex flex-col items-start gap-y-2 px-6 py-4">
        <Text size="small">No languages have been imported yet.</Text>
        {renderTools?.(context)}
      </div>
    );
  }

  const updateValue = (key: string, value: string) => {
    setNotice(null);
    setDraft((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current));
  };

  const handleSave = () => {
    if (!activeDraft) {
      return;
    }
    setError(null);
    setNotice(null);
    const submitted = activeDraft.values;
    const messages = updateMessageLeaves(activeDraft.original, submitted);
    save.mutate(
      { expected_version: activeDraft.version, messages },
      {
        onSuccess: (result) => {
          // Keep anything typed while the save was in flight.
          setDraft((current) => rebaseDraft(current, submitted, result.translation));
          setConflict(false);
          setNotice(
            result.refresh === "deferred"
              ? "Saved. The storefront picks up the change within a few minutes."
              : "Saved."
          );
        },
        onError: (saveError) => {
          if (errorStatus(saveError) === 409) {
            setConflict(true);
          } else {
            setError(safeErrorMessage(saveError));
          }
        },
      }
    );
  };

  const reloadLatest = async () => {
    const result = await detail.refetch();
    if (!result.isSuccess) {
      setError("The latest version could not be loaded. Your changes are kept; try again.");
      return;
    }
    setDraft(makeDraft(result.data.translation));
    setConflict(false);
    setNotice(null);
    setError(null);
  };

  const allKeys = activeDraft ? Object.keys(activeDraft.values) : [];
  const sections = activeDraft ? Object.keys(activeDraft.original) : [];
  const activeSection = section && sections.includes(section) ? section : sections[0];
  const query = search.trim().toLowerCase();
  const matches = query
    ? allKeys.filter(
        (key) =>
          key.toLowerCase().includes(query) ||
          (activeDraft?.values[key] ?? "").toLowerCase().includes(query)
      )
    : allKeys.filter((key) => sectionOf(key) === activeSection);
  const visibleKeys = matches.slice(0, MAX_SEARCH_RESULTS);
  const summary = summaries.find((entry) => entry.locale === locale);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="translation-locale" size="small" weight="plus">
            Language
          </Label>
          <Select value={locale} onValueChange={(value) => void selectLocale(value)}>
            <Select.Trigger id="translation-locale" aria-label="Language" className="w-48">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {summaries.map((entry) => (
                <Select.Item key={entry.locale} value={entry.locale}>
                  {entry.is_active ? entry.locale : `${entry.locale} (inactive)`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        {summary && (
          <Badge size="small" color={summary.is_active ? "green" : "orange"}>
            {summary.is_active ? "Active" : "Inactive"}
          </Badge>
        )}
        <div className="flex flex-col gap-y-1 grow">
          <Label htmlFor="translation-search" size="small" weight="plus">
            Search
          </Label>
          <Input
            id="translation-search"
            type="search"
            placeholder="Search keys and texts in all sections"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          size="small"
          onClick={handleSave}
          disabled={!dirty || save.isPending || !activeDraft}
          isLoading={save.isPending}
        >
          Save
        </Button>
      </div>

      {renderTools?.(context)}

      {conflict && (
        <div role="alert" className="flex flex-col items-start gap-y-2 mx-6 rounded-md border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" weight="plus">
            Someone else saved this language
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Your changes were not saved and are still shown below. Reload to get the latest version;
            this discards your unsaved changes.
          </Text>
          <Button size="small" variant="secondary" onClick={() => void reloadLatest()}>
            Reload latest and discard my changes
          </Button>
        </div>
      )}
      {error && (
        <Text role="alert" size="small" className="px-6 text-ui-fg-error">
          {error}
        </Text>
      )}
      {notice && (
        <Text role="status" size="small" className="px-6 text-ui-fg-subtle">
          {notice}
        </Text>
      )}
      {locale !== REFERENCE_LOCALE && !hasReference && (
        <Text size="small" className="px-6 text-ui-fg-subtle">
          English is not imported yet, so placeholders cannot be compared.
        </Text>
      )}

      {detail.isError && !activeDraft && (
        <div className="flex flex-col items-start gap-y-2 px-6">
          <Text size="small">This language could not be loaded.</Text>
          <Button size="small" variant="secondary" onClick={() => detail.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!activeDraft && !detail.isError && (
        <Text role="status" size="small" className="px-6">
          Loading texts…
        </Text>
      )}

      {activeDraft && !query && sections.length > 0 && (
        <Tabs value={activeSection} onValueChange={setSection}>
          <Tabs.List className="px-6 flex-wrap">
            {sections.map((name) => (
              <Tabs.Trigger key={name} value={name}>
                {name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      {activeDraft && query && (
        <Text size="small" className="px-6 text-ui-fg-subtle">
          {matches.length === 0
            ? "No texts match your search."
            : `${matches.length} matching text${matches.length === 1 ? "" : "s"}${
                matches.length > MAX_SEARCH_RESULTS ? `, showing the first ${MAX_SEARCH_RESULTS}` : ""
              }`}
        </Text>
      )}

      {activeDraft && (
        <div className="flex flex-col gap-y-6 px-6 pb-6">
          {groupKeys(visibleKeys, Boolean(query)).map((group) => (
            <section key={group.title || "_"} className="flex flex-col gap-y-3">
              {group.title && (
                <Text size="small" leading="compact" weight="plus" className="text-ui-fg-subtle">
                  {group.title}
                </Text>
              )}
              {group.keys.map((key) => {
                const baseline = activeDraft.baseline[key];
                return (
                  <TranslationField
                    key={key}
                    translationKey={key}
                    value={activeDraft.values[key]}
                    multiline={baseline.includes("\n") || baseline.length > 120}
                    warnings={warningsFor(key, activeDraft.values[key])}
                    onChange={updateValue}
                  />
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

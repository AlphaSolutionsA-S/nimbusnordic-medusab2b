import { useState } from "react";
import { Badge, Button, Drawer, Label, Select, Text } from "@medusajs/ui";
import { useAssignCountryLanguage, useCountryLanguages } from "../../../hooks/api/ui-translations";
import { conflictAwareErrorMessage, errorStatus } from "../../../lib/translations";
import type { CountryLanguageManagementEntry } from "../../../../types/storefront-translation";

interface EditState {
  country_code: string;
  locale: string;
  /** The configuration version the form was opened (or reloaded) with; sent as `expected_version`. */
  version: number;
}

function rowLabel(entry: CountryLanguageManagementEntry): string {
  return `${entry.country_code}: ${entry.locale} (${entry.source === "default" ? "default" : "set explicitly"})`;
}

interface CountryRowProps {
  entry: CountryLanguageManagementEntry;
  defaultLocale: string;
  onEdit: (entry: CountryLanguageManagementEntry) => void;
}

function CountryRow({ entry, defaultLocale, onEdit }: CountryRowProps) {
  return (
    <li
      aria-label={rowLabel(entry)}
      className="flex items-center justify-between gap-x-3 rounded-md border border-ui-border-base px-3 py-2"
    >
      <div className="flex items-center gap-x-3">
        <Text size="small" leading="compact" weight="plus" className="w-8">
          {entry.country_code}
        </Text>
        <Text size="small" leading="compact">
          {entry.locale}
        </Text>
        <Badge size="2xsmall" color={entry.source === "default" ? "grey" : "blue"}>
          {entry.source === "default" ? `Default (${defaultLocale})` : "Set explicitly"}
        </Badge>
      </div>
      <Button
        size="small"
        variant="secondary"
        aria-label={`Edit language for ${entry.country_code}`}
        onClick={() => onEdit(entry)}
      >
        Edit
      </Button>
    </li>
  );
}

/** Lists each region country's storefront language and lets an Admin change one at a time. */
export function CountryLanguages() {
  const management = useCountryLanguages();
  const assign = useAssignCountryLanguage();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const data = management.data;
  const configured = data?.countries.filter((entry) => entry.configured) ?? [];
  const retained = data?.countries.filter((entry) => !entry.configured) ?? [];
  const saved = data?.countries.find((entry) => entry.country_code === editing?.country_code);

  const openEdit = (entry: CountryLanguageManagementEntry) => {
    if (!data) {
      return;
    }
    setEditing({ country_code: entry.country_code, locale: entry.locale, version: data.version });
    setError(null);
    setConflict(false);
    setNotice(null);
  };

  const close = () => {
    if (assign.isPending) {
      return;
    }
    setEditing(null);
    setError(null);
    setConflict(false);
  };

  const save = () => {
    if (!editing) {
      return;
    }
    setError(null);
    setConflict(false);
    const { country_code, locale, version } = editing;
    assign.mutate(
      { country_code, locale, expected_version: version },
      {
        onSuccess: () => {
          setEditing(null);
          setNotice(`${country_code} now uses ${locale}.`);
        },
        onError: (saveError) => {
          setConflict(errorStatus(saveError) === 409);
          setError(conflictAwareErrorMessage(saveError));
        },
      }
    );
  };

  // Keeps the chosen language and adopts the reloaded version, so the next save is not stale.
  const reload = async () => {
    const result = await management.refetch();
    if (!result.isSuccess) {
      setError("Country languages could not be reloaded. Your choice is kept; try again.");
      return;
    }
    setEditing((current) => current && { ...current, version: result.data.version });
    setError(null);
    setConflict(false);
  };

  const unchanged = Boolean(saved && saved.source === "explicit" && editing && saved.locale === editing.locale);

  return (
    <section aria-label="Country languages" className="flex flex-col gap-y-3 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <Text size="small" leading="compact" weight="plus">
          Country languages
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Each country in a region shows the storefront in its assigned language, or in the default language.
        </Text>
      </div>

      {management.isPending && (
        <Text role="status" size="small">
          Loading country languages…
        </Text>
      )}
      {management.isError && (
        <div className="flex flex-col items-start gap-y-2">
          <Text size="small">
            {errorStatus(management.error) === 503
              ? "Country languages are not set up in this environment yet. Run the country-language bootstrap, then retry."
              : "Country languages could not be loaded."}
          </Text>
          <Button size="small" variant="secondary" onClick={() => void management.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {configured.length === 0 ? (
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              No countries are in a region yet.
            </Text>
          ) : (
            <ul aria-label="Countries in regions" className="flex flex-col gap-2">
              {configured.map((entry) => (
                <CountryRow
                  key={entry.country_code}
                  entry={entry}
                  defaultLocale={data.default_locale}
                  onEdit={openEdit}
                />
              ))}
            </ul>
          )}
          {retained.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Text size="small" leading="compact" weight="plus">
                Retained assignments
              </Text>
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                These countries are no longer in any region. Their assignment is kept and still prevents
                deactivating its language until you change it.
              </Text>
              <ul aria-label="Retained assignments" className="flex flex-col gap-2">
                {retained.map((entry) => (
                  <CountryRow
                    key={entry.country_code}
                    entry={entry}
                    defaultLocale={data.default_locale}
                    onEdit={openEdit}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {notice && (
        <Text role="status" size="small" className="text-ui-fg-subtle">
          {notice}
        </Text>
      )}

      <Drawer open={editing !== null} onOpenChange={(open) => !open && close()}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Language for {editing?.country_code}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-4">
            <Drawer.Description className="text-ui-fg-subtle">
              Only active languages can be assigned. Saved now: {saved?.locale ?? "—"}
              {saved?.source === "default" ? " (default)" : ""}.
            </Drawer.Description>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="country-language-select" size="small" weight="plus">
                Storefront language
              </Label>
              <Select
                value={editing?.locale}
                onValueChange={(locale) => setEditing((current) => current && { ...current, locale })}
              >
                <Select.Trigger id="country-language-select" aria-label="Storefront language">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {(data?.active_locales ?? []).map((locale) => (
                    <Select.Item key={locale} value={locale}>
                      {locale}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {error && (
              <div role="alert" className="flex flex-col items-start gap-y-2">
                <Text size="small" className="text-ui-fg-error">
                  {error}
                </Text>
                {conflict && (
                  <Button size="small" variant="secondary" onClick={() => void reload()}>
                    Reload country languages
                  </Button>
                )}
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary" disabled={assign.isPending}>
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={save}
                disabled={assign.isPending || unchanged}
                isLoading={assign.isPending}
              >
                Save language
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </section>
  );
}

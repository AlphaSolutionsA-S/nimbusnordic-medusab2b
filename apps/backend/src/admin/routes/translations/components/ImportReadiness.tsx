import { Badge, Button, Text } from "@medusajs/ui";
import { INITIAL_IMPORT_LOCALES } from "../../../lib/translations";
import type { LocaleSummary } from "../../../../types/storefront-translation";

export interface ImportReadinessProps {
  locales: readonly LocaleSummary[];
  isLoading: boolean;
  onImport: (locale: string) => void;
}

/** One-time checklist for the original storefront languages; not a limit on other languages. */
export function ImportReadiness({ locales, isLoading, onImport }: ImportReadinessProps) {
  const byLocale = new Map(locales.map((summary) => [summary.locale, summary]));
  const complete = !isLoading && INITIAL_IMPORT_LOCALES.every((locale) => byLocale.get(locale)?.is_active);
  return (
    <section aria-label="Storefront language readiness" className="flex flex-col gap-y-2 px-6 py-4">
      <Text size="small" leading="compact" weight="plus">
        Storefront language readiness
      </Text>
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {complete
          ? "All original storefront languages are imported and active."
          : "Each original storefront language must be imported and activated in this environment before the storefront reads texts from here."}
      </Text>
      <ul className="flex flex-wrap gap-2">
        {INITIAL_IMPORT_LOCALES.map((locale) => {
          const summary = byLocale.get(locale);
          const status = isLoading
            ? "Checking…"
            : !summary
              ? "Missing"
              : summary.is_active
                ? "Imported, active"
                : "Imported, inactive";
          const color = isLoading ? "grey" : !summary ? "red" : summary.is_active ? "green" : "orange";
          return (
            <li
              key={locale}
              aria-label={`${locale}: ${status}`}
              className="flex items-center gap-x-2 rounded-md border border-ui-border-base px-2 py-1"
            >
              <Text size="small" weight="plus">
                {locale}
              </Text>
              <Badge size="2xsmall" color={color}>
                {status}
              </Badge>
              {!isLoading && !summary && (
                <Button size="small" variant="secondary" onClick={() => onImport(locale)}>
                  Import {locale}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

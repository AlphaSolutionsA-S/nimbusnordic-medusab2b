import { useState } from "react";
import { useTranslationLocales } from "../../../hooks/api/ui-translations";
import { ImportReadiness } from "./ImportReadiness";
import { TranslationEditor } from "./TranslationEditor";
import { TranslationTools } from "./TranslationTools";

export function TranslationsWorkspace() {
  const locales = useTranslationLocales();
  const [importRequest, setImportRequest] = useState<string | null>(null);
  const summaries = locales.data?.locales ?? [];
  return (
    <div className="flex flex-col divide-y divide-ui-border-base">
      <ImportReadiness locales={summaries} isLoading={locales.isPending} onImport={setImportRequest} />
      <TranslationEditor
        renderTools={(context) => (
          <TranslationTools
            context={context}
            locales={summaries}
            importRequest={importRequest}
            onImportRequestHandled={() => setImportRequest(null)}
          />
        )}
      />
    </div>
  );
}

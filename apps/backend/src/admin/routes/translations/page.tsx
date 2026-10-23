import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { LayoutComposer } from "@medusajs/dashboard/components";
import { Language } from "@medusajs/icons";
import { Container, Heading, Text } from "@medusajs/ui";
import { TRANSLATION_LIST_PAGE_KEY } from "../../lib/page-keys";
import { TranslationsWorkspace } from "./components/TranslationsWorkspace";

const TranslationsPage = () => {
  return (
    <LayoutComposer
      widgetsZonePrefix={TRANSLATION_LIST_PAGE_KEY}
      preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
      sections={{
        main: (
          <LayoutComposer.Entry id="translations">
            <Container className="flex flex-col p-0 overflow-hidden">
              <div className="px-6 py-4">
                <Heading>Translations</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Storefront interface texts, stored per language.
                </Text>
              </div>
              <TranslationsWorkspace />
            </Container>
          </LayoutComposer.Entry>
        ),
      }}
    />
  );
};

export const config = defineRouteConfig({ label: "Translations", icon: Language });

export default TranslationsPage;

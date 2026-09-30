import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Language } from "@medusajs/icons";
import { Container, Heading, Text } from "@medusajs/ui";
import { TranslationsWorkspace } from "./components/TranslationsWorkspace";

const TranslationsPage = () => {
  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="px-6 py-4">
        <Heading>Translations</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Storefront interface texts, stored per language.
        </Text>
      </div>
      <TranslationsWorkspace />
    </Container>
  );
};

export const config = defineRouteConfig({ label: "Translations", icon: Language });

export default TranslationsPage;

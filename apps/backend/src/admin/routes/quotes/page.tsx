import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { LayoutComposer } from "@medusajs/dashboard/components";
import { DocumentText } from "@medusajs/icons";
import { Container, Heading, Toaster } from "@medusajs/ui";
import { QUOTE_LIST_PAGE_KEY } from "../../lib/page-keys";
import { QuotesTable } from "./components/quotes-table";

const Quotes = () => {
  return (
    <>
      <LayoutComposer
        widgetsZonePrefix={QUOTE_LIST_PAGE_KEY}
        preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
        sections={{
          main: (
            <LayoutComposer.Entry id="quotes">
              <Container className="flex flex-col p-0 overflow-hidden">
                <Heading className="p-6 pb-0 font-sans font-medium h1-core">
                  Quotes
                </Heading>

                <QuotesTable />
              </Container>
            </LayoutComposer.Entry>
          ),
        }}
      />
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: "Quotes",
  icon: DocumentText,
});

export default Quotes;

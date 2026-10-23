import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { LayoutComposer } from "@medusajs/dashboard/components";
import { CheckCircle } from "@medusajs/icons";
import { Container, Heading, Toaster } from "@medusajs/ui";
import { APPROVAL_LIST_PAGE_KEY } from "../../lib/page-keys";
import { ApprovalsTable } from "./components/approvals-table";

const Approvals = () => {
  return (
    <>
      <LayoutComposer
        widgetsZonePrefix={APPROVAL_LIST_PAGE_KEY}
        preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
        sections={{
          main: (
            <LayoutComposer.Entry id="approvals">
              <Container className="flex flex-col p-0 overflow-hidden">
                <Heading className="p-6 pb-0 font-sans font-medium h1-core">
                  Approvals
                </Heading>
                <ApprovalsTable />
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
  label: "Approvals",
  icon: CheckCircle,
});

export default Approvals;

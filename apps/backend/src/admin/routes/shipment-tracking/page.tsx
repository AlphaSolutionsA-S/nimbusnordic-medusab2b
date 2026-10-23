import { useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { LayoutComposer } from "@medusajs/dashboard/components";
import { Spinner } from "@medusajs/icons";
import { Button, Container, Heading, Table, Text, toast } from "@medusajs/ui";
import {
  type AdminShipmentTrackingOverviewRow, useRetryShipmentTracking, useShipmentTracking, useShipmentTrackingOverview,
} from "../../hooks/api/shipment-tracking";
import { SHIPMENT_TRACKING_LIST_PAGE_KEY } from "../../lib/page-keys";

const PAGE_SIZE = 20;
const OVERVIEW_PAGE_SIZE = 50;
const CLOSE_REASON_LABELS: Record<NonNullable<AdminShipmentTrackingOverviewRow["close_reason"]>, string> = {
  cancelled: "cancelled", window_ended: "window ended", superseded: "superseded", gave_up: "gave up",
  company_not_enabled: "company not enabled for the order API",
};

function statusText(row: AdminShipmentTrackingOverviewRow): string {
  if (row.state === "open") return "Open";
  return row.close_reason ? `Closed: ${CLOSE_REASON_LABELS[row.close_reason]}` : "Closed";
}

const AllShipments = () => {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useShipmentTrackingOverview(OVERVIEW_PAGE_SIZE, offset);

  return (
    <Container className="p-0 overflow-hidden">
      <section aria-labelledby="all-shipments-heading">
        <div className="px-6 py-4">
          <Heading level="h2" id="all-shipments-heading">All shipments</Heading>
          <Text size="small" className="text-ui-fg-subtle">Every Business Central shipment, newest shipment date first.</Text>
        </div>
        {isLoading ? (
          <div role="status" className="flex items-center gap-3 px-6 py-4">
            <Spinner className="animate-spin" /><Text>Loading all shipments</Text>
          </div>
        ) : error ? (
          <div role="alert" className="px-6 py-4"><Text>{error.message}</Text></div>
        ) : (
          <>
            <Table>
              <Table.Header><Table.Row>
                {["Shipment", "BC order", "Customer order", "Company", "Shipment date", "Status"].map((label) => <Table.HeaderCell key={label}>{label}</Table.HeaderCell>)}
              </Table.Row></Table.Header>
              <Table.Body>{data?.shipment_trackings.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell>{row.shipment_number}</Table.Cell>
                  <Table.Cell>{row.bc_order_number}</Table.Cell>
                  <Table.Cell>{row.external_order_number}</Table.Cell>
                  <Table.Cell>{row.company_name ?? row.company_id}</Table.Cell>
                  <Table.Cell>{row.posting_date}</Table.Cell>
                  <Table.Cell>{statusText(row)}</Table.Cell>
                </Table.Row>
              ))}</Table.Body>
            </Table>
            {data?.count === 0 && <Text className="px-6 py-4">No shipments yet.</Text>}
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <Text size="small">{data?.count ?? 0} shipments</Text>
              <div className="flex gap-2">
                <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - OVERVIEW_PAGE_SIZE))}>Previous</Button>
                <Button size="small" variant="secondary" disabled={offset + OVERVIEW_PAGE_SIZE >= (data?.count ?? 0)} onClick={() => setOffset(offset + OVERVIEW_PAGE_SIZE)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </section>
    </Container>
  );
};

const GivenUpShipments = () => {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useShipmentTracking(PAGE_SIZE, offset);
  const retry = useRetryShipmentTracking();

  return (
    <Container className="p-0 overflow-hidden">
      <div className="px-6 py-4">
        <Heading>Shipment tracking</Heading>
        <Text size="small" className="text-ui-fg-subtle">Shipments whose automatic checks gave up. Retry to check them again on the next polling run.</Text>
      </div>
      {isLoading ? (
        <div role="status" className="flex items-center gap-3 px-6 py-4">
          <Spinner className="animate-spin" /><Text>Loading shipment tracking</Text>
        </div>
      ) : error ? (
        <div role="alert" className="px-6 py-4"><Text>{error.message}</Text></div>
      ) : (
        <>
          <Table>
            <Table.Header><Table.Row>
              {["Shipment", "BC order", "Order", "External order", "Company", "Last error", "Attempts", "Gave up", "Action"].map((label) => <Table.HeaderCell key={label}>{label}</Table.HeaderCell>)}
            </Table.Row></Table.Header>
            <Table.Body>{data?.shipment_trackings.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>{row.shipment_number}</Table.Cell>
                <Table.Cell>{row.bc_order_number}</Table.Cell>
                <Table.Cell>{row.order_id}</Table.Cell>
                <Table.Cell>{row.external_order_number}</Table.Cell>
                <Table.Cell>{row.company_name ?? row.company_id}</Table.Cell>
                <Table.Cell>{row.last_error ?? "—"}</Table.Cell>
                <Table.Cell>{row.attempts}</Table.Cell>
                <Table.Cell>{new Date(row.closed_at).toLocaleString()}</Table.Cell>
                <Table.Cell><Button size="small" variant="secondary" disabled={retry.isPending}
                  isLoading={retry.isPending && retry.variables === row.id}
                  onClick={() => retry.mutate(row.id, { onError: (failure) => toast.error(failure.message) })}>Retry</Button></Table.Cell>
              </Table.Row>
            ))}</Table.Body>
          </Table>
          {data?.count === 0 && <Text className="px-6 py-4">No shipments have given up.</Text>}
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <Text size="small">{data?.count ?? 0} shipments</Text>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" disabled={offset === 0 || retry.isPending} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
              <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= (data?.count ?? 0) || retry.isPending} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </Container>
  );
};

const ShipmentTrackingPage = () => (
  <LayoutComposer
    widgetsZonePrefix={SHIPMENT_TRACKING_LIST_PAGE_KEY}
    preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
    sections={{
      main: (
        <>
          <LayoutComposer.Entry id="given-up-shipments"><GivenUpShipments /></LayoutComposer.Entry>
          <LayoutComposer.Entry id="all-shipments"><AllShipments /></LayoutComposer.Entry>
        </>
      ),
    }}
  />
);

export const config = defineRouteConfig({ label: "Shipment tracking" });
export default ShipmentTrackingPage;

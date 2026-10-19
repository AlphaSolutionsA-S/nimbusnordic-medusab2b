import { useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import { Button, Container, Heading, Table, Text, toast } from "@medusajs/ui";
import { useRetryShipmentTracking, useShipmentTracking } from "../../hooks/api/shipment-tracking";

const PAGE_SIZE = 20;

const ShipmentTrackingPage = () => {
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

export const config = defineRouteConfig({ label: "Shipment tracking" });
export default ShipmentTrackingPage;

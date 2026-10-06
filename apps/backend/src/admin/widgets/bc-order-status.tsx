import { useState } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types";
import {
  Alert,
  Button,
  Container,
  Prompt,
  StatusBadge,
  Text,
} from "@medusajs/ui";
import { Spinner } from "@medusajs/icons";
import { hasBusinessCentralOrder } from "../../modules/order-ingestion/bc-integration-state";
import {
  useBcIntegrationStatus,
  useSubmitOrderToBc,
} from "../hooks/api/bc-integration";

const STATUS = {
  pending: { label: "Pending", color: "orange" },
  sent: { label: "Sent", color: "green" },
  failed: { label: "Failed", color: "red" },
} as const;
const LINE_FAILURE_LABELS = {
  no_identifiers: "No item identifiers",
  not_found: "Item not found",
  ambiguous: "Multiple items matched",
  rejected_by_bc: "Rejected by Business Central",
} as const;

const BcOrderStatusWidget = ({
  data: order,
}: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const [forceResendOpen, setForceResendOpen] = useState(false);
  const query = useBcIntegrationStatus(order.id);
  const submission = useSubmitOrderToBc(order.id);
  const integration = query.data?.bc_integration;
  const badge = integration?.status
    ? STATUS[integration.status]
    : { label: "Not tracked", color: "grey" as const };
  const busy = query.isFetching || submission.isPending;
  const canSubmit = query.isSuccess && !!integration && !busy;
  const lastUpdated =
    integration?.last_attempt_at ?? integration?.initialized_at;

  const writeToBc = () => {
    if (!canSubmit || !integration) return;
    if (hasBusinessCentralOrder(integration)) {
      setForceResendOpen(true);
    } else {
      submission.mutate({ force_resend: false });
    }
  };
  const confirmForceResend = () => {
    if (!canSubmit || !integration) return;
    submission.mutate({ force_resend: true });
    setForceResendOpen(false);
  };

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Business Central
          </Text>
          <Button
            size="small"
            variant="transparent"
            disabled={busy}
            onClick={() => {
              void query.refetch();
            }}
          >
            Refresh
          </Button>
        </div>
        <div className="flex flex-col gap-3 px-6 py-4">
          {query.isPending && (
            <Text size="small" role="status">
              <Spinner className="inline animate-spin" /> Loading Business
              Central status
            </Text>
          )}
          {query.isError && (
            <Alert variant="error">
              <Text size="small">
                Could not load Business Central status. Use Refresh to try
                again.
              </Text>
            </Alert>
          )}
          {integration && (
            <>
              <div className="flex items-center justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  Status
                </Text>
                <StatusBadge color={badge.color}>{badge.label}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  BC Order ID
                </Text>
                <Text size="small">
                  {integration.bc_order_id ?? "Not yet sent"}
                </Text>
              </div>
              {integration.bc_order_number && (
                <Text size="small">
                  BC Order Number: {integration.bc_order_number}
                </Text>
              )}
              <Text size="small">Attempts: {integration.attempt_count}</Text>
              <Text size="small">
                Last updated:{" "}
                {lastUpdated
                  ? new Date(lastUpdated).toLocaleString()
                  : "Not available"}
              </Text>
              {integration.partial && (
                <Alert variant="warning">
                  <Text size="small">
                    The last submission had line failures.
                  </Text>
                  {integration.line_failures.map((failure, index) => (
                    <Text size="small" key={`${failure.line_number}-${index}`}>
                      Line {failure.line_number}:{" "}
                      {LINE_FAILURE_LABELS[failure.reason]}
                    </Text>
                  ))}
                </Alert>
              )}
            </>
          )}
          {submission.isError && (
            <Alert variant="error">
              <Text size="small">
                Could not start the Business Central submission. Try again.
              </Text>
            </Alert>
          )}
          {submission.isSuccess && (
            <Alert variant="info">
              <Text size="small">
                Submission accepted. Use Refresh to check the outcome.
              </Text>
            </Alert>
          )}
          <Button
            size="small"
            variant="secondary"
            disabled={!canSubmit}
            isLoading={submission.isPending}
            onClick={writeToBc}
          >
            Write to BC
          </Button>
        </div>
      </Container>
      <Prompt
        open={forceResendOpen}
        onOpenChange={setForceResendOpen}
        variant="danger"
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Force resend to Business Central</Prompt.Title>
            <Prompt.Description>
              This order has already been sent to Business Central.
              {integration?.bc_order_id &&
                ` Current BC order: ${integration.bc_order_id}.`}
              {" Continuing may create another order in Business Central."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel disabled={submission.isPending}>
              Cancel
            </Prompt.Cancel>
            <Prompt.Action disabled={!canSubmit} onClick={confirmForceResend}>
              Force resend
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </>
  );
};
export const config = defineWidgetConfig({ zone: "order.details.side" });
export default BcOrderStatusWidget;

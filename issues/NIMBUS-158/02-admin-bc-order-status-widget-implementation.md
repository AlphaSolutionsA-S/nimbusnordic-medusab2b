# Task 02: Admin Order-Detail Widget for BC Status and Retry

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-158 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Naming conventions:** widget files in `src/admin/widgets/` are `.tsx`, hooks in
  `src/admin/hooks/api/` are `.tsx`. React components are `PascalCase`.

## Context

This is the first admin widget in the project. The widget is injected into the order-detail
page's side column using `defineWidgetConfig({ zone: 'order.details.side' })`. It receives
`DetailWidgetProps<HttpTypes.AdminOrder>` with `data` being the `AdminOrder` object (which
includes `id`).

The widget calls the two admin API routes from Task 01:
- `GET /admin/orders/:id/bc-integration` — to display the current status
- `POST /admin/orders/:id/bc-integration/submit` — to start a submission or force resend

### Admin skill rules followed

- **`data-sdk-always`** — uses `sdk.client.fetch()` for all API requests (not raw `fetch()`).
- **`data-display-on-mount`** — the status query loads on mount (no `enabled` condition).
- **`data-separate-queries`** — the status query is the only display query; the mutation is
  separate.
- **`data-invalidate-display`** — after a successful submission mutation, the status query is
  invalidated so the next render shows updated data.
- **`data-loading-states`** — shows `Spinner` while the status query is loading, not an empty
  state.
- **`design-semantic-colors`** — uses `bg-ui-bg-base`, `text-ui-fg-subtle`, etc.
- **`design-button-size`** — all buttons use `size="small"`.
- **`design-medusa-components`** — uses `Container`, `Button`, `Text`, `StatusBadge`, `Dialog`,
  `Alert`, `Spinner` from `@medusajs/ui`.
- **`typo-text-component`** — uses `Text` from `@medusajs/ui`, not plain `<span>`/`<p>`.
- **`typo-labels`** — uses `<Text size="small" leading="compact" weight="plus">` for labels.
- **`form-disable-pending`** — disables buttons during mutations
  (`disabled={mutation.isPending}`).

## Solution Design

### File structure

```
apps/backend/src/admin/
├── widgets/
│   └── bc-order-status.tsx           # The widget component
└── hooks/
    └── api/
        └── bc-integration.tsx        # React Query hooks
```

### Hooks (`bc-integration.tsx`)

Two hooks following the existing pattern in `hooks/api/companies.tsx`:

1. **`useBcIntegrationStatus(orderId: string)`** — `useQuery` calling
   `GET /admin/orders/:id/bc-integration`. Returns `{ status, bc_order_id, retry_count, timestamp,
   partial_submission, line_failures }`. Query key: `['bc-integration', orderId]`.

2. **`useSubmitOrderToBc(orderId: string)`** — `useMutation` calling
   `POST /admin/orders/:id/bc-integration/submit` with body `{ force_resend }`. On success,
   invalidates the `['bc-integration', orderId]` query so the next render shows updated data.

### Widget (`bc-order-status.tsx`)

The widget renders a `Container` with:

1. **Header row** — "Business Central" heading + **Refresh** button (icon: `ArrowPath`).
2. **Status display** — `StatusBadge` with color mapped from status:
   - `pending` → orange
   - `sent` → green
   - `failed` → red
   - `null` (not tracked) → grey
3. **BC order ID** — label + value (or "Not yet sent" when null).
4. **Retry count** — label + value.
5. **Last updated** — label + formatted timestamp (or "—" when null).
6. **Partial-failure info** (if present) — `Alert` variant="warning" listing which lines failed
   and why.
7. **Error alert** (if the status query failed) — `Alert` variant="error" with the error message
   and a Retry button.
8. **Write to BC button** — `Button` variant="secondary" size="small". Behavior depends on
   current status:
   - If `status` is `null`, `pending`, or `failed` (not `sent` and no BC order ID): clicking
     directly calls the submit mutation with `force_resend: false`.
   - If `status` is `sent` or a BC order ID exists: clicking opens a confirmation `Dialog`.
9. **Force-resend confirmation Dialog** — shown when the order has already been sent. Contains:
   - Title: "Force resend to Business Central"
   - Warning text: "This order has already been sent to Business Central."
   - BC order ID display: "Current BC order: {bc_order_id}" (when available)
   - Warning: "Continuing may create another order in Business Central. This action cannot be
     undone."
   - Cancel button: closes the dialog, no submission.
   - Confirm button: calls the submit mutation with `force_resend: true`, then closes the dialog.

### Button states

- **Refresh** — disabled while the status query is fetching (`isFetching`).
- **Write to BC** — disabled while the submit mutation is pending (`mutation.isPending`).
- **Confirm (in dialog)** — disabled while the submit mutation is pending.

### Loading state

While the initial status query is loading (`isLoading`), show a `Spinner` inside the Container
instead of the status display. Do not show an empty state.

## Code Skeletons

### New File: `apps/backend/src/admin/hooks/api/bc-integration.tsx`

```typescript
import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

export interface BcIntegrationStatus {
  status: string | null;
  bc_order_id: string | null;
  retry_count: number;
  timestamp: string | null;
  partial_submission: boolean;
  line_failures: Array<{ line_id: string; reason: string }>;
}

export interface BcIntegrationResponse {
  bc_integration: BcIntegrationStatus;
}

export interface SubmitOrderToBcInput {
  force_resend: boolean;
}

export const useBcIntegrationStatus = (
  orderId: string,
  options?: UseQueryOptions<BcIntegrationResponse, FetchError, BcIntegrationResponse, QueryKey>
) => {
  return useQuery({
    queryKey: ['bc-integration', orderId],
    queryFn: () =>
      sdk.client.fetch<BcIntegrationResponse>(
        `/admin/orders/${orderId}/bc-integration`,
        { method: 'GET' }
      ),
    ...options,
  });
};

export const useSubmitOrderToBc = (
  orderId: string,
  options?: UseMutationOptions<unknown, FetchError, SubmitOrderToBcInput>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitOrderToBcInput) =>
      sdk.client.fetch(`/admin/orders/${orderId}/bc-integration/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['bc-integration', orderId] });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
```

### New File: `apps/backend/src/admin/widgets/bc-order-status.tsx`

```tsx
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { DetailWidgetProps, HttpTypes } from '@medusajs/framework/types';
import {
  Alert,
  Button,
  Container,
  Dialog,
  StatusBadge,
  Spinner,
  Text,
} from '@medusajs/ui';
import { ArrowPath, BuildingStorefront } from '@medusajs/icons';
import { useState } from 'react';
import {
  useBcIntegrationStatus,
  useSubmitOrderToBc,
} from '../hooks/api/bc-integration';

const statusBadgeColor = (status: string | null) => {
  switch (status) {
    case 'sent':
      return 'green';
    case 'failed':
      return 'red';
    case 'pending':
      return 'orange';
    default:
      return 'grey';
  }
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    default:
      return 'Not tracked';
  }
};

const BcOrderStatusWidget = ({
  data: order,
}: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const [forceResendOpen, setForceResendOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBcIntegrationStatus(order.id);

  const submitMutation = useSubmitOrderToBc(order.id);

  const bcIntegration = data?.bc_integration;
  const alreadySent =
    bcIntegration?.status === 'sent' || !!bcIntegration?.bc_order_id;

  const handleWriteToBc = () => {
    if (alreadySent) {
      setForceResendOpen(true);
    } else {
      submitMutation.mutate({ force_resend: false });
    }
  };

  const handleConfirmForceResend = () => {
    submitMutation.mutate({ force_resend: true });
    setForceResendOpen(false);
  };

  if (isLoading) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner />
      </Container>
    );
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <BuildingStorefront className="text-ui-fg-subtle" />
            <Text size="small" leading="compact" weight="plus">
              Business Central
            </Text>
          </div>
          <Button
            size="small"
            variant="transparent"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <ArrowPath />
          </Button>
        </div>

        {isError && (
          <div className="px-6 py-4">
            <Alert variant="error">
              Failed to load Business Central status: {error?.message}
            </Alert>
          </div>
        )}

        {bcIntegration && (
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex items-center justify-between">
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Status
              </Text>
              <StatusBadge color={statusBadgeColor(bcIntegration.status)}>
                {statusLabel(bcIntegration.status)}
              </StatusBadge>
            </div>

            <div className="flex items-center justify-between">
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                BC Order ID
              </Text>
              <Text size="small" leading="compact">
                {bcIntegration.bc_order_id ?? 'Not yet sent'}
              </Text>
            </div>

            <div className="flex items-center justify-between">
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Attempts
              </Text>
              <Text size="small" leading="compact">
                {bcIntegration.retry_count}
              </Text>
            </div>

            <div className="flex items-center justify-between">
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Last updated
              </Text>
              <Text size="small" leading="compact">
                {bcIntegration.timestamp
                  ? new Date(bcIntegration.timestamp).toLocaleString()
                  : '—'}
              </Text>
            </div>

            {bcIntegration.partial_submission && (
              <Alert variant="warning">
                <Text size="small">
                  The last submission was partial — some lines could not be resolved.
                </Text>
                {bcIntegration.line_failures.length > 0 && (
                  <ul className="mt-2 list-disc pl-4">
                    {bcIntegration.line_failures.map((failure) => (
                      <li key={failure.line_id}>
                        <Text size="small">
                          {failure.line_id}: {failure.reason}
                        </Text>
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
          </div>
        )}

        {submitMutation.isError && (
          <div className="px-6 py-4">
            <Alert variant="error">
              Failed to start submission: {submitMutation.error?.message}
            </Alert>
          </div>
        )}

        {submitMutation.isSuccess && (
          <div className="px-6 py-4">
            <Alert variant="success">
              {submitMutation.data?.message ??
                'Submission started. Use Refresh to check the outcome.'}
            </Alert>
          </div>
        )}

        <div className="px-6 py-4">
          <Button
            size="small"
            variant="secondary"
            onClick={handleWriteToBc}
            disabled={submitMutation.isPending}
            isLoading={submitMutation.isPending}
          >
            Write to BC
          </Button>
        </div>
      </Container>

      <Dialog open={forceResendOpen} onOpenChange={setForceResendOpen}>
        <Dialog.Content>
          <Dialog.Header>Force resend to Business Central</Dialog.Header>
          <Dialog.Body>
            <Text size="small" className="text-ui-fg-subtle">
              This order has already been sent to Business Central.
            </Text>
            {bcIntegration?.bc_order_id && (
              <Text size="small" className="text-ui-fg-subtle">
                Current BC order: {bcIntegration.bc_order_id}
              </Text>
            )}
            <Alert variant="warning" className="mt-4">
              <Text size="small">
                Continuing may create another order in Business Central. This action cannot be
                undone.
              </Text>
            </Alert>
          </Dialog.Body>
          <Dialog.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setForceResendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={handleConfirmForceResend}
              disabled={submitMutation.isPending}
              isLoading={submitMutation.isPending}
            >
              Force resend
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.side',
});

export default BcOrderStatusWidget;
```

## Impacted Files

- **New:** `apps/backend/src/admin/widgets/bc-order-status.tsx`
- **New:** `apps/backend/src/admin/hooks/api/bc-integration.tsx`

No existing files are modified. The widget is auto-discovered by Medusa's admin widget loader
(any `.tsx` file under `src/admin/widgets/` with a `defineWidgetConfig` export).

## Open Items

- **Verify `@tanstack/react-query` is already installed** — existing hooks in
  `src/admin/hooks/api/` use it, so it should be available. If not, install the exact version
  matching `@medusajs/dashboard` (see admin skill's `data-pnpm-install-first` rule).
- **Verify `Dialog` component** — confirm `@medusajs/ui` exports `Dialog` and its sub-components
  (`Dialog.Content`, `Dialog.Header`, `Dialog.Body`, `Dialog.Footer`). If the API differs, adjust
  the confirmation UI accordingly.
- **Verify `StatusBadge` color values** — confirm the accepted color values for `StatusBadge` in
  the installed `@medusajs/ui` version.
- **Verify `HttpTypes.AdminOrder`** — confirm the import path for the `AdminOrder` type in the
  installed Medusa version. The Medusa docs use `HttpTypes.AdminOrder` from
  `@medusajs/framework/types`.
- **Reconcile response shape** — the `BcIntegrationStatus` interface must match the actual GET
  response from Task 01, which in turn must match the actual metadata shape from NIMBUS-148/149.

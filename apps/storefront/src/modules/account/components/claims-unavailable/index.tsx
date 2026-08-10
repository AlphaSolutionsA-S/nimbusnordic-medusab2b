import { Text } from '@medusajs/ui';

export function ClaimsUnavailable() {
  return (
    <div
      data-testid="claims-unavailable"
      className="py-8 px-4 bg-ui-bg-subtle border border-ui-border-base rounded"
    >
      <Text className="text-ui-fg-muted text-center">
        The claims information is temporarily unavailable. Please try again later.
      </Text>
    </div>
  );
}

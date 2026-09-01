import { Text } from '@medusajs/ui';
import { useTranslations } from 'next-intl';

// Rendered from `ClaimsPageContent`, which is itself reachable from both a
// Server Component and a Client Component tree — `useTranslations` works in
// both, unlike `getTranslations` which is Server-only.
export function ClaimsUnavailable() {
  const t = useTranslations('Account.claimsUnavailable');

  return (
    <div
      data-testid="claims-unavailable"
      className="py-8 px-4 bg-ui-bg-subtle border border-ui-border-base rounded"
    >
      <Text className="text-ui-fg-muted text-center">
        {t('message')}
      </Text>
    </div>
  );
}

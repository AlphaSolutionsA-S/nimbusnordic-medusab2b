import { Heading } from '@medusajs/ui';
import { useTranslations } from 'next-intl';

import type { ClaimsPage } from '@/types/cms';

import { ClaimsBlocks } from '../claims-blocks';
import { ClaimsUnavailable } from '../claims-unavailable';

// Rendered from both a Server Component (the claims route's page.tsx) and a
// Client Component (`ClaimsLivePreview`) — `useTranslations` works in both,
// unlike `getTranslations` which is Server-only.
export function ClaimsPageContent({ page }: { page: ClaimsPage | null }) {
  const t = useTranslations('Account.claimsPageContent');

  return (
    <div className="w-full flex flex-col gap-y-4" data-testid="claims-page-wrapper">
      <div className="mb-4">
        <Heading level="h1">{page?.title ?? t('defaultTitle')}</Heading>
      </div>
      {page ? <ClaimsBlocks blocks={page.layout} /> : <ClaimsUnavailable />}
    </div>
  );
}

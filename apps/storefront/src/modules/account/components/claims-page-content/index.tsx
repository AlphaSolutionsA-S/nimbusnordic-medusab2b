import { Heading } from '@medusajs/ui';

import type { ClaimsPage } from '@/types/cms';

import { ClaimsBlocks } from '../claims-blocks';
import { ClaimsUnavailable } from '../claims-unavailable';

export function ClaimsPageContent({ page }: { page: ClaimsPage | null }) {
  return (
    <div className="w-full flex flex-col gap-y-4" data-testid="claims-page-wrapper">
      <div className="mb-4">
        <Heading level="h1">{page?.title ?? 'Claims'}</Heading>
      </div>
      {page ? <ClaimsBlocks blocks={page.layout} /> : <ClaimsUnavailable />}
    </div>
  );
}

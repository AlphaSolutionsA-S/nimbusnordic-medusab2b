import { getClaimsPage } from '@/lib/data/cms';
import { ClaimsBlocks } from '@/modules/account/components/claims-blocks';
import { ClaimsUnavailable } from '@/modules/account/components/claims-unavailable';
import { Heading } from '@medusajs/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claims',
  description: 'Guidance for submitting a claim.',
};

export default async function Claims() {
  const page = await getClaimsPage();

  return (
    <div className="w-full flex flex-col gap-y-4" data-testid="claims-page-wrapper">
      <div className="mb-4">
        <Heading level="h1">{page?.title ?? 'Claims'}</Heading>
      </div>
      {page ? <ClaimsBlocks blocks={page.layout} /> : <ClaimsUnavailable />}
    </div>
  );
}

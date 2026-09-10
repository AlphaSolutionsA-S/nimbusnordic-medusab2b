import type { Metadata } from 'next';

import {
  getClaimsPageDocument,
  getPayloadLivePreviewURL,
} from '@/lib/data/cms';
import { mapPayloadClaimsPage } from '@/lib/util/map-claims-page';
import { ClaimsLivePreview } from '@/modules/account/components/claims-live-preview';
import { ClaimsPageContent } from '@/modules/account/components/claims-page-content';
import type { PayloadClaimsPage } from '@/types/cms';

export const metadata: Metadata = {
  title: 'Claims',
  description: 'Guidance for submitting a claim.',
};

type ClaimsProps = {
  searchParams: Promise<{
    livePreview?: string;
  }>;
};

const EMPTY_CLAIMS_PAGE: PayloadClaimsPage = {
  title: 'Claims',
  layout: [],
};

export default async function Claims({ searchParams }: ClaimsProps) {
  const [{ livePreview }, document] = await Promise.all([
    searchParams,
    getClaimsPageDocument(),
  ]);
  const payloadLivePreviewURL = getPayloadLivePreviewURL();

  if (livePreview === 'true' && payloadLivePreviewURL) {
    return (
      <ClaimsLivePreview
        initialData={document ?? EMPTY_CLAIMS_PAGE}
        serverURL={payloadLivePreviewURL}
      />
    );
  }

  return (
    <ClaimsPageContent page={document ? mapPayloadClaimsPage(document) : null} />
  );
}

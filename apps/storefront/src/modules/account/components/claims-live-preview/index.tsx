'use client';

import { useLivePreview } from '@payloadcms/live-preview-react';

import { mapPayloadClaimsPage } from '@/lib/util/map-claims-page';
import type { PayloadClaimsPage } from '@/types/cms';

import { ClaimsPageContent } from '../claims-page-content';

type ClaimsLivePreviewProps = {
  initialData: PayloadClaimsPage;
  serverURL: string;
};

export function ClaimsLivePreview({
  initialData,
  serverURL,
}: ClaimsLivePreviewProps) {
  const { data } = useLivePreview<PayloadClaimsPage>({
    depth: 2,
    initialData,
    serverURL,
  });

  return <ClaimsPageContent page={mapPayloadClaimsPage(data)} />;
}

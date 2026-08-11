import 'server-only';

import { mapPayloadClaimsPage } from '@/lib/util/map-claims-page';
import type { ClaimsPage, PayloadClaimsPage } from '@/types/cms';

type PayloadResponse = {
  docs: Array<PayloadClaimsPage>;
};

// Get config values - read at runtime to support testing
function getConfig() {
  return {
    PAYLOAD_API_URL: process.env.PAYLOAD_API_URL,
    PAYLOAD_API_KEY: process.env.PAYLOAD_API_KEY,
  };
}

export function getPayloadLivePreviewURL(): string | null {
  const configuredURL = process.env.PAYLOAD_PUBLIC_URL;

  if (!configuredURL) {
    return null;
  }

  try {
    return new URL(configuredURL).origin;
  } catch {
    return null;
  }
}

export async function getClaimsPageDocument(): Promise<PayloadClaimsPage | null> {
  const config = getConfig();
  if (!config.PAYLOAD_API_URL || !config.PAYLOAD_API_KEY) {
    return null;
  }

  try {
    const url = new URL('/api/portal-pages', config.PAYLOAD_API_URL);
    url.searchParams.set('where[slug][equals]', 'claims');
    url.searchParams.set('where[_status][equals]', 'published');
    url.searchParams.set('depth', '2');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `users API-Key ${config.PAYLOAD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 3600, // 1 hour
        tags: ['claims'],
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PayloadResponse;
    return data.docs[0] ?? null;
  } catch {
    return null;
  }
}

export async function getClaimsPage(): Promise<ClaimsPage | null> {
  const document = await getClaimsPageDocument();

  return document ? mapPayloadClaimsPage(document) : null;
}

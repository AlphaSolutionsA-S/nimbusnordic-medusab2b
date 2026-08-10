import 'server-only';

import type { ClaimsPage } from '@/types/cms';

type PayloadResponse = {
  docs: Array<{
    title: string;
    layout: Array<unknown>;
  }>;
};

// Get config values - read at runtime to support testing
function getConfig() {
  return {
    PAYLOAD_API_URL: process.env.PAYLOAD_API_URL,
    PAYLOAD_API_KEY: process.env.PAYLOAD_API_KEY,
  };
}

function mapPayloadToClaimsPage(payload: PayloadResponse): ClaimsPage | null {
  const doc = payload.docs[0];
  if (!doc) {
    return null;
  }

  return {
    title: doc.title,
    layout: doc.layout.map((block) => {
      if (typeof block !== 'object' || block === null) {
        return { blockType: 'unknown' };
      }

      const blockObj = block as Record<string, unknown>;
      const blockType = blockObj.blockType as string | undefined;

      if (!blockType) {
        return { blockType: 'unknown' };
      }

      // Map known blocks
      if (blockType === 'richText') {
        return {
          blockType: 'richText',
          content: blockObj.content,
        };
      }

      if (blockType === 'image') {
        const imageBlock = blockObj.image as Record<string, unknown> | undefined;
        if (imageBlock) {
          return {
            blockType: 'image',
            url: (imageBlock.url as string) || '',
            alt: (blockObj.alt as string) || '',
            caption: (blockObj.caption as string) || undefined,
          };
        }
      }

      if (blockType === 'callout') {
        return {
          blockType: 'callout',
          title: (blockObj.title as string) || '',
          content: blockObj.content,
          variant: (blockObj.variant as string) || '',
        };
      }

      if (blockType === 'cta') {
        return {
          blockType: 'cta',
          label: (blockObj.label as string) || '',
          url: (blockObj.url as string) || '',
        };
      }

      if (blockType === 'faq') {
        const items = blockObj.items as Array<unknown> | undefined;
        const rows = (items || []).map((item) => {
          if (typeof item !== 'object' || item === null) {
            return { question: '', answer: null };
          }
          const itemObj = item as Record<string, unknown>;
          return {
            question: (itemObj.question as string) || '',
            answer: itemObj.answer,
          };
        });
        return {
          blockType: 'faq',
          rows,
        };
      }

      // Unknown block — preserve the type so renderer can fail closed
      return { blockType };
    }),
  };
}

export async function getClaimsPage(): Promise<ClaimsPage | null> {
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
    return mapPayloadToClaimsPage(data);
  } catch {
    // Network error, parse error, or other failure
    return null;
  }
}

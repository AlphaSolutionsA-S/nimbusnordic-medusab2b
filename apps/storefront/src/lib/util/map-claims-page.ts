import type { ClaimsPage, PayloadClaimsPage } from '@/types/cms';

export function mapPayloadClaimsPage(document: PayloadClaimsPage): ClaimsPage {
  return {
    title: document.title || 'Claims',
    layout: (document.layout || []).map((block) => {
      if (typeof block !== 'object' || block === null) {
        return { blockType: 'unknown' };
      }

      const blockObject = block as Record<string, unknown>;
      const blockType = blockObject.blockType;

      if (typeof blockType !== 'string') {
        return { blockType: 'unknown' };
      }

      if (blockType === 'richText') {
        return {
          blockType,
          content: blockObject.content,
        };
      }

      if (blockType === 'image') {
        const image = blockObject.image;

        if (typeof image === 'object' && image !== null) {
          const imageObject = image as Record<string, unknown>;

          return {
            blockType,
            url: typeof imageObject.url === 'string' ? imageObject.url : '',
            alt: typeof imageObject.alt === 'string' ? imageObject.alt : '',
            caption:
              typeof blockObject.caption === 'string' ? blockObject.caption : undefined,
          };
        }
      }

      if (blockType === 'callout') {
        return {
          blockType,
          title: typeof blockObject.title === 'string' ? blockObject.title : '',
          content: blockObject.content,
          variant: typeof blockObject.variant === 'string' ? blockObject.variant : '',
        };
      }

      if (blockType === 'cta') {
        return {
          blockType,
          label: typeof blockObject.label === 'string' ? blockObject.label : '',
          url: typeof blockObject.url === 'string' ? blockObject.url : '',
        };
      }

      if (blockType === 'faq') {
        const items = Array.isArray(blockObject.items) ? blockObject.items : [];
        const rows = items.map((item) => {
          if (typeof item !== 'object' || item === null) {
            return { question: '', answer: null };
          }

          const itemObject = item as Record<string, unknown>;

          return {
            question:
              typeof itemObject.question === 'string' ? itemObject.question : '',
            answer: itemObject.answer,
          };
        });

        return {
          blockType,
          rows,
        };
      }

      return { blockType: 'unknown' };
    }),
  };
}

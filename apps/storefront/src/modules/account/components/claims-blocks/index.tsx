import type { ClaimsBlock } from '@/types/cms';
import { ClaimsRichText } from './rich-text';
import { ClaimsImage } from './image';
import { ClaimsCallout } from './callout';
import { ClaimsCta } from './cta';
import { ClaimsFaq } from './faq';

export function ClaimsBlocks({ blocks }: { blocks: ReadonlyArray<ClaimsBlock> }) {
  return (
    <div className="flex flex-col gap-y-6" data-testid="claims-blocks">
      {blocks.map((block, i) => {
        switch (block.blockType) {
          case 'richText':
            return <ClaimsRichText key={i} block={block} />;
          case 'image':
            return <ClaimsImage key={i} block={block} />;
          case 'callout':
            return <ClaimsCallout key={i} block={block} />;
          case 'cta':
            return <ClaimsCta key={i} block={block} />;
          case 'faq':
            return <ClaimsFaq key={i} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

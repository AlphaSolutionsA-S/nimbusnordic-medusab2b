import type { ClaimsCalloutBlock } from '@/types/cms';
import { clx } from '@medusajs/ui';

import { ClaimsRichText } from './rich-text';

export function ClaimsCallout({ block }: { block: ClaimsCalloutBlock }) {
  if (!block.title || !block.content) {
    return null;
  }

  const typeStyles: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

  const type = block.variant || 'info';
  const styles = typeStyles[type] || typeStyles.info;

  return (
    <div
      data-testid="claims-callout-block"
      className={clx('border-l-4 p-4 my-4', styles)}
    >
      <h2 className="text-base font-semibold mb-2">{block.title}</h2>
      <ClaimsRichText block={{ blockType: 'richText', content: block.content }} />
    </div>
  );
}

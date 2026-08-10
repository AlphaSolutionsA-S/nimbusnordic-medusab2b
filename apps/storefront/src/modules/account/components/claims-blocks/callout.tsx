import type { ClaimsCalloutBlock } from '@/types/cms';
import { clx } from '@medusajs/ui';

export function ClaimsCallout({ block }: { block: ClaimsCalloutBlock }) {
  if (!block.message) {
    return null;
  }

  const typeStyles: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

  const typeIcon: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
  };

  const type = block.type || 'info';
  const styles = typeStyles[type] || typeStyles.info;
  const icon = typeIcon[type] || typeIcon.info;

  return (
    <div
      data-testid="claims-callout-block"
      className={clx('border-l-4 p-4 my-4', styles)}
    >
      <div className="flex gap-x-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
        <p className="text-sm">{block.message}</p>
      </div>
    </div>
  );
}

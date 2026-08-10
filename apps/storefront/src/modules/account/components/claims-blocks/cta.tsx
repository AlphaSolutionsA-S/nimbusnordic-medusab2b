import type { ClaimsCtaBlock } from '@/types/cms';
import Link from 'next/link';
import { isSafePortalUrl } from '@/lib/data/cms-validators';

export function ClaimsCta({ block }: { block: ClaimsCtaBlock }) {
  if (!block.label || !block.url) {
    return null;
  }

  // Validate URL using the same policy as the CMS
  if (!isSafePortalUrl(block.url)) {
    return null;
  }

  return (
    <div data-testid="claims-cta-block" className="my-6">
      <Link
        href={block.url}
        className="inline-block px-6 py-3 bg-ui-interactive-base text-white font-semibold rounded hover:bg-ui-interactive-hover transition-colors"
      >
        {block.label}
      </Link>
    </div>
  );
}

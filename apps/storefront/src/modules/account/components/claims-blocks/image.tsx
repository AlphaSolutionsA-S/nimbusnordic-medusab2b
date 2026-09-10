import type { ClaimsImageBlock } from '@/types/cms';
import Image from 'next/image';

export function ClaimsImage({ block }: { block: ClaimsImageBlock }) {
  if (!block.url || !block.alt) {
    return null;
  }

  return (
    <div data-testid="claims-image-block" className="my-6">
      <div className="relative w-full h-auto min-h-64">
        <Image
          src={block.url}
          alt={block.alt}
          fill
          className="object-contain"
          unoptimized={false}
        />
      </div>
    </div>
  );
}

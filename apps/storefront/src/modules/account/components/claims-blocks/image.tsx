import type { ClaimsImageBlock } from '@/types/cms';
import Image from 'next/image';

export function ClaimsImage({ block }: { block: ClaimsImageBlock }) {
  if (!block.image) {
    return null;
  }

  const imageUrl = typeof block.image === 'object' ? (block.image as any)?.url : block.image;
  const alt = typeof block.image === 'object' ? (block.image as any)?.alt : block.altText;

  if (!imageUrl || !alt) {
    return null;
  }

  return (
    <div data-testid="claims-image-block" className="my-6">
      <div className="relative w-full h-auto min-h-64">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-contain"
          unoptimized={false}
        />
      </div>
    </div>
  );
}

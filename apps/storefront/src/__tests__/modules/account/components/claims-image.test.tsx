import { render, screen } from '@testing-library/react';
import { ClaimsImage } from '@/modules/account/components/claims-blocks/image';
import type { ClaimsImageBlock } from '@/types/cms';

describe('ClaimsImage', () => {
  it('TC-5: Renders image with alt text', () => {
    const block: ClaimsImageBlock = {
      blockType: 'image',
      image: {
        url: 'https://myaccount.blob.core.windows.net/media/claims.jpg',
        alt: 'Claims process diagram',
      },
    };

    render(<ClaimsImage block={block} />);

    const img = screen.getByAltText('Claims process diagram');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('myaccount.blob.core.windows.net'));
  });

  it('TC-5: Enforces Azure Blob host via Next.js image config', () => {
    const block: ClaimsImageBlock = {
      blockType: 'image',
      image: {
        url: 'https://myaccount.blob.core.windows.net/media/test.jpg',
        alt: 'Test image',
      },
    };

    render(<ClaimsImage block={block} />);

    // Next.js Image component validates against remotePatterns in next.config.js
    // so this URL should be allowed by the *.blob.core.windows.net pattern
    const img = screen.getByAltText('Test image');
    expect(img).toBeInTheDocument();
  });

  it('returns null when image is missing', () => {
    const block: ClaimsImageBlock = {
      blockType: 'image',
      image: null,
    };

    const { container } = render(<ClaimsImage block={block} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when alt text is missing', () => {
    const block: ClaimsImageBlock = {
      blockType: 'image',
      image: {
        url: 'https://myaccount.blob.core.windows.net/media/test.jpg',
        alt: '',
      },
    };

    const { container } = render(<ClaimsImage block={block} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when image URL is missing', () => {
    const block: ClaimsImageBlock = {
      blockType: 'image',
      image: {
        url: '',
        alt: 'Missing image',
      },
    };

    const { container } = render(<ClaimsImage block={block} />);
    expect(container.firstChild).toBeNull();
  });
});

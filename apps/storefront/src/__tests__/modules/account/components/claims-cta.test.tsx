import { render, screen } from '@testing-library/react';
import { ClaimsCta } from '@/modules/account/components/claims-blocks/cta';
import type { ClaimsCtaBlock } from '@/types/cms';

describe('ClaimsCta', () => {
  it('TC-4: Safe URLs are rendered as links', () => {
    const block: ClaimsCtaBlock = {
      blockType: 'cta',
      label: 'Learn more',
      url: 'https://example.com',
    };

    render(<ClaimsCta block={block} />);

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('TC-4: Internal paths are rendered as links', () => {
    const block: ClaimsCtaBlock = {
      blockType: 'cta',
      label: 'Back home',
      url: '/home',
    };

    render(<ClaimsCta block={block} />);

    const link = screen.getByRole('link', { name: /back home/i });
    expect(link).toHaveAttribute('href', '/home');
  });

  it('TC-4: Dangerous URLs are not rendered (fail closed)', () => {
    const dangerousUrls = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:alert(1)',
      'file:///etc/passwd',
    ];

    dangerousUrls.forEach((url) => {
      const block: ClaimsCtaBlock = {
        blockType: 'cta',
        label: 'Click me',
        url,
      };

      const { rerender } = render(<ClaimsCta block={block} />);

      // No link should be rendered
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      rerender(<ClaimsCta block={block} />);
    });
  });

  it('returns null when label or URL is missing', () => {
    const { container: c1 } = render(
      <ClaimsCta block={{ blockType: 'cta', label: 'Test', url: '' } as ClaimsCtaBlock} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <ClaimsCta block={{ blockType: 'cta', label: '', url: 'https://example.com' } as ClaimsCtaBlock} />
    );
    expect(c2.firstChild).toBeNull();
  });
});

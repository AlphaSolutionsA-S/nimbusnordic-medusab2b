import { render, screen } from '@testing-library/react';
import { ClaimsBlocks } from '@/modules/account/components/claims-blocks';
import type { ClaimsBlock } from '@/types/cms';

describe('ClaimsBlocks', () => {
  it('TC-1: Renders published blocks in order', () => {
    const blocks: ClaimsBlock[] = [
      { blockType: 'richText', content: { type: 'paragraph' } },
      {
        blockType: 'image',
        url: 'https://test.blob.core.windows.net/img.jpg',
        alt: 'Test',
      },
      {
        blockType: 'callout',
        title: 'Important notice',
        content: { type: 'paragraph' },
        variant: 'info',
      },
      { blockType: 'cta', label: 'Learn more', url: 'https://example.com' },
      { blockType: 'faq', rows: [{ question: 'Q1?', answer: 'A1' }] },
    ];

    render(<ClaimsBlocks blocks={blocks} />);

    // Verify all block types are rendered
    expect(screen.getAllByTestId('claims-rich-text-block')).toHaveLength(2);
    expect(screen.getByTestId('claims-image-block')).toBeInTheDocument();
    expect(screen.getByTestId('claims-callout-block')).toBeInTheDocument();
    expect(screen.getByTestId('claims-cta-block')).toBeInTheDocument();
    expect(screen.getByTestId('claims-faq-block')).toBeInTheDocument();
  });

  it('TC-2: Unknown block type is ignored (fail closed)', () => {
    const blocks = [
      { blockType: 'richText', content: { type: 'paragraph' } },
      { blockType: 'script', payload: 'alert(1)' } as unknown as ClaimsBlock,
      { blockType: 'cta', label: 'Action', url: '/safe' },
    ] as ClaimsBlock[];

    render(<ClaimsBlocks blocks={blocks} />);

    // Known blocks render
    expect(screen.getByTestId('claims-rich-text-block')).toBeInTheDocument();
    expect(screen.getByTestId('claims-cta-block')).toBeInTheDocument();

    // Unknown block (script) is not rendered
    expect(screen.queryByText('alert(1)')).not.toBeInTheDocument();
  });

  it('renders with empty blocks array', () => {
    render(<ClaimsBlocks blocks={[]} />);
    expect(screen.getByTestId('claims-blocks')).toBeInTheDocument();
    expect(screen.getByTestId('claims-blocks').children).toHaveLength(0);
  });
});

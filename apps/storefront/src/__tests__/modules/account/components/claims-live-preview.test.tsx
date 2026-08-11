import { useLivePreview } from '@payloadcms/live-preview-react';
import { render, screen } from '@testing-library/react';

import { ClaimsLivePreview } from '@/modules/account/components/claims-live-preview';
import type { PayloadClaimsPage } from '@/types/cms';

jest.mock('@payloadcms/live-preview-react', () => ({
  useLivePreview: jest.fn(),
}));

const mockedUseLivePreview = jest.mocked(useLivePreview);

describe('ClaimsLivePreview', () => {
  it('renders live document changes from the trusted Payload origin', () => {
    const initialData: PayloadClaimsPage = {
      title: 'Published claims',
      layout: [],
    };
    const liveData: PayloadClaimsPage = {
      title: 'Draft claims',
      layout: [
        {
          blockType: 'cta',
          label: 'Contact support',
          url: '/contact',
        },
      ],
    };

    mockedUseLivePreview.mockReturnValue({
      data: liveData,
      isLoading: false,
    });

    render(
      <ClaimsLivePreview
        initialData={initialData}
        serverURL="https://cms.example.com"
      />,
    );

    expect(mockedUseLivePreview).toHaveBeenCalledWith({
      depth: 2,
      initialData,
      serverURL: 'https://cms.example.com',
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Draft claims' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Contact support' }),
    ).toHaveAttribute('href', '/contact');
  });

  it('remains renderable while required fields are being edited', () => {
    mockedUseLivePreview.mockReturnValue({
      data: {},
      isLoading: false,
    });

    render(
      <ClaimsLivePreview
        initialData={{ title: 'Published claims', layout: [] }}
        serverURL="https://cms.example.com"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Claims' }),
    ).toBeInTheDocument();
  });
});

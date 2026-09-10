import { getClaimsPage, getPayloadLivePreviewURL } from '@/lib/data/cms';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Save and restore env vars between tests
const originalEnv = process.env;

describe('getClaimsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // TC-1: Missing config → null
  it('returns null when PAYLOAD_API_URL is missing', async () => {
    delete process.env.PAYLOAD_API_URL;
    process.env.PAYLOAD_API_KEY = 'test-key';

    const result = await getClaimsPage();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when PAYLOAD_API_KEY is missing', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    delete process.env.PAYLOAD_API_KEY;

    const result = await getClaimsPage();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses the public Payload origin for browser live preview', () => {
    process.env.PAYLOAD_API_URL = 'http://cms.internal:3001';
    process.env.PAYLOAD_PUBLIC_URL = 'https://cms.example.com/admin';

    expect(getPayloadLivePreviewURL()).toBe('https://cms.example.com');
  });

  it('disables browser live preview when PAYLOAD_PUBLIC_URL is missing', () => {
    delete process.env.PAYLOAD_PUBLIC_URL;

    expect(getPayloadLivePreviewURL()).toBeNull();
  });

  // TC-2: Published page mapped
  it('maps a published claims page correctly', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    process.env.PAYLOAD_API_KEY = 'test-key-123';
    process.env.PAYLOAD_PUBLIC_URL = 'https://cms.example.com';

    const mockPayload = {
      docs: [
        {
          title: 'Claims Information',
          layout: [
            {
              blockType: 'richText',
              content: { some: 'lexical content' },
            },
            {
              blockType: 'cta',
              label: 'Submit a Claim',
              url: 'https://example.com/claims',
            },
            {
              blockType: 'image',
              image: {
                url: '/api/media/file/claim.png',
                alt: 'Claim',
              },
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayload,
    });

    const result = await getClaimsPage();

    expect(result).toEqual({
      title: 'Claims Information',
      layout: [
        {
          blockType: 'richText',
          content: { some: 'lexical content' },
        },
        {
          blockType: 'cta',
          label: 'Submit a Claim',
          url: 'https://example.com/claims',
        },
        {
          blockType: 'image',
          url: 'https://cms.example.com/api/media/file/claim.png',
          alt: 'Claim',
        },
      ],
    });

    // Verify the request carried the auth header and published-only query
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('where%5Bslug%5D%5Bequals%5D=claims'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'users API-Key test-key-123',
        }),
      })
    );
  });

  // TC-3: Non-2xx / empty → null
  it('returns null on non-2xx response', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    process.env.PAYLOAD_API_KEY = 'test-key';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await getClaimsPage();
    expect(result).toBeNull();
  });

  it('returns null on empty docs', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    process.env.PAYLOAD_API_KEY = 'test-key';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [] }),
    });

    const result = await getClaimsPage();
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    process.env.PAYLOAD_API_KEY = 'test-key';

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getClaimsPage();
    expect(result).toBeNull();
  });

  // TC-4: Key never appears in returned data
  it('never exposes PAYLOAD_API_KEY in returned data', async () => {
    process.env.PAYLOAD_API_URL = 'http://localhost:3001';
    process.env.PAYLOAD_API_KEY = 'super-secret-key-12345';

    const mockPayload = {
      docs: [
        {
          title: 'Claims',
          layout: [
            {
              blockType: 'richText',
              content: 'Some content',
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayload,
    });

    const result = await getClaimsPage();

    // Verify the key does not appear in the result
    expect(JSON.stringify(result)).not.toContain('super-secret-key-12345');
    expect(result).toEqual({
      title: 'Claims',
      layout: [
        {
          blockType: 'richText',
          content: 'Some content',
        },
      ],
    });
  });
});

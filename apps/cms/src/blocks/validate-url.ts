/**
 * Validates a URL as safe for portal CTAs.
 * Allowlists http/https and internal paths (leading slash).
 * Rejects javascript:, data:, vbscript:, and other active schemes.
 */
export function isSafePortalUrl(value: string): true | string {
  if (!value || typeof value !== 'string') {
    return 'URL is required';
  }

  const trimmed = value.trim();

  // Allow https:// and http://
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return 'Invalid URL format';
    }
  }

  // Allow internal paths (leading slash)
  if (trimmed.startsWith('/')) {
    return true;
  }

  // Reject active schemes
  const lowerUrl = trimmed.toLowerCase();
  const activeSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
    'blob:',
  ];

  for (const scheme of activeSchemes) {
    if (lowerUrl.startsWith(scheme)) {
      return `URLs with scheme "${scheme}" are not allowed`;
    }
  }

  return 'URL must start with https://, http://, or / (internal path)';
}

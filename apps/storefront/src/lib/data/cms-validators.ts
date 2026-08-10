// URL validation for CMS links — matches CMS side validation
export function isSafePortalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Reject dangerous schemes
  const dangeroousSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
    'blob:',
  ];

  const lowerUrl = url.toLowerCase();
  if (dangeroousSchemes.some((scheme) => lowerUrl.startsWith(scheme))) {
    return false;
  }

  // Allow relative internal paths
  if (url.startsWith('/')) return true;

  // Allow http(s) URLs
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

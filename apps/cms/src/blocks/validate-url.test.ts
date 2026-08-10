import { describe, it, expect } from 'vitest';
import { isSafePortalUrl } from './validate-url';

describe('isSafePortalUrl', () => {
  // TC-1: Valid HTTPS URL
  it('should accept valid HTTPS URLs', () => {
    const result = isSafePortalUrl('https://example.com/path');
    expect(result).toBe(true);
  });

  // TC-2: Valid HTTP URL
  it('should accept valid HTTP URLs', () => {
    const result = isSafePortalUrl('http://example.com/path');
    expect(result).toBe(true);
  });

  // TC-3: Internal path with leading slash
  it('should accept internal paths starting with /', () => {
    const result = isSafePortalUrl('/account/claims');
    expect(result).toBe(true);
  });

  // TC-4: Reject javascript: scheme
  it('should reject javascript: scheme', () => {
    const result = isSafePortalUrl('javascript:alert("xss")');
    expect(typeof result).toBe('string');
    expect(result).toContain('javascript:');
  });

  // TC-5: Reject data: scheme
  it('should reject data: scheme', () => {
    const result = isSafePortalUrl('data:text/html,<script>alert("xss")</script>');
    expect(typeof result).toBe('string');
    expect(result).toContain('data:');
  });

  // TC-6: Reject vbscript: scheme
  it('should reject vbscript: scheme', () => {
    const result = isSafePortalUrl('vbscript:msgbox("xss")');
    expect(typeof result).toBe('string');
    expect(result).toContain('vbscript:');
  });

  // Additional: Reject file: scheme
  it('should reject file: scheme', () => {
    const result = isSafePortalUrl('file:///etc/passwd');
    expect(typeof result).toBe('string');
    expect(result).toContain('file:');
  });

  // Additional: Reject blob: scheme
  it('should reject blob: scheme', () => {
    const result = isSafePortalUrl('blob:https://example.com/123');
    expect(typeof result).toBe('string');
    expect(result).toContain('blob:');
  });

  // Additional: Reject empty URL
  it('should reject empty URL', () => {
    const result = isSafePortalUrl('');
    expect(typeof result).toBe('string');
  });

  // Additional: Handle whitespace in URLs
  it('should trim and validate URLs with leading/trailing whitespace', () => {
    const result = isSafePortalUrl('  https://example.com/path  ');
    expect(result).toBe(true);
  });

  // Additional: Reject invalid URL format
  it('should reject malformed HTTPS URLs', () => {
    const result = isSafePortalUrl('https://not a valid url');
    expect(typeof result).toBe('string');
  });
});

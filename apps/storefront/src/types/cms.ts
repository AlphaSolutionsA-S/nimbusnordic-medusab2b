export type ClaimsRichTextBlock = {
  blockType: 'richText';
  content: unknown;
};

export type ClaimsImageBlock = {
  blockType: 'image';
  url: string;
  alt: string;
  caption?: string;
};

export type ClaimsCalloutBlock = {
  blockType: 'callout';
  title: string;
  content: unknown;
  variant: string;
};

export type ClaimsCtaBlock = {
  blockType: 'cta';
  label: string;
  url: string;
};

export type ClaimsFaqBlock = {
  blockType: 'faq';
  rows: ReadonlyArray<{ question: string; answer: unknown }>;
};

export type ClaimsKnownBlock =
  | ClaimsRichTextBlock
  | ClaimsImageBlock
  | ClaimsCalloutBlock
  | ClaimsCtaBlock
  | ClaimsFaqBlock;

export type ClaimsBlock = ClaimsKnownBlock | { blockType: 'unknown' };

export type ClaimsPage = {
  title: string;
  layout: ReadonlyArray<ClaimsBlock>;
};

export type PayloadClaimsPage = {
  title?: string;
  layout?: ReadonlyArray<unknown>;
};

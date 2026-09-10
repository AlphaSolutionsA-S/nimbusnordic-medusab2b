import { lexicalEditor } from '@payloadcms/richtext-lexical';
import type { Block } from 'payload';
import { isSafePortalUrl } from './validate-url';

export const RichTextBlock: Block = {
  slug: 'richText',
  fields: [
    {
      name: 'content',
      type: 'richText',
      required: true,
      editor: lexicalEditor(),
    },
  ],
};

export const ImageBlock: Block = {
  slug: 'image',
  fields: [
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
};

export const CalloutBlock: Block = {
  slug: 'callout',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      editor: lexicalEditor(),
    },
    {
      name: 'variant',
      type: 'select',
      required: true,
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
      ],
    },
  ],
};

export const CtaBlock: Block = {
  slug: 'cta',
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      validate: (value: any) => {
        if (!value) return 'URL is required';
        const result = isSafePortalUrl(value);
        return result === true ? true : result;
      },
    },
  ],
};

export const FaqBlock: Block = {
  slug: 'faq',
  fields: [
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'answer',
          type: 'richText',
          required: true,
          editor: lexicalEditor(),
        },
      ],
    },
  ],
};

export const PORTAL_PAGE_BLOCKS = [
  RichTextBlock,
  ImageBlock,
  CalloutBlock,
  CtaBlock,
  FaqBlock,
];

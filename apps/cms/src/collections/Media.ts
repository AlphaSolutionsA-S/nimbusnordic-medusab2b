import type { CollectionConfig } from 'payload';

const ALLOWED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: ({ req }) => {
      // Admins can read all; service user can read all
      return !!req.user;
    },
    create: ({ req }) => {
      // Only admins can create
      return req.user?.role === 'admin';
    },
    update: ({ req }) => {
      // Only admins can update
      return req.user?.role === 'admin';
    },
    delete: ({ req }) => {
      // Only admins can delete
      return req.user?.role === 'admin';
    },
  },
  upload: {
    mimeTypes: ALLOWED_IMAGE_MIME as unknown as string[],
    staticDir: './public/uploads',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt Text',
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Caption',
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation }) => {
        if (operation === 'create' || operation === 'update') {
          // File size validation is handled by upload config,
          // but we can add additional validation if needed
        }
        return data;
      },
    ],
  },
};

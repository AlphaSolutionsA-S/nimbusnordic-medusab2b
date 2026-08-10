import type { CollectionConfig } from 'payload';
import { PORTAL_PAGE_BLOCKS } from '../blocks';

export const PortalPages: CollectionConfig = {
  slug: 'portal-pages',
  access: {
    read: ({ req }) => {
      // Admins see all; service user sees published only
      if (req.user?.role === 'admin') {
        return true;
      }
      if (req.user?.role === 'service') {
        return {
          _status: {
            equals: 'published',
          },
        };
      }
      return false;
    },
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 10,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      validate: (value: any) => {
        if (value !== 'claims') {
          return 'Slug must be "claims"';
        }
        return true;
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      blocks: PORTAL_PAGE_BLOCKS,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation }) => {
        if (data && (operation === 'create' || operation === 'update')) {
          // Enforce singleton: only one published claims page
          if (data._status === 'published') {
            data.slug = 'claims';
          }
        }
        return data;
      },
    ],
  },
};

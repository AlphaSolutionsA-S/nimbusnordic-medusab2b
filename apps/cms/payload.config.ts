import { postgresAdapter } from '@payloadcms/db-postgres';
import { resendAdapter } from '@payloadcms/email-resend';
import { azureStorage } from '@payloadcms/storage-azure';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import path from 'path';
import { fileURLToPath } from 'url';
import { Users } from './src/collections/Users';
import { Media } from './src/collections/Media';
import { PortalPages } from './src/collections/PortalPages';
import { getResendAdapterArgs } from './src/email';
import { getPayloadOrigin, getStorefrontOrigin } from './src/live-preview';
import { migrations } from './src/migrations';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const resendAdapterArgs = getResendAdapterArgs();
const localOrigins =
  process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001'];
const allowedOrigins = [...new Set([getPayloadOrigin(), getStorefrontOrigin(), ...localOrigins])];

export default buildConfig({
  admin: {
    user: 'users',
  },
  editor: lexicalEditor(),
  collections: [Users, Media, PortalPages],
  cors: allowedOrigins,
  csrf: allowedOrigins,
  email: resendAdapterArgs ? resendAdapter(resendAdapterArgs) : undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    prodMigrations: migrations,
    push: false,
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  plugins: [
    azureStorage({
      collections: {
        media: true,
      },
      allowContainerCreate: process.env.AZURE_STORAGE_ALLOW_CONTAINER_CREATE === 'true',
      baseURL: process.env.AZURE_STORAGE_ACCOUNT_BASEURL || '',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
    }),
  ],
});

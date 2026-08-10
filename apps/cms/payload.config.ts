import { postgresAdapter } from '@payloadcms/db-postgres';
import { azureStorage } from '@payloadcms/storage-azure';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    // IMPLEMENT (task 02): set user collection slug once Users collection exists
  },
  editor: lexicalEditor(),
  // IMPLEMENT (task 02): collections: [PortalPages, Media, Users]
  collections: [],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  plugins: [
    azureStorage({
      // IMPLEMENT (task 02): enable only for the `media` collection
      collections: {},
      allowContainerCreate: process.env.AZURE_STORAGE_ALLOW_CONTAINER_CREATE === 'true',
      baseURL: process.env.AZURE_STORAGE_ACCOUNT_BASEURL || '',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
    }),
  ],
});

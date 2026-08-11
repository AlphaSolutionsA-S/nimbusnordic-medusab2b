import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
import config from '@payload-config';

import { importMap } from './importMap.js';

type AdminPageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({ params, searchParams }: AdminPageProps) =>
  generatePageMetadata({
    config: Promise.resolve(config),
    params: params.then(({ segments }) => ({ segments: segments ?? [] })),
    searchParams,
  });

export default function AdminPage({ params, searchParams }: AdminPageProps) {
  const normalizedParams = params.then(({ segments }) => ({ segments: segments ?? [] }));

  return RootPage({
    config: Promise.resolve(config),
    importMap,
    params: normalizedParams,
    searchParams,
  });
}

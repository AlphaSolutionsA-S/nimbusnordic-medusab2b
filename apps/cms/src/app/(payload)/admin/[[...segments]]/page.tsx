import type { Metadata } from 'next';

import config from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';

import { importMap } from '../importMap';

type AdminPageProps = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export function generateMetadata({
  params,
  searchParams,
}: AdminPageProps): Promise<Metadata> {
  return generatePageMetadata({ config, params, searchParams });
}

export default function AdminPage({ params, searchParams }: AdminPageProps) {
  return RootPage({ config, params, searchParams, importMap });
}

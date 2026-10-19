'use client';
import dynamic from 'next/dynamic';
import AssetDetailsSkeleton from '@/components/AssetDetailsSkeleton';

const AssetClient = dynamic(() => import('./AssetClient'), {
  ssr: false,
  loading: () => <AssetDetailsSkeleton />
});

export default function AssetClientWrapper({ id }: { id: string }) {
  return <AssetClient id={id} />;
}


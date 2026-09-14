'use client';
import dynamic from 'next/dynamic';

const AssetClient = dynamic(() => import('./AssetClient'), { ssr: false });

export default function AssetClientWrapper() {
  return <AssetClient />;
}

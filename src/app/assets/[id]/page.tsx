import dynamic from 'next/dynamic';

export const runtime = 'edge';

const AssetClient = dynamic(() => import('./AssetClient'), { ssr: false });

export default function AssetDetailsPage() {
  return <AssetClient />;
}

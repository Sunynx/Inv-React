import AssetClientWrapper from './AssetClientWrapper';

export const runtime = 'edge';

export default async function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetClientWrapper id={id} />;
}

// removed

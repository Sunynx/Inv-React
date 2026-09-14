import LicenseClientWrapper from './LicenseClientWrapper';

export const runtime = 'edge';

export default async function LicenseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LicenseClientWrapper id={id} />;
}

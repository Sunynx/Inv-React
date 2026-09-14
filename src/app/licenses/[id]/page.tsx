import dynamic from 'next/dynamic';

export const runtime = 'edge';

const LicenseClient = dynamic(() => import('./LicenseClient'), { ssr: false });

export default async function LicenseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LicenseClient id={id} />;
}

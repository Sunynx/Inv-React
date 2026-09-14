'use client';
import dynamic from 'next/dynamic';

const LicenseClient = dynamic(() => import('./LicenseClient'), { ssr: false });

export default function LicenseClientWrapper({ id }: { id: string }) {
  return <LicenseClient id={id} />;
}

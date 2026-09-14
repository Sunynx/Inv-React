'use client';
import { useState, useEffect, lazy, Suspense } from 'react';

const LicenseClient = lazy(() => import('./LicenseClient'));

export default function LicenseClientWrapper({ id }: { id: string }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-12 text-muted-foreground">Loading license details...</div>}>
      <LicenseClient id={id} />
    </Suspense>
  );
}

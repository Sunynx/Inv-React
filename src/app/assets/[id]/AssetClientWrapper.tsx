'use client';
import { useState, useEffect, lazy, Suspense } from 'react';

const AssetClient = lazy(() => import('./AssetClient'));

export default function AssetClientWrapper({ id }: { id: string }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-12 text-muted-foreground">Loading asset details...</div>}>
      <AssetClient id={id} />
    </Suspense>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, X, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanner, setScanner] = useState<QrScanner | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    // Run only once on mount to check for ?code= in URL
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('code');
    if (codeFromUrl) {
      setScanResult(codeFromUrl);
      setTimeout(() => lookupAsset(codeFromUrl), 500);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop();
        scanner.destroy();
      }
    };
  }, [scanner]);

  const startScanner = async () => {
    if (!videoRef.current) return;
    
    setScanResult(null);
    setScanning(true);
    
    try {
      const qrScanner = new QrScanner(
        videoRef.current,
        result => handleScanSuccess(result.data),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        },
      );
      setScanner(qrScanner);
      await qrScanner.start();
    } catch (e: any) {
      setScanning(false);
      toast.error('Camera error: ' + (e?.message || 'Permission denied'));
    }
  };

  const stopScanner = () => {
    if (scanner) {
      scanner.stop();
      scanner.destroy();
      setScanner(null);
    }
    setScanning(false);
  };

  const handleScanSuccess = async (data: string) => {
    stopScanner();
    setScanResult(data);
    toast.success('QR Code Scanned!');
    
    // Parse result. Might be a URL containing ?code=ASSET-001 or just raw code.
    let assetCode = data;
    try {
      if (data.includes('http')) {
        const url = new URL(data);
        const codeParam = url.searchParams.get('code');
        if (codeParam) assetCode = codeParam;
      }
    } catch(e) {}

    lookupAsset(assetCode);
  };

  const lookupAsset = async (code: string) => {
    setLoadingAsset(true);
    try {
      const { data, error } = await supabase.from('assets').select('id').eq('asset_code', code).single();
      if (error || !data) {
        toast.error('Asset not found in database: ' + code);
        return;
      }
      router.push(`/assets/${data.id}`);
    } catch (e: any) {
      toast.error('Error finding asset: ' + e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Scan QR Code</h1>
        <p className="text-muted-foreground mt-2">Scan an asset's QR code to view and edit its details.</p>
      </div>

      <Card className="overflow-hidden border-2 border-dashed shadow-sm">
        <CardContent className="p-0 relative bg-black aspect-[4/3] flex items-center justify-center">
          <video 
            ref={videoRef} 
            className={`w-full h-full object-cover ${!scanning ? 'hidden' : ''}`}
          ></video>
          
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900">
              <ScanLine size={64} className="mb-4 text-slate-500" />
              <Button onClick={startScanner} size="lg" className="px-8 text-lg font-medium">
                Start Scanner
              </Button>
            </div>
          )}

          {scanning && (
            <Button 
              variant="destructive" 
              size="icon"
              className="absolute top-4 right-4 rounded-full shadow-lg"
              onClick={stopScanner}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </CardContent>
      </Card>

      {scanResult && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Last Scanned Code:</p>
            <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
              {scanResult}
            </div>
            {loadingAsset && <p className="text-primary font-medium">Looking up asset...</p>}
          </CardContent>
        </Card>
      )}

      {/* Manual lookup fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manual Lookup</CardTitle>
          <CardDescription>If the scanner isn't working, enter the Asset Code manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              lookupAsset(formData.get('code') as string);
            }}
          >
            <Input name="code" placeholder="e.g. LAP-2023-001" required className="flex-1" />
            <Button type="submit" variant="secondary">
              <Search className="mr-2 h-4 w-4" /> Lookup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

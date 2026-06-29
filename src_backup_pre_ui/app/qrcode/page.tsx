'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Printer, Download, CheckSquare, Square, FilePlus2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QRCodePage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      const { data, error } = await supabase.from('assets').select('id, name, asset_code').order('created_at', { ascending: false });
      if (error) throw error;
      setAssets(data || []);
      if (data && data.length > 0) setSelectedAssets([data[0]]);
    } catch (err: any) {
      toast.error('Failed to load assets: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredAssets = assets.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.asset_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (asset: any) => {
    if (selectedAssets.find(a => a.id === asset.id)) {
      setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
    } else {
      setSelectedAssets([...selectedAssets, asset]);
    }
  };

  const selectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets([...filteredAssets]);
    }
  };

  const getQrUrl = (code: string) => {
    return typeof window !== 'undefined' ? `${window.location.origin}/scan?code=${code}` : '';
  };

  // If in print mode, render ONLY the print layout
  if (printMode) {
    return (
      <div className="bg-background text-foreground min-h-screen p-8 print-container transition-colors duration-300">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
            @page { margin: 1cm; }
          }
        `}} />
        <div className="mb-4 flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold">Print Preview ({selectedAssets.length} labels)</h2>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setPrintMode(false)}>Cancel</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/> Print Now</Button>
          </div>
        </div>
        
        {/* A4 Sticker Layout Example: Grid of labels */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {selectedAssets.map(asset => (
            <div key={asset.id} className="border border-border p-4 rounded-lg flex flex-col items-center text-center bg-card">
              <div className="font-bold text-sm mb-2 text-foreground">{asset.asset_code}</div>
              <QRCodeSVG 
                value={getQrUrl(asset.asset_code)} 
                size={120}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/logorpm.png", 
                  x: undefined,
                  y: undefined,
                  height: 24,
                  width: 24,
                  excavate: true,
                }}
              />
              <div className="mt-2 text-xs line-clamp-2 leading-tight text-foreground/80">
                {asset.name}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground font-medium">Royal Phuket Marina</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Advanced QR Code Generator</h1>
          <p className="text-muted-foreground mt-1">Select multiple assets for bulk printing with custom RPM logos</p>
        </div>
        {selectedAssets.length > 0 && (
          <Button onClick={() => setPrintMode(true)} className="bg-primary shadow-md text-primary-foreground">
            <Printer className="mr-2 h-4 w-4" /> Bulk Print ({selectedAssets.length})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-1 h-[650px] flex flex-col shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/20">
            <CardTitle>Select Assets</CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or code..."
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex justify-between items-center mt-3 pt-2">
              <span className="text-xs font-medium text-muted-foreground">{filteredAssets.length} assets found</span>
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs px-2 text-primary">
                {selectedAssets.length === filteredAssets.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-3 space-y-1 p-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mb-2"></span>
                Loading...
              </div>
            ) : filteredAssets.map(asset => {
              const isSelected = !!selectedAssets.find(a => a.id === asset.id);
              return (
                <div 
                  key={asset.id} 
                  onClick={() => toggleSelect(asset)}
                  className={`p-3 rounded-md cursor-pointer transition-colors border flex items-center gap-3 ${isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted border-border'}`}
                >
                  {isSelected ? <CheckSquare className="h-5 w-5 text-primary shrink-0" /> : <Square className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>{asset.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{asset.asset_code}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 shadow-sm border-border transition-colors">
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle>Label Preview</CardTitle>
            <CardDescription>How the printed sticker will look</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-16 bg-muted/10">
            {selectedAssets.length > 0 ? (
              <div className="bg-background text-foreground p-8 rounded-xl border border-border flex flex-col items-center relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
                <div className="mb-6 font-bold text-2xl text-center tracking-tight mt-2">{selectedAssets[0].asset_code}</div>
                <div className="p-3 border border-dashed border-border rounded-xl bg-background transition-colors">
                  <QRCodeSVG 
                    value={getQrUrl(selectedAssets[0].asset_code)} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "/logorpm.png", 
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                <div className="mt-6 text-center font-semibold text-lg text-foreground/90 line-clamp-2 px-4">
                  {selectedAssets[0].name}
                </div>
                <div className="mt-2 text-center text-sm tracking-widest text-muted-foreground uppercase font-bold">
                  Royal Phuket Marina
                </div>
                {selectedAssets.length > 1 && (
                  <div className="absolute bottom-2 right-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">
                    + {selectedAssets.length - 1} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-20 flex flex-col items-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 transition-colors">
                  <FilePlus2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No Asset Selected</h3>
                <p className="text-sm mt-1 max-w-xs mx-auto">Check the boxes on the left to select assets for bulk label printing.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

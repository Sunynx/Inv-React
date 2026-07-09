import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface BulkPrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: any[];
}

export default function BulkPrintQRModal({ isOpen, onClose, selectedAssets }: BulkPrintQRModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Add print specific styles
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #print-container, #print-container * { visibility: visible; }
        #print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 10mm;
        }
        .no-print { display: none !important; }
        @page { margin: 0; size: auto; }
      }
    `;
    document.head.appendChild(printStyle);
    
    document.body.innerHTML = `<div id="print-container">${printContent}</div>`;
    window.print();
    
    // Restore
    document.body.innerHTML = originalContent;
    document.head.removeChild(printStyle);
    window.location.reload(); // Quick way to restore React event listeners after messing with innerHTML
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] bg-background text-foreground transition-colors duration-300 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold">Print QR Codes</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Preparing {selectedAssets.length} labels for printing</p>
          </div>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <Printer className="w-4 h-4 mr-2" /> Print All
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-start gap-2 border border-blue-200 dark:border-blue-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p><strong>Tip for printing:</strong> Set margins to "Minimum" or "None" and ensure "Background graphics" is enabled in your print dialog.</p>
          </div>
          
          <div className="bg-white dark:bg-white text-black p-8 shadow-sm rounded border max-w-full mx-auto" ref={printRef}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {selectedAssets.map((asset) => (
                <div key={asset.id} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl break-inside-avoid">
                  <div className="font-bold text-center text-sm mb-2">{asset.asset_code}</div>
                  <QRCodeSVG value={asset.asset_code} size={100} level="M" includeMargin={false} />
                  <div className="text-xs text-center mt-3 font-medium line-clamp-1">{asset.name}</div>
                  {asset.departments?.name && (
                    <div className="text-[10px] text-center text-gray-500 mt-1">{asset.departments.name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

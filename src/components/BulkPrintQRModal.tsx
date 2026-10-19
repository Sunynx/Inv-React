'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, AlertCircle, Sliders, Check } from 'lucide-react';
import AssetLabelSticker, { 
  STANDARD_LABEL_TEMPLATES, 
  DEFAULT_LABEL_OPTIONS, 
  LabelTemplateConfig, 
  LabelFieldOptions 
} from '@/components/AssetLabelSticker';

interface BulkPrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: any[];
}

export default function BulkPrintQRModal({ isOpen, onClose, selectedAssets }: BulkPrintQRModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('50x25');
  const [options, setOptions] = useState<LabelFieldOptions>(DEFAULT_LABEL_OPTIONS);

  const activeTemplate = useMemo<LabelTemplateConfig>(() => {
    return STANDARD_LABEL_TEMPLATES.find(t => t.id === selectedTemplateId) || STANDARD_LABEL_TEMPLATES[0];
  }, [selectedTemplateId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Dynamic Print Styles for Modal */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #bulk-modal-print-area, #bulk-modal-print-area * {
            visibility: visible;
          }
          #bulk-modal-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }

          ${activeTemplate.category === 'thermal' || activeTemplate.category === 'custom' ? `
            @page {
              size: ${activeTemplate.widthMm}mm ${activeTemplate.heightMm}mm;
              margin: 0mm;
            }
            .bulk-thermal-list {
              display: block;
            }
            .bulk-label-item {
              width: ${activeTemplate.widthMm}mm !important;
              height: ${activeTemplate.heightMm}mm !important;
              page-break-after: always;
              break-after: page;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              overflow: hidden;
            }
          ` : `
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            .bulk-a4-grid {
              display: grid !important;
              grid-template-columns: ${activeTemplate.id === 'a4_3x8' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'} !important;
              gap: 2mm 3mm !important;
              page-break-after: always;
            }
            .bulk-label-item {
              width: ${activeTemplate.widthMm}mm !important;
              height: ${activeTemplate.heightMm}mm !important;
              page-break-inside: avoid;
              break-inside: avoid;
              margin: 0 !important;
              box-shadow: none !important;
            }
          `}
        }
      `}} />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[850px] bg-background text-foreground transition-colors duration-300 max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                พิมพ์สติกเกอร์บาร์โค้ด ({selectedAssets.length} รายการ)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                เลือกขนาดสติกเกอร์ที่ต้องการพิมพ์ (รองรับทั้งม้วน Thermal และแผ่น A4)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
                ยกเลิก
              </Button>
              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer">
                <Printer className="w-4 h-4 mr-1.5" /> สั่งพิมพ์ทันที
              </Button>
            </div>
          </DialogHeader>

          {/* Configuration & Controls */}
          <div className="p-4 bg-muted/20 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">ขนาดสติกเกอร์:</span>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_LABEL_TEMPLATES.filter(t => t.id !== 'custom').map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                      selectedTemplateId === tmpl.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={options.showLogo} 
                  onChange={(e) => setOptions(prev => ({ ...prev, showLogo: e.target.checked }))} 
                  className="rounded text-primary h-3.5 w-3.5"
                />
                <span>โลโก้ RPM</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={options.showSerial} 
                  onChange={(e) => setOptions(prev => ({ ...prev, showSerial: e.target.checked }))} 
                  className="rounded text-primary h-3.5 w-3.5"
                />
                <span>Serial Number</span>
              </label>
            </div>
          </div>

          {/* Preview Container */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50 space-y-4">
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 rounded-lg text-xs flex items-start gap-2 border border-blue-200 dark:border-blue-900">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <p>
                <strong>คำแนะนำการพิมพ์:</strong> ในหน้าต่าง Print Dialog ให้เลือกขนาดกระดาษให้ตรงกับแม่แบบ ({activeTemplate.widthMm} x {activeTemplate.heightMm} mm) และปรับ Margins เป็น <b>"None"</b>
              </p>
            </div>

            {/* Sticker Preview Grid */}
            <div className="bg-white p-6 shadow-sm rounded-xl border border-slate-200 max-w-full mx-auto">
              <div className="flex flex-wrap gap-4 items-center justify-center">
                {selectedAssets.map((asset) => (
                  <div key={asset.id} className="shadow-xs hover:shadow-md transition-shadow">
                    <AssetLabelSticker 
                      asset={asset}
                      template={activeTemplate}
                      options={options}
                      scale={1.5}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden print area for modal */}
      <div id="bulk-modal-print-area" className="hidden print:block">
        {activeTemplate.category === 'thermal' || activeTemplate.category === 'custom' ? (
          <div className="bulk-thermal-list">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="bulk-label-item">
                <AssetLabelSticker 
                  asset={asset}
                  template={activeTemplate}
                  options={{ ...options, showBorder: false }}
                  scale={1.0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bulk-a4-grid">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="bulk-label-item">
                <AssetLabelSticker 
                  asset={asset}
                  template={activeTemplate}
                  options={options}
                  scale={1.0}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

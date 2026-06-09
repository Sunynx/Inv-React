'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Box } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProcurementReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onSaved: () => void;
}

export default function ProcurementReceiveModal({ isOpen, onClose, document, onSaved }: ProcurementReceiveModalProps) {
  const [assetInputs, setAssetInputs] = useState<any[]>([]);
  const [stockInputs, setStockInputs] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (document?.items) {
      const generatedAssets: any[] = [];
      const generatedStocks: any[] = [];

      document.items.forEach((item: any) => {
        if (item.type === 'Asset') {
          for (let i = 0; i < item.quantity; i++) {
            generatedAssets.push({
              originalName: item.name,
              asset_code: `A-${Date.now().toString().slice(-6)}-${i+1}`,
              name: item.name,
              price: item.price
            });
          }
        } else {
          generatedStocks.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            stockId: '' // In a full app, we would map to existing stock via Select
          });
        }
      });

      setAssetInputs(generatedAssets);
      setStockInputs(generatedStocks);
    }
  }, [document, isOpen]);

  const updateAsset = (idx: number, field: string, val: string) => {
    const newAssets = [...assetInputs];
    newAssets[idx][field] = val;
    setAssetInputs(newAssets);
  };

  const handleReceive = async () => {
    setIsProcessing(true);
    try {
      // 1. Insert Assets
      if (assetInputs.length > 0) {
        const assetsToInsert = assetInputs.map(a => ({
          asset_code: a.asset_code,
          name: a.name,
          price: a.price,
          status: 'ใช้งาน'
        }));
        const { error: assetError } = await supabase.from('assets').insert(assetsToInsert);
        if (assetError) throw assetError;
      }

      // 2. Insert/Update Stocks
      if (stockInputs.length > 0) {
        // Simplified: Just insert them as new stock items for now
        const stocksToInsert = stockInputs.map(s => ({
          name: s.name,
          quantity: s.quantity,
          price: s.price,
          unit: 'ชิ้น'
        }));
        const { error: stockError } = await supabase.from('stock_items').insert(stocksToInsert);
        if (stockError) throw stockError;
      }

      // 3. Update Document Status
      const { error: docError } = await supabase
        .from('procurement')
        .update({ status: 'ได้รับของแล้ว' })
        .eq('id', document.id);
        
      if (docError) throw docError;

      toast.success('รับสินค้าและเพิ่มเข้าคลังเรียบร้อยแล้ว!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รับเข้าสินค้า (Receive Items)</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            ระบุรายละเอียดเพื่อนำเข้าระบบ Assets หรือ Stock
          </p>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {assetInputs.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Box className="w-4 h-4 text-blue-600" /> Assets (ทรัพย์สินมีรหัส)</h4>
              <div className="bg-muted/30 p-4 rounded-md space-y-3 border">
                {assetInputs.map((asset, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Asset Code</Label>
                      <Input value={asset.asset_code} onChange={e => updateAsset(idx, 'asset_code', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="flex-[2] space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Asset Name</Label>
                      <Input value={asset.name} onChange={e => updateAsset(idx, 'name', e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stockInputs.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Box className="w-4 h-4 text-emerald-600" /> Stock Items (วัสดุสิ้นเปลือง/อะไหล่)</h4>
              <div className="bg-muted/30 p-4 rounded-md space-y-2 border">
                {stockInputs.map((stock, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded shadow-sm text-sm">
                    <span className="font-medium">{stock.name}</span>
                    <span className="text-muted-foreground">จำนวน: <span className="font-bold text-foreground">{stock.quantity}</span> รายการ</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2 italic">* ระบบจะเพิ่มไอเท็มเหล่านี้เข้าสู่หน้า Stock โดยอัตโนมัติ</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleReceive} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
            {isProcessing ? 'กำลังประมวลผล...' : <><CheckCircle2 className="w-4 h-4 mr-2" /> ยืนยันการรับเข้า</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

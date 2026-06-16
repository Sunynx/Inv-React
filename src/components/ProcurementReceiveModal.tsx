'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Box, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import { generateAssetCodeStr } from '@/lib/utils';

interface ProcurementReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onSaved: () => void;
}

export default function ProcurementReceiveModal({ isOpen, onClose, document, onSaved }: ProcurementReceiveModalProps) {
  const [itemsToReceive, setItemsToReceive] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
    }
  }, [isOpen]);

  const fetchMetadata = async () => {
    try {
      const [catRes, deptRes, assetCatsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('assets').select('category_id').not('category_id', 'is', null)
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (assetCatsRes.data) {
        const counts: Record<string, number> = {};
        assetCatsRes.data.forEach(a => {
           counts[a.category_id] = (counts[a.category_id] || 0) + 1;
        });
        setCategoryCounts(counts);
      }
    } catch (e) {
      console.error('Error fetching metadata', e);
    }
  };

  useEffect(() => {
    if (document?.items && isOpen) {
      let currentAssetIndex = 0;
      
      const year = new Date().getFullYear() + 543;
      const yearShort = String(year).slice(-2);
      const month = String(new Date().getMonth() + 1).padStart(2, '0');

      const initialItems = document.items.map((item: any, idx: number) => {
        const total = Number(item.quantity) || 0;
        const received = Number(item.received_quantity) || 0;
        const remaining = Math.max(0, total - received);
        const receive_now = remaining > 0 ? remaining : 0;
        const generatedAssets = [];
        
        if (item.type === 'Asset') {
          for (let i = 0; i < receive_now; i++) {
             // We don't generate a code until they select a category and department
             const code = '';
             
             generatedAssets.push({
               asset_code: code,
               name: item.name,
               price: item.price,
               category_id: '',
               department_id: '',
               location: ''
             });
          }
        }
        
        return {
          ...item,
          total,
          received,
          remaining,
          receive_now,
          generatedAssets,
          stock_category_id: '',
          stock_location: ''
        };
      });
      setItemsToReceive(initialItems);
    }
  }, [document, isOpen, baseAssetCount]);

  const updateReceiveNow = (idx: number, val: string) => {
    const num = Math.min(itemsToReceive[idx].remaining, Math.max(0, parseInt(val) || 0));
    const newItems = [...itemsToReceive];
    newItems[idx].receive_now = num;
    
    if (newItems[idx].type === 'Asset') {
      const year = new Date().getFullYear() + 543;
      const yearShort = String(year).slice(-2);
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // We need to re-evaluate the sequence for all assets to keep them contiguous
      let currentAssetIndex = 0;
      newItems.forEach(item => {
        if (item.type === 'Asset') {
          const assets = [];
          for (let i = 0; i < item.receive_now; i++) {
            const existing = item.generatedAssets && item.generatedAssets[i];
            const code = existing ? existing.asset_code : '';
            
            assets.push({
              asset_code: code,
              name: existing ? existing.name : item.name,
              price: existing ? existing.price : item.price,
              category_id: existing ? existing.category_id : '',
              department_id: existing ? existing.department_id : '',
              location: existing ? existing.location : ''
            });
          }
          item.generatedAssets = assets;
        }
      });
    }
    setItemsToReceive(newItems);
  };

  const updateAssetField = (itemIdx: number, assetIdx: number, field: string, val: string) => {
    const newItems = [...itemsToReceive];
    const asset = newItems[itemIdx].generatedAssets[assetIdx];
    asset[field] = val;
    
    if (field === 'category_id' || field === 'department_id') {
      const deptId = asset.department_id;
      const catId = asset.category_id;
      if (deptId && catId) {
        const dept = departments.find(d => d.id === deptId);
        const cat = categories.find(c => c.id === catId);
        if (dept && cat) {
           let seq = (categoryCounts[catId] || 0) + 1;
           for (let i = 0; i <= itemIdx; i++) {
              const it = newItems[i];
              if (it.type === 'Asset' && it.generatedAssets) {
                 for (let j = 0; j < it.generatedAssets.length; j++) {
                    if (i === itemIdx && j === assetIdx) break;
                    if (it.generatedAssets[j].category_id === catId) {
                       seq++;
                    }
                 }
              }
           }
           asset.asset_code = generateAssetCodeStr(dept.name, cat.name, seq);
        }
      }
    }
    
    setItemsToReceive(newItems);
  };

  const updateStockField = (itemIdx: number, field: string, val: string) => {
    const newItems = [...itemsToReceive];
    newItems[itemIdx][field] = val;
    setItemsToReceive(newItems);
  };

  const handleReceive = async () => {
    setIsProcessing(true);
    try {
      // 1. Insert Assets
      const assetsToInsert = itemsToReceive
        .filter(i => i.type === 'Asset' && i.receive_now > 0)
        .flatMap(i => i.generatedAssets.map((a: any) => ({
          asset_code: a.asset_code,
          name: a.name,
          price: a.price,
          category_id: a.category_id || null,
          department_id: a.department_id || null,
          location: a.location,
          status: 'ใช้งาน'
        })));
        
      if (assetsToInsert.length > 0) {
        const { error: assetError } = await supabase.from('assets').insert(assetsToInsert);
        if (assetError) throw assetError;
      }

      // 2. Insert/Update Stocks
      // For stock, we should ideally check if it exists or insert new.
      // Assuming we insert new stock_items records (or update existing if logic requires it).
      const stocksToInsert = itemsToReceive
        .filter(i => i.type !== 'Asset' && i.receive_now > 0)
        .map(s => ({
          name: s.name,
          quantity: s.receive_now,
          price: s.price,
          unit: 'ชิ้น',
          category: s.stock_category_id ? categories.find(c => c.id === s.stock_category_id)?.name : null,
          location: s.stock_location || null
        }));
        
      if (stocksToInsert.length > 0) {
        // Find existing stocks by name to update quantity instead of duplicate inserts
        for (const stock of stocksToInsert) {
          const { data: existingStock } = await supabase.from('stock_items').select('*').eq('name', stock.name).limit(1);
          if (existingStock && existingStock.length > 0) {
             const currentQty = Number(existingStock[0].quantity) || 0;
             await supabase.from('stock_items').update({
               quantity: currentQty + stock.quantity,
               last_restocked: new Date().toISOString()
             }).eq('id', existingStock[0].id);
          } else {
             await supabase.from('stock_items').insert([stock]);
          }
        }
      }

      // 3. Update Document Status and Items
      const newPrItems = document.items.map((item: any, idx: number) => {
        const receivedNow = itemsToReceive[idx].receive_now || 0;
        return {
          ...item,
          received_quantity: (Number(item.received_quantity) || 0) + receivedNow
        };
      });

      const allFullyReceived = newPrItems.every((item: any) => (Number(item.received_quantity) || 0) >= (Number(item.quantity) || 0));
      const newStatus = allFullyReceived ? 'ได้รับของแล้ว' : 'รับของบางส่วน';

      const { error: docError } = await supabase
        .from('procurement')
        .update({ status: newStatus, items: newPrItems })
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
      <DialogContent className="sm:max-w-5xl !w-[95vw] md:!w-[900px] lg:!w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รับเข้าสินค้า (Receive Items)</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            ระบุรายละเอียดเพื่อนำเข้าระบบ Assets หรือ Stock
          </p>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">รายการสิ่งของที่สั่งซื้อ</h4>
            
            <div className="bg-white border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">รายการ</th>
                    <th className="px-4 py-2 text-center font-medium">สั่งไป</th>
                    <th className="px-4 py-2 text-center font-medium">รับแล้ว</th>
                    <th className="px-4 py-2 text-center font-medium">เหลือ</th>
                    <th className="px-4 py-2 text-center font-medium w-32">รับรอบนี้</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsToReceive.map((item, idx) => (
                    <tr key={idx} className={item.remaining === 0 ? 'bg-green-50/50' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.type === 'Asset' ? 'ทรัพย์สิน' : 'วัสดุสิ้นเปลือง'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{item.total}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{item.received}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-medium">{item.remaining}</td>
                      <td className="px-4 py-3">
                        {item.remaining > 0 ? (
                          <Input 
                            type="number" 
                            min="0" 
                            max={item.remaining} 
                            value={item.receive_now} 
                            onChange={(e) => updateReceiveNow(idx, e.target.value)}
                            className="h-8 text-center"
                          />
                        ) : (
                          <div className="text-center text-xs text-green-600 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ครบแล้ว
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Asset Configuration */}
          {itemsToReceive.some(i => i.type === 'Asset' && i.receive_now > 0) && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Box className="w-4 h-4 text-blue-600" /> ระบุรายละเอียดทรัพย์สิน (Assets)</h4>
              <div className="bg-muted/20 p-4 rounded-md space-y-4 border">
                {itemsToReceive.map((item, itemIdx) => 
                  item.type === 'Asset' && item.receive_now > 0 ? (
                    <div key={itemIdx} className="space-y-3 border-b pb-4 last:border-0 last:pb-0">
                      <div className="font-medium text-sm text-blue-800">{item.name} <span className="text-muted-foreground font-normal">({item.receive_now} ชิ้น)</span></div>
                      {item.generatedAssets.map((asset: any, assetIdx: number) => (
                        <div key={assetIdx} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-start bg-white p-4 rounded border shadow-sm pl-5 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l"></div>
                          
                          <div className="md:col-span-3">
                            <Label className="text-xs text-muted-foreground mb-1 block">รหัสทรัพย์สิน</Label>
                            <Input 
                              value={asset.asset_code} 
                              onChange={e => updateAssetField(itemIdx, assetIdx, 'asset_code', e.target.value)} 
                              className="h-9 text-sm font-mono" 
                            />
                          </div>
                          
                          <div className="md:col-span-3">
                            <Label className="text-xs text-muted-foreground mb-1 block">ชื่อทรัพย์สิน</Label>
                            <Input 
                              value={asset.name} 
                              onChange={e => updateAssetField(itemIdx, assetIdx, 'name', e.target.value)} 
                              className="h-9 text-sm" 
                            />
                          </div>

                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground mb-1 block">หมวดหมู่</Label>
                            <Select value={asset.category_id} onValueChange={v => updateAssetField(itemIdx, assetIdx, 'category_id', v)}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                              <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground mb-1 block">แผนก</Label>
                            <Select value={asset.department_id} onValueChange={v => updateAssetField(itemIdx, assetIdx, 'department_id', v)}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือกแผนก..." /></SelectTrigger>
                              <SelectContent>
                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground mb-1 block">สถานที่ (Location)</Label>
                            <Input 
                              value={asset.location} 
                              onChange={e => updateAssetField(itemIdx, assetIdx, 'location', e.target.value)} 
                              className="h-9 text-sm" 
                              placeholder="ห้อง..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Stock Configuration */}
          {itemsToReceive.some(i => i.type !== 'Asset' && i.receive_now > 0) && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-amber-600" /> ระบุรายละเอียดวัสดุสิ้นเปลือง (Stock)</h4>
              <div className="bg-muted/20 p-4 rounded-md space-y-3 border">
                {itemsToReceive.map((item, itemIdx) => 
                  item.type !== 'Asset' && item.receive_now > 0 ? (
                    <div key={itemIdx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-3 rounded border shadow-sm pl-4 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l"></div>
                      
                      <div className="md:col-span-6">
                        <div className="font-medium text-sm text-amber-800">{item.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">รับเข้าเพิ่ม: <span className="font-semibold text-foreground">{item.receive_now}</span> ชิ้น</div>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[10px] text-muted-foreground mb-1 block">หมวดหมู่ Stock</Label>
                        <Select value={item.stock_category_id} onValueChange={v => updateStockField(itemIdx, 'stock_category_id', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[10px] text-muted-foreground mb-1 block">สถานที่จัดเก็บ</Label>
                        <Input 
                          value={item.stock_location || ''} 
                          onChange={e => updateStockField(itemIdx, 'stock_location', e.target.value)} 
                          className="h-8 text-xs" 
                          placeholder="ตู้ / ชั้นวาง..."
                        />
                      </div>
                    </div>
                  ) : null
                )}
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

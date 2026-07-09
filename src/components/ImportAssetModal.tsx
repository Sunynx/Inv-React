'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { generateAssetCodeStr } from '@/lib/utils';

interface ImportAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  departments: { id: string, name: string }[];
  categories: { id: string, name: string }[];
}

export default function ImportAssetModal({ isOpen, onClose, onSaved, departments, categories }: ImportAssetModalProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    try {
      const file = files[0];
      const data = await parseExcelFile(file);
      if (data && data.length > 0) {
        setParsedData(data);
        toast.success(`พบข้อมูล ${data.length} รายการ`);
      } else {
        toast.error("ไม่พบข้อมูล หรือรูปแบบไฟล์ไม่ถูกต้อง");
      }
    } catch (err: any) {
      toast.error('Error parsing file: ' + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          // Read as JSON objects (assumes first row is header)
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          
          // Map to standard keys
          const mappedData = data.map((row: any) => {
            // Find keys by fuzzy matching
            const findKey = (keywords: string[]) => {
              const keys = Object.keys(row);
              const found = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
              return found ? row[found] : null;
            };

            const name = findKey(['name', 'ชื่อ', 'รายการ', 'item']) || 'Unnamed Asset';
            const code = findKey(['code', 'รหัส', 'asset number', 'sn']) || null;
            const deptName = findKey(['dept', 'department', 'แผนก']) || null;
            const catName = findKey(['cat', 'category', 'หมวด', 'ประเภท']) || null;
            const priceStr = findKey(['price', 'cost', 'ราคา', 'มูลค่า']);
            const price = priceStr ? Number(String(priceStr).replace(/[^0-9.-]+/g,"")) : null;
            const purchaseDateStr = findKey(['date', 'purchase date', 'วันที่ซื้อ']);
            let purchaseDate = null;
            if (purchaseDateStr) {
               // excel dates might be numbers or strings
               if (typeof purchaseDateStr === 'number') {
                 // Convert Excel serial date to JS date
                 const date = new Date(Math.round((purchaseDateStr - 25569) * 86400 * 1000));
                 purchaseDate = date.toISOString();
               } else {
                 purchaseDate = new Date(purchaseDateStr).toISOString();
               }
            }
            const status = findKey(['status', 'สถานะ']) || 'ใช้งาน';

            return {
              name,
              asset_code: code,
              department: deptName,
              category: catName,
              price: price,
              purchase_date: purchaseDate,
              status: status,
              raw: row
            };
          });

          resolve(mappedData);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleSave = async () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);
    
    try {
      const { data: latestAssets } = await supabase.from('assets').select('id, asset_code').order('created_at', { ascending: false }).limit(10);
      
      const insertData = [];
      let nextCodeNum = 1;
      
      // Basic auto-increment logic for asset code if missing
      if (latestAssets && latestAssets.length > 0) {
        const lastCode = latestAssets.find(a => a.asset_code?.startsWith('IT-'))?.asset_code;
        if (lastCode) {
          const parts = lastCode.split('-');
          if (parts.length > 1) {
            const numStr = parts[1].replace(/[^0-9]/g, '');
            if (numStr) nextCodeNum = parseInt(numStr, 10) + 1;
          }
        }
      }

      for (let i = 0; i < parsedData.length; i++) {
        const item = parsedData[i];
        
        // Match or default Department
        let deptId = departments.find(d => d.name.toLowerCase() === String(item.department).toLowerCase())?.id;
        if (!deptId && item.department) {
          // You could auto-insert here, but let's just pick the first one or null
          deptId = departments[0]?.id;
        }

        // Match or default Category
        let catId = categories.find(c => c.name.toLowerCase() === String(item.category).toLowerCase())?.id;
        if (!catId && item.category) {
          catId = categories[0]?.id;
        }

        let finalCode = item.asset_code;
        if (!finalCode) {
           finalCode = generateAssetCodeStr(nextCodeNum);
           nextCodeNum++;
        }

        insertData.push({
          name: String(item.name).trim().substring(0, 255),
          asset_code: finalCode,
          department_id: deptId,
          category_id: catId,
          price: item.price,
          purchase_date: item.purchase_date,
          status: item.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const { error } = await supabase.from('assets').insert(insertData);
      if (error) throw error;
      
      // Insert audit log
      await supabase.from('audit_log').insert({
        action: 'import',
        details: `Imported ${insertData.length} assets from Excel`,
        performed_by: 'System User',
      });

      toast.success(`นำเข้าสำเร็จ ${insertData.length} รายการ`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setParsedData([]);
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeRow = (index: number) => {
    const newData = [...parsedData];
    newData.splice(index, 1);
    setParsedData(newData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold">Import Assets (Excel)</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Upload a .xlsx file to bulk import assets</p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {!parsedData.length ? (
            <div 
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Click to browse file</h3>
              <p className="text-sm text-muted-foreground mb-4">Supports .xlsx and .xls formats</p>
              <Button type="button" disabled={isProcessing}>
                <Upload className="w-4 h-4 mr-2" /> 
                {isProcessing ? 'Processing...' : 'Select File'}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
              />
              
              <div className="mt-8 text-left text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Supported Columns (Auto-mapped):</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Name / ชื่อ / Item</li>
                  <li>Code / รหัส / SN</li>
                  <li>Department / แผนก</li>
                  <li>Category / ประเภท</li>
                  <li>Price / ราคา</li>
                  <li>Purchase Date / วันที่ซื้อ</li>
                  <li>Status / สถานะ</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Preview ({parsedData.length} items)</h4>
                <Button variant="ghost" size="sm" onClick={() => setParsedData([])} className="h-8 text-red-500">
                  <Trash2 className="w-4 h-4 mr-2" /> Clear All
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Asset Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.asset_code || 'Auto-generate'}</td>
                        <td className="px-4 py-3">{row.department || '-'}</td>
                        <td className="px-4 py-3">{row.category || '-'}</td>
                        <td className="px-4 py-3">{row.price ? `฿${row.price}` : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {parsedData.length > 0 && (
          <DialogFooter className="p-4 border-t bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> 
              {isProcessing ? 'Importing...' : 'Confirm Import'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

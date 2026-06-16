'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ImportPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ImportPRModal({ isOpen, onClose, onSaved }: ImportPRModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findKey = (row: any, keywords: string[]) => {
    const keys = Object.keys(row);
    const found = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
    return found ? row[found] : '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let allMappedData: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await parseExcelFile(file);
      if (data) {
        allMappedData.push(data);
      }
    }
    
    if (allMappedData.length > 0) {
      setParsedData(prev => [...prev, ...allMappedData]);
      toast.success(`เพิ่มข้อมูลใหม่ ${allMappedData.length} รายการ (รวมทั้งหมด ${parsedData.length + allMappedData.length} รายการ)`);
    } else {
      toast.error("ไม่พบข้อมูลในไฟล์ หรือรูปแบบไม่ตรง");
    }
  };

  const parseExcelFile = (file: File): Promise<any> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          // Read as 2D array
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          const findCell = (text: string) => {
            for (let r = 0; r < data.length; r++) {
              if (!data[r]) continue;
              for (let c = 0; c < data[r].length; c++) {
                if (typeof data[r][c] === 'string' && data[r][c].toLowerCase().includes(text.toLowerCase())) {
                  return { r, c };
                }
              }
            }
            return null;
          };

          let title = `Imported PR ${file.name}`;
          let department = '';
          let totalCost = 0;
          let headName = '';
          let dateStr = '';
          let items: any[] = [];

          // Parse Form Layout
          const deptCell = findCell("Department");
          if (deptCell) department = data[deptCell.r]?.[deptCell.c + 2] || data[deptCell.r]?.[deptCell.c + 1] || "";

          const reasonCell = findCell("Reason for Purchase");
          if (reasonCell && data[reasonCell.r + 1]) title = data[reasonCell.r + 1]?.[reasonCell.c] || title;

          const dateCell = findCell("Date");
          if (dateCell) dateStr = data[dateCell.r]?.[dateCell.c + 2] || "";

          const costCell = findCell("Total Cost");
          if (costCell && data[costCell.r + 1]) {
            totalCost = data[costCell.r + 1].find(v => typeof v === 'number') || 0;
          }

          const headCell = findCell("Head of Department");
          if (headCell && data[headCell.r - 1]) headName = data[headCell.r - 1]?.[headCell.c + 1] || data[headCell.r - 1]?.[headCell.c] || "";

          const descCell = findCell("Description of Items");
          if (descCell) {
            for (let r = descCell.r + 2; r < data.length; r++) {
              const row = data[r];
              if (!row || row.length === 0) continue;
              if (row.some(c => typeof c === 'string' && c.toLowerCase().includes("total cost"))) break;
              
              const qty = row.find(v => typeof v === 'number' && v < 1000); // usually small
              const name = row.find(v => typeof v === 'string' && v.trim() !== '' && v.trim() !== 'QTY' && v.trim() !== 'ITEM');
              const numbers = row.filter(v => typeof v === 'number');
              const price = numbers.length > 1 ? numbers[numbers.length - 1] : 0;
              
              if (name && name !== 'Screen Replacement Service Fee' && name !== 'UNIT PRICE') {
                items.push({
                  name: name,
                  quantity: qty || 1,
                  price: price,
                  type: 'Asset',
                  received_quantity: qty || 1
                });
              } else if (name) {
                 // Include services too
                 items.push({
                  name: name,
                  quantity: qty || 1,
                  price: price,
                  type: 'Stock',
                  received_quantity: qty || 1
                });
              }
            }
          }

          // If no items parsed from form, fallback to mapping it as 1 item
          if (items.length === 0) {
             items = [{
               name: title,
               quantity: 1,
               price: totalCost,
               type: 'Asset',
               received_quantity: 1
             }];
          }

          resolve({
            title,
            department,
            totalCost,
            headName,
            date: dateStr,
            items,
            originalRow: file.name
          });
        } catch (err) {
          console.error(err);
          resolve(null);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);
    
    try {
      const recordsToInsert = parsedData.map((data, idx) => {
        const docNo = `PR-IMP-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random()*10000)).padStart(4, '0')}`;
        
        let isoDate = undefined;
        if (typeof data.date === 'number') {
          // Convert Excel date serial to Date object
          isoDate = new Date(Math.round((data.date - 25569) * 86400 * 1000)).toISOString();
        } else if (typeof data.date === 'string' && data.date.trim() !== '') {
          const parsed = new Date(data.date);
          if (!isNaN(parsed.getTime())) {
            isoDate = parsed.toISOString();
          }
        }

        return {
          document_number: docNo,
          title: String(data.title).substring(0, 200),
          total_amount: data.totalCost,
          status: 'ได้รับของแล้ว',
          created_at: isoDate,
          metadata: {
            is_imported: true,
            department: data.department,
            head_of_department: data.headName,
            original_date: data.date,
            filename: data.originalRow
          },
          items: data.items
        };
      });

      const { error } = await supabase.from('procurement').insert(recordsToInsert);
      if (error) throw error;

      toast.success(`นำเข้าข้อมูล ${recordsToInsert.length} รายการสำเร็จ!`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetData = () => {
    setParsedData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveRow = (indexToRemove: number) => {
    setParsedData(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetData();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            นำเข้าข้อมูล PR เก่า (Import History)
          </DialogTitle>
          <DialogDescription>
            อัปโหลดไฟล์ Excel (.xlsx) ที่มีข้อมูล PR เก่า ระบบจะแปลงเป็นประวัติและตั้งสถานะเป็น "ได้รับของแล้ว" ทันที โดยไม่ต้องทำการอนุมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {parsedData.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">อัปโหลดไฟล์ Excel</h3>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                ระบบจะค้นหาช่องข้อมูลที่มีคำว่า Department, Reason, Description, Total Cost อัตโนมัติ ไม่จำเป็นต้องใช้ Template
              </p>
              <input
                type="file"
                accept=".xlsx, .xls"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700">
                เลือกไฟล์ Excel (เลือกได้หลายไฟล์)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-50 text-emerald-700 p-3 rounded-md border border-emerald-200 gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-medium">พบข้อมูลพร้อมนำเข้าจำนวน {parsedData.length} รายการ</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    multiple
                    className="hidden"
                    id="add-more-files"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('add-more-files')?.click()} className="h-8 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                    + เพิ่มไฟล์อีก
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetData} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">ล้างข้อมูลทั้งหมด</Button>
                </div>
              </div>

              <div className="bg-white border rounded-md max-h-[50vh] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">ชื่อไฟล์</th>
                      <th className="px-4 py-2 text-left font-medium">เรื่อง (Reason)</th>
                      <th className="px-4 py-2 text-left font-medium">วันที่</th>
                      <th className="px-4 py-2 text-left font-medium w-1/4">รายการสินค้า (Items)</th>
                      <th className="px-4 py-2 text-center font-medium">ยอดรวม</th>
                      <th className="px-4 py-2 text-left font-medium">แผนก</th>
                      <th className="px-4 py-2 text-center font-medium w-16">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]" title={row.originalRow}>{row.originalRow}</td>
                        <td className="px-4 py-3 font-medium max-w-[200px] whitespace-normal" title={row.title}>{row.title}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{
                          typeof row.date === 'number' 
                            ? new Date(Math.round((row.date - 25569) * 86400 * 1000)).toLocaleDateString('th-TH')
                            : String(row.date).substring(0, 15)
                        }</td>
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-1 max-h-24 overflow-y-auto pr-1">
                            {row.items?.length > 0 ? (
                              <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                                {row.items.map((item: any, i: number) => (
                                  <li key={i} className="truncate max-w-[250px]" title={item.name}>
                                    <span className="font-medium text-foreground">{item.quantity}x</span> {item.name}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-slate-400 italic">ไม่พบรายการ</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-medium whitespace-nowrap">
                          {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(row.totalCost)}
                        </td>
                        <td className="px-4 py-3 truncate max-w-[150px]" title={row.department || ''}>{row.department || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedData.length === 0 || isProcessing} 
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? 'กำลังประมวลผล...' : <><Upload className="w-4 h-4 mr-2" /> นำเข้าข้อมูล (Import)</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

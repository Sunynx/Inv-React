'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Printer, Save, X, FileSpreadsheet, Paperclip, Loader2, CheckCircle2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logAudit } from '@/lib/auditLog';

interface ProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any | null;
  onSaved: () => void;
}

const InlineInput = ({ value, onChange, className = "", placeholder = "" }: any) => (
  <input 
    type="text" 
    value={value || ''} 
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`border-b border-black outline-none bg-transparent hover:bg-black/5 focus:bg-yellow-50/50 transition-colors ${className}`} 
  />
);

export default function ProcurementModal({ isOpen, onClose, document, onSaved }: ProcurementModalProps) {
  const [docNumber, setDocNumber] = useState('');
  const [type, setType] = useState('PR');
  const [status, setStatus] = useState('รอดำเนินการ');
  const [items, setItems] = useState<any[]>(Array.from({ length: 8 }, () => ({ name: '', quantity: '', price: '', type: 'Stock' })));
  const [metadata, setMetadata] = useState<any>({});
  const [manualTotal, setManualTotal] = useState<string>('');
  const [isVatIncluded, setIsVatIncluded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (document) {
      setDocNumber(document.document_number || '');
      setType(document.type || 'PR');
      setStatus(document.status || 'รอดำเนินการ');
      
      const loadedItems = document.items || [];
      const paddedItems = [...loadedItems];
      while (paddedItems.length < 8) {
        paddedItems.push({ name: '', quantity: '', price: '' });
      }
      setItems(paddedItems.slice(0, 8));
      
      setMetadata(document.metadata || {});
      setIsVatIncluded(document.metadata?.is_vat_included || false);
      if (document.total_amount) {
        // Only set manual total if it differs from the calculated auto total
        // We will just set it, but ideally we'd compare. For now, set it.
        setManualTotal(String(document.total_amount));
      } else {
        setManualTotal('');
      }
    } else {
      setDocNumber(`PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setType('PR');
      setStatus('รอดำเนินการ');
      setItems(Array.from({ length: 8 }, () => ({ name: '', quantity: '', price: '', type: 'Stock' })));
      setMetadata({});
      setManualTotal('');
      setIsVatIncluded(false);
    }
  }, [document, isOpen]);

  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
    setManualTotal(''); // Reset manual override on item change to restore realtime calculation
  };

  const updateMeta = (field: string, value: any) => {
    setMetadata({ ...metadata, [field]: value });
  };

  const baseTotalAmount = items.reduce((sum, item) => {
    const qty = Number(String(item.quantity).replace(/,/g, '')) || 0;
    const price = Number(String(item.price).replace(/,/g, '')) || 0;
    return sum + (qty * price);
  }, 0);

  const autoTotalAmount = isVatIncluded ? baseTotalAmount * 1.07 : baseTotalAmount;

  // We only show manualTotal if they explicitly typed something recently and haven't changed items
  // But wait, if they load an existing document, manualTotal is populated. 
  // We want to show autoTotalAmount if it matches, or if manualTotal is clear.
  // Actually, if manualTotal is equal to autoTotalAmount, we just use auto.
  const isOverride = manualTotal !== '' && Number(String(manualTotal).replace(/,/g, '')) !== autoTotalAmount;
  const displayTotal = isOverride ? manualTotal : (autoTotalAmount > 0 ? autoTotalAmount.toLocaleString(undefined, {minimumFractionDigits: 2}) : '');
  const finalTotalAmount = isOverride ? Number(String(manualTotal).replace(/,/g, '')) : autoTotalAmount;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        let processedFile = file;
        let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        let originalName = file.name;
        
        if (fileExt === 'heic' || fileExt === 'heif' || file.type === 'image/heic' || file.type === 'image/heif') {
          try {
            const heic2anyModule = await import('heic2any');
            const heic2any = heic2anyModule.default || heic2anyModule;
            const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
            const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
            originalName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            processedFile = new File([convertedBlob], originalName, { type: 'image/jpeg' });
            fileExt = 'jpg';
          } catch (err) {
            console.error('HEIC conversion failed:', err);
          }
        }
        
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error } = await supabase.storage
          .from('pr-attachments')
          .upload(fileName, processedFile);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('pr-attachments')
          .getPublicUrl(fileName);

        return { name: originalName, url: publicUrl };
      });

      const newFiles = await Promise.all(uploadPromises);
      const newAttachments = [...(metadata.attachments || []), ...newFiles];
      updateMeta('attachments', newAttachments);
      toast.success(`อัปโหลดไฟล์สำเร็จ ${newFiles.length} ไฟล์`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('ไม่สามารถอัปโหลดได้ โปรดตรวจสอบข้อผิดพลาด (หรืออาจจะยังไม่ได้สร้าง Bucket "pr-attachments")');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (idx: number) => {
    const newAttachments = [...(metadata.attachments || [])];
    newAttachments.splice(idx, 1);
    updateMeta('attachments', newAttachments);
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch('/Template_PR.xlsx');
      if (!response.ok) throw new Error('Template not found');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const ws = workbook.getWorksheet(1);
      
      if (ws) {
        ws.getCell('C6').value = metadata.department || '';
        ws.getCell('C8').value = metadata.date || '';
        ws.getCell('K7').value = metadata.telephone || '';
        ws.getCell('K8').value = metadata.email || '';
        ws.getCell('B11').value = metadata.reason_for_purchase || '';
        ws.getCell('K11').value = metadata.date_required || '';
        
        items.forEach((item, index) => {
          const row = 15 + index;
          if (row <= 22) {
             ws.getCell(`B${row}`).value = item.quantity;
             ws.getCell(`C${row}`).value = item.name;
             ws.getCell(`L${row}`).value = item.price;
          }
        });
        
        ws.getCell('E24').value = finalTotalAmount;
        ws.getCell('I24').value = metadata.total_foreign || '';
        if (metadata.budget_control === 'Budgeted') ws.getCell('C26').value = '✔';
        if (metadata.budget_control === 'Not Budgeted') ws.getCell('E26').value = '✔';
        ws.getCell('I26').value = metadata.budget_code || '';
        ws.getCell('H28').value = metadata.quotes_summary || '';
        ws.getCell('I29').value = metadata.no_quotes_reason || '';
        ws.getCell('D31').value = metadata.preferred_supplier || '';
        ws.getCell('E32').value = metadata.preferred_quote_thb || '';
        ws.getCell('H32').value = metadata.preferred_quote_foreign || '';
        ws.getCell('I33').value = metadata.not_lowest_reason || '';
        ws.getCell('D36').value = metadata.recommended_supplier || '';
        ws.getCell('J36').value = metadata.recommended_remark || '';
        ws.getCell('E37').value = metadata.recommended_price_thb || '';
        ws.getCell('H37').value = metadata.recommended_price_foreign || '';
        ws.getCell('C42').value = metadata.appr_head_name || '';
        ws.getCell('E42').value = metadata.appr_head_date || '';
        ws.getCell('G42').value = metadata.appr_pur_name || '';
        ws.getCell('K42').value = metadata.appr_pur_date || '';
        ws.getCell('B46').value = metadata.appr_fin_name || '';
        ws.getCell('E46').value = metadata.appr_fin_date || '';
        ws.getCell('B50').value = metadata.appr_md_name || '';
        ws.getCell('E50').value = metadata.appr_md_date || '';
        ws.getCell('G50').value = metadata.appr_chair_name || '';
        ws.getCell('K50').value = metadata.appr_chair_date || '';
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `PR_${docNumber}.xlsx`);
      toast.success('Exported to Excel successfully!');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export to Excel.');
    }
  };

  const handleSave = async () => {
    if (!docNumber) {
      toast.error('กรุณากรอก Document Number');
      return;
    }
    setIsSaving(true);
    const validItems = items.filter(i => i.name && i.quantity);
    const payload = {
      document_number: docNumber,
      title: metadata.reason_for_purchase ? metadata.reason_for_purchase.substring(0, 50) : 'Purchase Request',
      type,
      status,
      supplier: metadata.recommended_supplier || '',
      expected_delivery: metadata.date_required || null,
      items: validItems,
      metadata: { ...metadata, is_vat_included: isVatIncluded },
      total_amount: finalTotalAmount
    };

    try {
      if (document?.id) {
        const { error } = await supabase.from('procurement').update(payload).eq('id', document.id);
        if (error) throw error;
        logAudit({ action: 'update', details: `Updated PR ${docNumber} (Status: ${status})` });
        toast.success('อัปเดตเอกสารสำเร็จ');
      } else {
        const { error } = await supabase.from('procurement').insert([payload]);
        if (error) throw error;
        logAudit({ action: 'create', details: `Created PR ${docNumber}` });
        toast.success('สร้างเอกสารสำเร็จ');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl w-full max-h-[95vh] overflow-y-auto p-0 bg-gray-100 border-none">
        
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-lg">{document ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}</h2>
            <div className="flex items-center gap-2 text-sm bg-muted/50 p-1 px-3 rounded-md">
              <Label className="text-xs text-muted-foreground">Doc No.</Label>
              <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} className="h-6 w-32 bg-transparent border-none p-0 text-sm font-semibold" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-1" /> {isSaving ? 'Saving...' : 'Save Document'}
            </Button>
          </div>
        </div>

        <div className="bg-white border-b shadow-sm px-6 py-4 flex flex-col items-center justify-center print:hidden">
          <div className="w-full max-w-3xl flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 -z-10 rounded-full"></div>
            {['รอดำเนินการ', 'อนุมัติแล้ว', 'สั่งซื้อแล้ว', 'ได้รับของแล้ว'].map((step, idx) => {
              const statusOrder = ['รอดำเนินการ', 'อนุมัติแล้ว', 'สั่งซื้อแล้ว', 'ได้รับของแล้ว', 'รับของบางส่วน'];
              let currentIndex = statusOrder.indexOf(status);
              if (status === 'ยกเลิก') currentIndex = -1;
              if (status === 'รับของบางส่วน' && step === 'ได้รับของแล้ว') currentIndex = 3; // Treat partial as almost there
              
              const stepIndex = ['รอดำเนินการ', 'อนุมัติแล้ว', 'สั่งซื้อแล้ว', 'ได้รับของแล้ว'].indexOf(step);
              
              let state = 'pending';
              if (status === 'ยกเลิก') {
                state = 'cancelled';
              } else if (stepIndex < currentIndex) {
                state = 'completed';
              } else if (stepIndex === currentIndex) {
                state = 'current';
              }

              return (
                <div key={step} className="flex flex-col items-center gap-2 bg-white px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                    ${state === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 
                      state === 'current' ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100' : 
                      state === 'cancelled' ? 'bg-red-100 border-red-500 text-red-600' :
                      'bg-slate-100 border-slate-300 text-slate-400'
                    }
                  `}>
                    {state === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${
                    state === 'current' ? 'text-blue-700' : 
                    state === 'completed' ? 'text-emerald-600' : 
                    state === 'cancelled' ? 'text-red-500' : 
                    'text-slate-400'
                  }`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-8 pb-16 flex justify-center print:p-0">
          <div className="w-[794px] bg-white text-black p-10 shadow-2xl relative print:shadow-none print:w-full print:scale-[0.85] print:origin-top" style={{ minHeight: '1123px', fontFamily: 'Arial, sans-serif' }}>
            
            <div className="absolute inset-4 border-2 border-black pointer-events-none"></div>
            <div className="absolute inset-[18px] border border-black pointer-events-none"></div>

            <div className="relative z-10 px-4 py-2">
              <div className="flex items-center justify-between mb-8">
                <div className="w-40"><img src="/rpm-logo.png" alt="RPM Logo" className="h-12 object-contain" /></div>
                <div className="text-center flex-1"><h1 className="text-xl font-bold underline" style={{ letterSpacing: '0.5px' }}>PURCHASE REQUISITION FORM</h1></div>
                <div className="w-40"></div>
              </div>

              <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[13px] mb-8">
                <div className="flex items-end"><span className="w-24 shrink-0">Department</span><InlineInput value={metadata.department} onChange={(v: string) => updateMeta('department', v)} className="flex-1" /></div>
                <div className="flex items-end"><span className="w-32 shrink-0">Purchasing Mgr</span><InlineInput value={metadata.purchasing_mgr} onChange={(v: string) => updateMeta('purchasing_mgr', v)} className="flex-1" /></div>
                <div className="flex items-end"><span className="w-24 shrink-0">Date</span><InlineInput value={metadata.date} onChange={(v: string) => updateMeta('date', v)} placeholder={new Date().toLocaleDateString('en-GB')} className="flex-1" /></div>
                <div className="flex items-end"><span className="w-32 shrink-0">Telephone</span><InlineInput value={metadata.telephone} onChange={(v: string) => updateMeta('telephone', v)} className="flex-1" /></div>
                <div className="col-start-2 flex items-end"><span className="w-32 shrink-0">Email</span><InlineInput value={metadata.email} onChange={(v: string) => updateMeta('email', v)} className="flex-1" /></div>
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex"><span className="w-6 shrink-0">1</span><span className="shrink-0 mr-4">Reason for Purchase</span><InlineInput value={metadata.reason_for_purchase} onChange={(v: string) => updateMeta('reason_for_purchase', v)} className="flex-1" /></div>
                <div className="flex items-end mt-2"><div className="w-6 shrink-0"></div><InlineInput value={metadata.reason_for_purchase_2} onChange={(v: string) => updateMeta('reason_for_purchase_2', v)} className="w-[60%]" /><span className="mx-4 shrink-0">Date Required:</span><InlineInput value={metadata.date_required} onChange={(v: string) => updateMeta('date_required', v)} className="flex-1" /></div>
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex mb-1"><span className="w-6 shrink-0">2</span><span>Description of Items and Quantity to be Purchased</span></div>
                <div className="ml-6 border-2 border-black">
                  <div className="flex bg-[#deeaf6] border-b-2 border-black font-semibold text-center text-[12px]">
                    <div className="w-[10%] py-1 border-r border-black">QTY</div>
                    <div className="w-[50%] py-1 border-r border-black">ITEM</div>
                    <div className="w-[20%] py-1 border-r border-black">TYPE</div>
                    <div className="w-[20%] py-1">UNIT PRICE</div>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className={`flex ${idx !== items.length - 1 ? 'border-b border-black' : ''}`}>
                      <div className="w-[10%] border-r border-black p-0.5"><input type="text" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-full text-center outline-none bg-transparent" /></div>
                      <div className="w-[50%] border-r border-black p-0.5"><input type="text" value={item.name || ''} onChange={(e) => updateItem(idx, 'name', e.target.value)} className="w-full px-1 outline-none bg-transparent" /></div>
                      <div className="w-[20%] border-r border-black p-0.5 flex items-center justify-center">
                        <select value={item.type || 'Stock'} onChange={(e) => updateItem(idx, 'type', e.target.value)} className="bg-transparent outline-none w-full text-center text-xs">
                          <option value="Stock">Stock</option>
                          <option value="Asset">Asset</option>
                        </select>
                      </div>
                      <div className="w-[20%] p-0.5"><input type="text" value={item.price || ''} onChange={(e) => updateItem(idx, 'price', e.target.value)} className="w-full text-right px-1 outline-none bg-transparent" /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex"><span className="w-6 shrink-0">3</span><span className="shrink-0 mr-4">Total Cost (please attach all quotations and other relevant documentation)</span></div>
                <div className="flex items-end mt-2">
                  <div className="w-6 shrink-0"></div>
                  <span className="mr-2">THB:</span>
                  <input 
                    type="text" 
                    value={displayTotal} 
                    onChange={(e) => setManualTotal(e.target.value)}
                    className="w-[30%] border-b border-black text-center font-bold outline-none bg-transparent hover:bg-black/5 focus:bg-yellow-50/50 transition-colors"
                  />
                  <label className="ml-3 flex items-center gap-1 cursor-pointer select-none text-[11px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border border-gray-300">
                    <input 
                      type="checkbox" 
                      checked={isVatIncluded} 
                      onChange={(e) => {
                        setIsVatIncluded(e.target.checked);
                        setManualTotal(''); // Revert to auto calculation on toggle
                      }} 
                      className="accent-black w-3 h-3"
                    />
                    + 7% VAT
                  </label>
                  <span className="mx-4 shrink-0">Foreign Currency</span>
                  <InlineInput value={metadata.total_foreign} onChange={(v: string) => updateMeta('total_foreign', v)} className="flex-1" />
                </div>
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex mb-2"><span className="w-6 shrink-0">4</span><span>Budget Control (please tick one box)</span></div>
                <div className="flex items-end mt-1"><div className="w-6 shrink-0"></div><div className="flex items-center gap-6 w-[45%]"><label className="flex items-center gap-2 cursor-pointer"><div className="w-4 h-4 border-2 border-black flex items-center justify-center bg-white">{metadata.budget_control === 'Budgeted' && <div className="w-2 h-2 bg-black"></div>}</div><input type="radio" className="hidden" checked={metadata.budget_control === 'Budgeted'} onChange={() => updateMeta('budget_control', 'Budgeted')} />Budgeted</label><label className="flex items-center gap-2 cursor-pointer"><div className="w-4 h-4 border-2 border-black flex items-center justify-center bg-white">{metadata.budget_control === 'Not Budgeted' && <div className="w-2 h-2 bg-black"></div>}</div><input type="radio" className="hidden" checked={metadata.budget_control === 'Not Budgeted'} onChange={() => updateMeta('budget_control', 'Not Budgeted')} />Not Budgeted</label></div><span className="mx-4 shrink-0">Budget code & Title</span><InlineInput value={metadata.budget_code} onChange={(v: string) => updateMeta('budget_code', v)} className="flex-1" /></div>
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex"><span className="w-6 shrink-0">5</span><span className="shrink-0 mr-4">Prepare and attach a detailed summary of the 3 quotations obtained</span></div>
                <div className="flex items-end mt-2"><div className="w-6 shrink-0"></div><span className="shrink-0 mr-4">If 3 quotes were not obtained, please state the reasons:</span><InlineInput value={metadata.no_quotes_reason} onChange={(v: string) => updateMeta('no_quotes_reason', v)} className="flex-1 min-w-0" /></div>
              </div>

              {/* Attachments Section */}
              <div className="mb-6 text-[13px] border border-dashed border-gray-300 p-4 rounded-md bg-gray-50/50 print:hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold flex items-center gap-2"><Paperclip className="w-4 h-4" /> เอกสารแนบ (ใบเสนอราคา ฯลฯ)</div>
                  <div>
                    <input type="file" id="pr-file-upload" className="hidden" accept=".pdf,.xlsx,.xls,image/*,.heic,.heif" multiple onChange={handleFileUpload} disabled={uploading} />
                    <Label htmlFor="pr-file-upload" className={`cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-7 px-3 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} อัปโหลดไฟล์
                    </Label>
                  </div>
                </div>
                {metadata.attachments && metadata.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {metadata.attachments.map((file: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-white border rounded p-2 text-xs shadow-sm">
                        <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate mr-2 flex-1" title={file.name}>{file.name}</a>
                        <button onClick={() => removeAttachment(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs">ยังไม่มีเอกสารแนบ</div>
                )}
              </div>

              <div className="mb-6 text-[13px]">
                <div className="flex mb-2"><span className="w-6 shrink-0">6</span><span>Department's preferred supplier/contractor</span></div>
                <div className="flex items-end mt-1"><div className="w-6 shrink-0"></div><span className="shrink-0 w-56">Name of Supplier/contractor</span><InlineInput value={metadata.preferred_supplier} onChange={(v: string) => updateMeta('preferred_supplier', v)} className="flex-1 min-w-0" /></div>
                <div className="flex items-end mt-2"><div className="w-6 shrink-0"></div><span className="shrink-0 w-56">Quote submitted</span><span className="shrink-0 mr-2">THB</span><InlineInput value={metadata.preferred_quote_thb} onChange={(v: string) => updateMeta('preferred_quote_thb', v)} className="w-24 mr-4" /><span className="shrink-0 mr-2">Foreign Currency</span><InlineInput value={metadata.preferred_quote_foreign} onChange={(v: string) => updateMeta('preferred_quote_foreign', v)} className="flex-1 min-w-0" /></div>
                <div className="flex items-end mt-2"><div className="w-6 shrink-0"></div><span className="shrink-0 mr-2">If the Department's supplier/contractor is not the lowest quote received, please state the reason(s):</span></div>
                <div className="flex items-end mt-1"><div className="w-6 shrink-0"></div><InlineInput value={metadata.not_lowest_reason} onChange={(v: string) => updateMeta('not_lowest_reason', v)} className="flex-1 min-w-0" /></div>
              </div>

              <div className="mb-8 text-[13px]">
                <div className="flex mb-2"><span className="w-6 shrink-0">7</span><span>Purchasing Recommended supplier/contractor</span></div>
                <div className="flex items-end mt-1"><div className="w-6 shrink-0"></div><span className="shrink-0 w-56">Name of Supplier/contractor</span><InlineInput value={metadata.recommended_supplier} onChange={(v: string) => updateMeta('recommended_supplier', v)} className="w-[45%] mr-4 min-w-0" /><span className="shrink-0 mr-2">Remark</span><InlineInput value={metadata.recommended_remark} onChange={(v: string) => updateMeta('recommended_remark', v)} className="flex-1 min-w-0" /></div>
                <div className="flex items-end mt-2"><div className="w-6 shrink-0"></div><span className="shrink-0 w-48">Final Price submitted</span><span className="shrink-0 w-16 text-center">THB</span><InlineInput value={metadata.recommended_price_thb} onChange={(v: string) => updateMeta('recommended_price_thb', v)} className="w-40 mr-4" /><span className="shrink-0 mr-2">Foreign Currency</span><InlineInput value={metadata.recommended_price_foreign} onChange={(v: string) => updateMeta('recommended_price_foreign', v)} className="flex-1 min-w-0" /></div>
              </div>

              <div className="mb-4 text-[13px]">
                <div className="flex mb-2">
                  <span className="w-6 shrink-0">10</span>
                  <div className="flex w-full">
                    <span className="w-[50%]">Approvals</span>
                    <span className="w-[50%]">Purchasing</span>
                  </div>
                </div>

                <div className="ml-6 grid grid-cols-2 gap-x-12">
                  {/* Row 1 */}
                  <div className="flex flex-col mb-4">
                    <div className="h-8 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                    <div className="flex items-end">
                      <span className="mr-2">Name:</span>
                      <InlineInput value={metadata.appr_head_name} onChange={(v: string) => updateMeta('appr_head_name', v)} className="w-[45%] mr-2" />
                      <span className="mr-2">Date</span>
                      <InlineInput value={metadata.appr_head_date} onChange={(v: string) => updateMeta('appr_head_date', v)} className="flex-1 min-w-0" />
                    </div>
                    <div className="mt-1">Head of Department</div>
                  </div>

                  <div className="flex flex-col mb-4">
                    <div className="h-8 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                    <div className="flex items-end">
                      <span className="mr-2">Name:</span>
                      <InlineInput value={metadata.appr_pur_name} onChange={(v: string) => updateMeta('appr_pur_name', v)} className="w-[45%] mr-2" />
                      <span className="mr-2">Date</span>
                      <InlineInput value={metadata.appr_pur_date} onChange={(v: string) => updateMeta('appr_pur_date', v)} className="flex-1 min-w-0" />
                    </div>
                    <div className="mt-1">Purchasing</div>
                  </div>

                  {/* Row 2 */}
                  <div className="flex flex-col mb-4 mt-4">
                    <div className="h-8 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                    <div className="flex items-end">
                      <span className="mr-2">Name:</span>
                      <InlineInput value={metadata.appr_fin_name} onChange={(v: string) => updateMeta('appr_fin_name', v)} className="w-[45%] mr-2" />
                      <span className="mr-2">Date</span>
                      <InlineInput value={metadata.appr_fin_date} onChange={(v: string) => updateMeta('appr_fin_date', v)} className="flex-1 min-w-0" />
                    </div>
                    <div className="mt-1">Finance Director</div>
                  </div>
                  <div></div> {/* Empty for Row 2 Right */}

                  {/* Row 3 */}
                  <div className="flex flex-col mb-4 mt-4">
                    <div className="h-8 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                    <div className="flex items-end">
                      <span className="mr-2">Name:</span>
                      <InlineInput value={metadata.appr_md_name} onChange={(v: string) => updateMeta('appr_md_name', v)} className="w-[45%] mr-2" />
                      <span className="mr-2">Date</span>
                      <InlineInput value={metadata.appr_md_date} onChange={(v: string) => updateMeta('appr_md_date', v)} className="flex-1 min-w-0" />
                    </div>
                    <div className="mt-1">Managing Director</div>
                  </div>

                  <div className="flex flex-col mb-4 mt-4">
                    <div className="h-8 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                    <div className="flex items-end">
                      <span className="mr-2">Name:</span>
                      <InlineInput value={metadata.appr_chair_name} onChange={(v: string) => updateMeta('appr_chair_name', v)} className="w-[45%] mr-2" />
                      <span className="mr-2">Date</span>
                      <InlineInput value={metadata.appr_chair_date} onChange={(v: string) => updateMeta('appr_chair_date', v)} className="flex-1 min-w-0" />
                    </div>
                    <div className="mt-1">Chairman (if applicable)</div>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-8 pt-4 border-t border-black text-[11px]">
                Please refer to the Authority Matrix to determine the correct approvals required.
              </div>

            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

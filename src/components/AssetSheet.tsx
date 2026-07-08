'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Camera, Upload, X, CheckCircle2, AlertCircle, Clock, Ban, ChevronLeft, ChevronRight, Edit, FileText, FileSpreadsheet, Paperclip, Cpu, Monitor, Wifi, Users, ShoppingCart, Image as ImageIcon, Wand2, Printer, PenLine, Trash2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssetTimeline from './AssetTimeline';
import { generateAssetCodeStr } from '@/lib/utils';
import { logAudit, formatAuditDetails } from '@/lib/auditLog';

const statusConfig: Record<string, { icon: any; className: string }> = {
  'ใช้งาน': { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200/50' },
  'ส่งซ่อม': { icon: AlertCircle, className: 'text-red-600 bg-red-50 border-red-200/50' },
  'สำรอง': { icon: Clock, className: 'text-amber-600 bg-amber-50 border-amber-200/50' },
  'ส่งคืน': { icon: Clock, className: 'text-blue-500 bg-blue-50 border-blue-200/50' },
  'ชำรุด': { icon: Ban, className: 'text-orange-500 bg-orange-50 border-orange-200/50' },
  'จำหน่าย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
};

const DetailItem = ({ label, value }: { label: string, value: any }) => {
  if (!value || value === ' / ' || value === ' / -' || value === '- / -') return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

const assetSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่ออุปกรณ์'),
  asset_code: z.string().min(1, 'กรุณาระบุรหัสทรัพย์สิน'),
  status: z.string().min(1, 'กรุณาระบุสถานะ'),
  serial_number: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  assigned_user: z.string().nullable().optional(),
  previous_user: z.string().nullable().optional(),
  user_position: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  assigned_email: z.string().nullable().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'รูปแบบอีเมลไม่ถูกต้อง'),
  price: z.coerce.number().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  warranty_expiry: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  po_number: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  cpu: z.string().nullable().optional(),
  ram: z.string().nullable().optional(),
  storage: z.string().nullable().optional(),
  gpu: z.string().nullable().optional(),
  display: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  os_key: z.string().nullable().optional(),
  windows_version: z.string().nullable().optional(),
  office_version: z.string().nullable().optional(),
  office_license: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  mac_address: z.string().nullable().optional(),
  nas_user: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
type AssetFormValues = z.infer<typeof assetSchema>;

export default function AssetSheet({ isOpen, onClose, assetId, mode = 'edit', onEdit, onEditComplete }: { isOpen: boolean; onClose: () => void; assetId?: string; mode?: 'view' | 'edit'; onEdit?: () => void; onEditComplete?: () => void; }) {
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const [images, setImages] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{name: string, url: string}[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [newSignature, setNewSignature] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const viewSigCanvas = useRef<SignatureCanvas>(null);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: { status: 'ใช้งาน' }
  });

  const { data: lookups } = useQuery({
    queryKey: ['lookups'],
    queryFn: async () => {
      const [deptRes, catRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name')
      ]);
      return {
        departments: deptRes.data || [],
        categories: catRes.data || []
      };
    },
    enabled: isOpen
  });

  const { departments = [], categories = [] } = lookups || {};
  const isLoadingLookups = !lookups;

  const { data: assetData, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: async () => {
      if (!assetId) return null;
      const { data, error } = await supabase.from('assets').select('*, asset_images(file_url), signatures(signature_url)').eq('id', assetId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!assetId
  });

  useEffect(() => {
    if (isOpen) {
      if (assetId && assetData) {
        const initialImages = Array.from(new Set([
          assetData.thumbnail_url,
          ...(assetData.asset_images?.map((img: any) => img.file_url) || [])
        ])).filter(Boolean) as string[];

        setImages(initialImages);
        setThumbnailUrl(assetData.thumbnail_url || (initialImages.length > 0 ? initialImages[0] : null));
        setSignatureUrl(assetData.signatures?.[0]?.signature_url || null);
        
        let initialAttachments: {name: string, url: string}[] = [];
        if (assetData.reference_url) {
          try {
            const parsed = JSON.parse(assetData.reference_url);
            if (Array.isArray(parsed)) {
              initialAttachments = parsed;
            } else {
              initialAttachments = [{ name: 'Attached Document', url: assetData.reference_url }];
            }
          } catch (e) {
            initialAttachments = [{ name: 'Attached Document', url: assetData.reference_url }];
          }
        }
        setAttachments(initialAttachments);
        
        setNewSignature(false);

        form.reset({
          ...assetData,
          price: assetData.price ? Number(assetData.price) : null
        });
      } else if (!assetId) {
        form.reset({ status: 'ใช้งาน' });
        setImages([]);
        setThumbnailUrl(null);
        setSignatureUrl(null);
        setAttachments([]);
        setNewSignature(false);
      }
    }
  }, [isOpen, assetId, assetData, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      const uploadPromises = files.map(async (file) => {
        let processedFile = file;
        let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        if (fileExt === 'heic' || fileExt === 'heif' || file.type === 'image/heic' || file.type === 'image/heif') {
          try {
            const heic2anyModule = await import('heic2any');
            const heic2any = heic2anyModule.default || heic2anyModule;
            const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
            const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
            processedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
            fileExt = 'jpg';
          } catch (err) {
            console.error('HEIC conversion failed:', err);
          }
        }
        
        const fileName = `${uuidv4()}.${fileExt || 'jpg'}`;
        const { error: uploadError } = await supabase.storage.from('asset_images').upload(fileName, processedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('asset_images').getPublicUrl(fileName);
        return data.publicUrl;
      });
      
      const newUrls = await Promise.all(uploadPromises);
      const newImages = [...images, ...newUrls];
      setImages(newImages);
      if (!thumbnailUrl && newImages.length > 0) {
        setThumbnailUrl(newImages[0]);
      }
      toast.success(`อัปโหลดสำเร็จ ${newUrls.length} รูป`);
    } catch (err: any) { 
      toast.error('Upload error: ' + err.message); 
    } finally { 
      setUploading(false); 
      e.target.value = '';
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      const newAttachments = [...attachments];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `docs/${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('asset_images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('asset_images').getPublicUrl(fileName);
        newAttachments.push({ name: file.name, url: data.publicUrl });
      }
      
      setAttachments(newAttachments);
      toast.success('Document(s) uploaded');
    } catch (err: any) { toast.error('Upload error: ' + err.message); }
    finally { setUploading(false); }
  };

  const calculateDepreciation = (price: any, purchaseDate: any) => {
    if (!price || !purchaseDate) return null;
    const pDate = new Date(purchaseDate);
    const now = new Date();
    const monthsPassed = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
    const lifespanMonths = 60; // 5 years
    if (monthsPassed >= lifespanMonths) return 0;
    if (monthsPassed < 0) return Number(price);
    const currentValue = Number(price) * (1 - (monthsPassed / lifespanMonths));
    return currentValue > 0 ? currentValue : 0;
  };

  const removeAttachment = (idx: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(idx, 1);
    setAttachments(newAttachments);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let finalAssetId = assetId;
      
      const payload = { 
        ...data, 
        reference_url: attachments.length > 0 ? JSON.stringify(attachments) : null, 
        thumbnail_url: thumbnailUrl 
      };
      
      // Remove signature fields before saving to assets table
      const sigUrl = payload.signature_url;
      const isNewSig = payload.new_signature;
      delete payload.signature_url;
      delete payload.new_signature;
      
      if (assetId) {
        const { error } = await supabase.from('assets').update(payload).eq('id', assetId);
        if (error) throw error;
      } else {
        const { data: newAsset, error } = await supabase.from('assets').insert([payload]).select('id').single();
        if (error) throw error;
        finalAssetId = newAsset.id;
      }

      if (images !== undefined) {
         await supabase.from('asset_images').delete().eq('asset_id', finalAssetId);
         if (images.length > 0) {
            const imageRecords = images.map((url: string) => ({
               asset_id: finalAssetId,
               file_url: url
            }));
            await supabase.from('asset_images').insert(imageRecords);
         }
      }
      
      if (sigUrl) {
        if (isNewSig) {
           const { error: sigError } = await supabase.from('signatures').insert([{ asset_id: finalAssetId, signature_url: sigUrl }]);
           if (sigError) throw sigError;
        }
      } else if (sigUrl === null && assetId) {
        await supabase.from('signatures').delete().eq('asset_id', assetId);
      }

      if (assetId && assetData) {
        if (data.location !== assetData.location || data.assigned_user !== assetData.assigned_user) {
          const fromLocStr = [assetData.location, assetData.assigned_user].filter(Boolean).join(' - ');
          const toLocStr = [data.location, data.assigned_user].filter(Boolean).join(' - ');
          
          if (fromLocStr !== toLocStr) {
            await supabase.from('asset_transfers').insert([{
              asset_id: assetId,
              from_location: fromLocStr || 'Unknown',
              to_location: toLocStr || 'Unknown',
              transfer_date: new Date().toISOString().split('T')[0],
              status: 'เสร็จสมบูรณ์',
              reason: 'Auto-logged from Asset Edit'
            }]);
          }
        }
      }
    },
    onSuccess: (_data, variables) => {
      const action = assetId ? 'update' : 'create';
      let extra = '';
      if (assetId && assetData) {
        const changes: string[] = [];
        const fieldLabels: Record<string, string> = {
          name: 'ชื่อ',
          status: 'สถานะ',
          assigned_user: 'ผู้ใช้งาน',
          location: 'สถานที่',
          department_id: 'แผนก',
          brand: 'ยี่ห้อ',
          model: 'รุ่น',
          category_id: 'หมวดหมู่',
          serial_number: 'SN',
          notes: 'หมายเหตุ',
          cpu: 'CPU',
          ram: 'RAM',
          storage: 'Storage'
        };
        
        Object.keys(variables).forEach(key => {
          if (['new_signature', 'signature_url', 'attachments', 'images'].includes(key)) return;
          const oldVal = assetData[key];
          const newVal = (variables as any)[key];
          if (oldVal !== newVal && (oldVal || newVal)) {
             const label = fieldLabels[key] || key;
             changes.push(`${label}: ${oldVal || '-'} ➔ ${newVal || '-'}`);
          }
        });
        
        if ((variables as any).new_signature) {
          changes.push('อัปเดตลายเซ็นรับมอบใหม่');
        }
        
        if (changes.length > 0) {
          extra = `อัปเดต: ${changes.join(', ')}`;
        }
      }

      logAudit({
        asset_id: assetId || undefined,
        action,
        details: formatAuditDetails(action, variables?.name, extra),
      });
      toast.success(assetId ? 'Asset updated' : 'Asset created');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      if (assetId) {
        queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
        queryClient.invalidateQueries({ queryKey: ['asset_timeline', assetId] });
        if (onEditComplete) {
          onEditComplete();
        } else {
          onClose();
        }
      } else {
        onClose();
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard_data'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const onSubmit = (data: AssetFormValues) => {
    const cleanData: any = { ...data };
    cleanData.signer_name = cleanData.assigned_user || null;
    cleanData.signer_position = cleanData.user_position || null;
    
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setSignatureUrl(sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'));
      setNewSignature(true);
      // Let React state update, but for the mutation we need it immediately
      saveMutation.mutate({...cleanData, signature_url: sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'), new_signature: true});
      return;
    }
    
    Object.keys(cleanData).forEach(key => { if (cleanData[key] === '') cleanData[key] = null; });
    saveMutation.mutate({...cleanData, signature_url: signatureUrl, new_signature: newSignature});
  };

  const watchDeptId = form.watch('department_id');
  const watchCatId = form.watch('category_id');

  useEffect(() => {
    if (!assetId && watchDeptId && watchCatId) {
      const dept = departments.find(d => d.id === watchDeptId);
      const cat = categories.find(c => c.id === watchCatId);
      
      const generateSeq = async () => {
        try {
           let seq = 1;
           if (cat) {
             const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true }).eq('category_id', cat.id);
             seq = (count || 0) + 1;
           } else {
             const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true });
             seq = (count || 0) + 1;
           }
           const newCode = generateAssetCodeStr(dept?.name || '', cat?.name || '', seq);
           
           if (form.getValues('asset_code') !== newCode) {
             form.setValue('asset_code', newCode, { shouldValidate: true });
           }
        } catch (e) {
           console.error('Error generating sequence', e);
        }
      };
      generateSeq();
    }
  }, [watchDeptId, watchCatId, assetId, departments, categories, form]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIdx === null) return;
      if (e.key === 'Escape') {
        setSelectedImageIdx(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageIdx(prev => (prev! > 0 ? prev! - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImageIdx(prev => (prev! < images.length - 1 ? prev! + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedImageIdx, images.length]);

  if (mode === 'view') {
    const formData = form.getValues();
    const config = statusConfig[formData.status || 'ใช้งาน'] || { icon: AlertCircle, className: 'text-muted-foreground bg-muted border-border/50' };
    const StatusIcon = config.icon;

    return (
      <>
        <Sheet 
          open={isOpen} 
          onOpenChange={(open) => {
            if (!open) {
              if (selectedImageIdx !== null) {
                setSelectedImageIdx(null);
              } else {
                onClose();
              }
            }
          }}
        >
          <SheetContent className="!w-full sm:!w-[50vw] sm:!max-w-[50vw] p-0 flex flex-col bg-background text-foreground overflow-y-auto border-l border-border transition-colors duration-300">
          <SheetHeader className="p-6 pb-5 border-b border-border bg-muted/10">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 pr-6 sm:pr-8">
              <div className="flex-1 min-w-0 w-full">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">{formData.name || 'Unknown Asset'}</h2>
                <p className="text-sm font-medium text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded-md break-all">{formData.asset_code || '-'}</span>
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2 mt-1 md:mt-0 print:hidden w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <Button variant="outline" size="sm" onClick={() => setShowSignDialog(true)} className="gap-1.5 h-8 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 flex-1 sm:flex-none justify-center">
                    <PenLine size={14} />
                    <span className="truncate">เซ็นรับมอบ</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 h-8 text-slate-600 flex-1 sm:flex-none justify-center">
                    <Printer size={14} />
                    <span className="truncate">พิมพ์</span>
                  </Button>
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 h-8 flex-1 sm:flex-none justify-center">
                      <Edit size={14} />
                      <span className="truncate">แก้ไข</span>
                    </Button>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 border shadow-sm w-fit ${config.className}`}>
                  <StatusIcon size={14} />
                  {formData.status}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-8 flex-1">
            {isLoadingAsset || isLoadingLookups ? (
              <div className="py-12 text-center text-muted-foreground">Loading details...</div>
            ) : (
              <>
                {images.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photos ({images.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-2">
                      {images.map((img: string, i: number) => (
                        <div key={i} onClick={() => setSelectedImageIdx(i)} className="cursor-pointer block rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-all aspect-[4/3] group relative">
                          <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white drop-shadow-md font-medium text-sm transition-opacity">View</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Basic Info</h3>
                    <div className="space-y-3">
                      <DetailItem label="Category" value={categories.find(c => c.id === formData.category_id)?.name} />
                      <DetailItem label="Department" value={departments.find(d => d.id === formData.department_id)?.name} />
                      <DetailItem label="Serial Number" value={formData.serial_number} />
                      {formData.asset_code && (
                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground mb-1">Asset QR Code</p>
                          <div className="bg-white p-2 rounded-md border inline-block shadow-sm">
                            <QRCodeSVG 
                              value={typeof window !== 'undefined' ? `${window.location.origin}/scan?code=${formData.asset_code}` : ''} 
                              size={80}
                              level="H"
                              imageSettings={{
                                src: "/logorpm.png", 
                                height: 18,
                                width: 18,
                                excavate: true,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Assignment</h3>
                    <div className="space-y-3">
                      <DetailItem label="Location / Room" value={formData.location} />
                      <DetailItem label="Assigned User" value={formData.assigned_user} />
                      <DetailItem label="Email" value={formData.assigned_email} />
                      <DetailItem label="Position" value={formData.user_position} />
                      <DetailItem label="Previous User" value={formData.previous_user} />
                      <DetailItem label="Handover Signer" value={formData.assigned_user} />
                      <DetailItem label="Signer Position" value={formData.user_position} />
                      {signatureUrl ? (
                        <div className="pt-2 border-t mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">ลายเซ็นผู้รับมอบ</p>
                          <div className="bg-white border rounded p-1 w-full max-w-[200px]">
                            <img src={signatureUrl} alt="Signature" className="w-full h-auto" />
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t mt-2">
                          <button type="button" onClick={() => setShowSignDialog(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 hover:underline">
                            <PenLine size={12} />
                            เพิ่มลายเซ็น
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Hardware Specs</h3>
                    <div className="space-y-3">
                      <DetailItem label="Brand / Model" value={`${formData.brand || ''} ${formData.model || ''}`.trim() || null} />
                      <DetailItem label="CPU / RAM" value={`${formData.cpu || '-'} / ${formData.ram || '-'}`} />
                      <DetailItem label="Storage" value={formData.storage} />
                      <DetailItem label="NAS User" value={formData.nas_user} />
                      <DetailItem label="Password" value={formData.password} />
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Attachments</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center bg-white dark:bg-slate-800 border rounded p-2 text-xs shadow-sm">
                            {file.url.endsWith('.xlsx') || file.url.endsWith('.xls') ? <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0 mr-2" /> : <FileText className="h-4 w-4 text-blue-600 shrink-0 mr-2" />}
                            <a href={file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1" title={file.name}>{file.name}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Software & Licenses</h3>
                    <div className="space-y-3">
                      <DetailItem label="OS" value={formData.os} />
                      <DetailItem label="Windows Version" value={formData.windows_version} />
                      <DetailItem label="OS Key" value={formData.os_key} />
                      <DetailItem label="Office Version" value={formData.office_version} />
                      <DetailItem label="Office License" value={formData.office_license} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Network & Security</h3>
                    <div className="space-y-3">
                      <DetailItem label="IP Address" value={formData.ip_address} />
                      <DetailItem label="MAC Address" value={formData.mac_address} />
                      <DetailItem label="Password / PIN" value={formData.password} />
                      <DetailItem label="NAS User" value={formData.nas_user} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Purchase Details</h3>
                    <div className="space-y-3">
                      <DetailItem label="Purchase Date" value={formData.purchase_date} />
                      <DetailItem label="Warranty Expiry" value={formData.warranty_expiry} />
                      <DetailItem label="Supplier" value={formData.supplier} />
                      <DetailItem label="Price (THB)" value={formData.price ? `฿${Number(formData.price).toLocaleString()}` : null} />
                      {formData.price && formData.purchase_date && (
                        <DetailItem label="Current Value (Depreciation)" value={`฿${calculateDepreciation(formData.price, formData.purchase_date)?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                      )}
                      <DetailItem label="PO/PR Number" value={formData.po_number} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                  {formData.notes && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Notes</h3>
                      <p className="text-sm bg-muted/30 p-3 rounded-md border border-border/50">{formData.notes}</p>
                    </div>
                  )}
                </div>

                {assetId && (
                  <div className="space-y-4 pt-6 border-t border-border mt-8">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History & Timeline</h3>
                    <AssetTimeline assetId={assetId} />
                  </div>
                )}
              </>
            )}
          </div>
          </SheetContent>
        </Sheet>
        
        {selectedImageIdx !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedImageIdx(null)}>
            <button onClick={() => setSelectedImageIdx(null)} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
              <X size={24} />
            </button>
            
            {images.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(prev => (prev! > 0 ? prev! - 1 : images.length - 1)); }} className="absolute left-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
                  <ChevronLeft size={32} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(prev => (prev! < images.length - 1 ? prev! + 1 : 0)); }} className="absolute right-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            
            <img src={images[selectedImageIdx]} alt="Full Size" className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
          </div>
        )}

        {showSignDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowSignDialog(false)}>
            <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-border">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <PenLine size={18} className="text-blue-600" />
                  เซ็นรับมอบทรัพย์สิน
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  ผู้รับมอบ: <span className="font-medium text-foreground">{formData.assigned_user || '—'}</span> · ตำแหน่ง: <span className="font-medium text-foreground">{formData.user_position || '—'}</span>
                </p>
              </div>
              <div className="p-5 space-y-3">
                <div className="border border-input rounded-lg bg-white overflow-hidden shadow-sm h-40 w-full cursor-crosshair relative">
                  <SignatureCanvas ref={viewSigCanvas} penColor="blue" canvasProps={{ className: "w-full h-full" }} />
                  <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground pointer-events-none">เซ็นชื่อที่นี่</div>
                </div>
                <button type="button" onClick={() => viewSigCanvas.current?.clear()} className="text-[11px] text-primary hover:text-primary/80 underline">
                  ล้างลายเซ็น
                </button>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20 rounded-b-2xl">
                <Button variant="outline" size="sm" onClick={() => setShowSignDialog(false)}>ยกเลิก</Button>
                <Button size="sm" disabled={savingSignature} className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={async () => {
                  if (!viewSigCanvas.current || viewSigCanvas.current.isEmpty()) {
                    toast.error('กรุณาเซ็นชื่อก่อนบันทึก');
                    return;
                  }
                  if (!assetId) return;
                  setSavingSignature(true);
                  try {
                    const sigDataUrl = viewSigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
                    await supabase.from('signatures').delete().eq('asset_id', assetId);
                    const { error } = await supabase.from('signatures').insert([{ asset_id: assetId, signature_url: sigDataUrl }]);
                    if (error) throw error;
                    
                    setSignatureUrl(sigDataUrl);
                    queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
                    toast.success('บันทึกลายเซ็นสำเร็จ');
                    setShowSignDialog(false);
                  } catch (err: any) {
                    toast.error('เกิดข้อผิดพลาด: ' + err.message);
                  } finally {
                    setSavingSignature(false);
                  }
                }}>
                  <PenLine size={14} />
                  {savingSignature ? 'กำลังบันทึก...' : 'บันทึกลายเซ็น'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const InputField = ({ name, label, required = false, type = "text", ...props }: any) => {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-bold">{label} {required && '*'}</Label>
        <Input type={type} {...form.register(name)} {...props} />
        {form.formState.errors[name as keyof AssetFormValues] && (
          <p className="text-xs text-red-500">{form.formState.errors[name as keyof AssetFormValues]?.message}</p>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="!w-full sm:!w-[60vw] sm:!max-w-[60vw] p-0 flex flex-col bg-background text-foreground border-l border-border shadow-2xl transition-colors duration-300">
        <SheetHeader className="p-6 pb-4 bg-background border-b border-border shrink-0">
          <SheetTitle className="text-xl font-bold">
            {assetId ? 'แก้ไขข้อมูลทรัพย์สิน' : 'เพิ่มทรัพย์สินใหม่'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {isLoadingAsset || isLoadingLookups ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center h-full">กำลังโหลดข้อมูล...</div>
          ) : (
            <form id="asset-form" onSubmit={form.handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6 pb-8">
              
              <div className="space-y-3">
                <Label className="text-sm font-bold">รูปภาพอ้างอิง</Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group shrink-0">
                      <img src={img} alt="" className="h-20 w-20 object-cover rounded-md border border-border" />
                      <Button type="button" size="icon" variant="destructive" 
                        onClick={() => {
                          const newImages = images.filter((_, idx) => idx !== i);
                          setImages(newImages);
                          setThumbnailUrl(newImages.length > 0 ? newImages[0] : null);
                        }} 
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <X size={10} />
                      </Button>
                    </div>
                  ))}
                  
                  <Label className="cursor-pointer flex flex-col items-center justify-center h-20 w-20 bg-muted/30 hover:bg-muted border-2 border-dashed border-input rounded-md transition-colors">
                    <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-[9px] font-medium text-muted-foreground">{uploading ? 'อัปโหลด...' : 'เพิ่มรูป'}</span>
                    <input type="file" className="hidden" accept="image/*,.heic,.heif" multiple onChange={handleImageUpload} disabled={uploading} />
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <InputField name="name" label="ชื่ออุปกรณ์" required placeholder="เช่น Laptop Dell Latitude 5540" />
                <InputField name="asset_code" label="รหัสทรัพย์สิน" required placeholder="สร้างอัตโนมัติเมื่อเลือกแผนกและประเภท" />
                
                <InputField name="serial_number" label="Serial Number" placeholder="Serial Number" />
                
                <div className="space-y-1.5"><Label className="text-sm font-bold">ประเภทอุปกรณ์</Label>
                  <Controller name="category_id" control={form.control} render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- เลือก --">
                          {field.value ? categories.find(c => c.id === field.value)?.name : "-- เลือก --"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">แผนก</Label>
                  <Controller name="department_id" control={form.control} render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- เลือก --">
                          {field.value ? departments.find(d => d.id === field.value)?.name : "-- เลือก --"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
                
                <InputField name="location" label="สถานที่ / ห้อง" placeholder="เช่น ห้อง Server, ชั้น 2" />
                <InputField name="assigned_user" label="ชื่อผู้ใช้" placeholder="เช่น คุณสมชาย ใจดี" />
                <InputField name="previous_user" label="ผู้ใช้ก่อนหน้า" placeholder="ผู้ใช้คนก่อน" />
                <InputField name="user_position" label="ตำแหน่ง" placeholder="เช่น ผู้จัดการไอที" />
                <InputField name="brand" label="ยี่ห้อ (Brand)" placeholder="เช่น Dell, HP, Lenovo" />
                
                <div className="md:col-span-2">
                  <InputField name="assigned_email" label="อีเมลผู้ใช้งาน (Email)" placeholder="เช่น user@company.com" />
                </div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">สถานะ</Label>
                  <Controller name="status" control={form.control} render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="ใช้งาน" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ใช้งาน">ใช้งาน (Active)</SelectItem>
                        <SelectItem value="ส่งซ่อม">ส่งซ่อม (Repair)</SelectItem>
                        <SelectItem value="สำรอง">สำรอง (Spare)</SelectItem>
                        <SelectItem value="ส่งคืน">ส่งคืน (Returned)</SelectItem>
                        <SelectItem value="ชำรุด">ชำรุด (Damaged)</SelectItem>
                        <SelectItem value="จำหน่าย">จำหน่าย (Disposed)</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                
                <InputField name="price" label="ราคา (บาท)" type="number" step="0.01" placeholder="0.00" />
                <InputField name="purchase_date" label="วันที่ซื้อ" type="date" />
                <InputField name="warranty_expiry" label="วันหมดประกัน" type="date" />
                
                <div className="md:col-span-2">
                  <InputField name="supplier" label="ผู้จำหน่าย / Supplier" placeholder="ชื่อผู้จำหน่าย" />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm font-bold">เอกสารแนบ (Attachments)</Label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input {...form.register('po_number')} placeholder="เลขที่เอกสารสั่งซื้อ (PO/PR)" />
                      </div>
                      <div className="shrink-0">
                        <label className="cursor-pointer inline-flex items-center gap-2 h-10 px-4 bg-muted/30 hover:bg-muted border border-input rounded-lg transition-colors text-sm text-muted-foreground font-medium whitespace-nowrap">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                          {uploading ? 'อัปโหลด...' : 'เพิ่มไฟล์แนบ'}
                          <input type="file" accept=".pdf,.xlsx,.xls,image/*" multiple className="hidden" onChange={handleDocumentUpload} disabled={uploading} />
                        </label>
                      </div>
                    </div>
                    {attachments.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 border rounded p-2 text-xs shadow-sm">
                            <div className="flex items-center overflow-hidden">
                              {file.url.endsWith('.xlsx') || file.url.endsWith('.xls') ? <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0 mr-2" /> : <FileText className="h-4 w-4 text-blue-600 shrink-0 mr-2" />}
                              <a href={file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate mr-2" title={file.name}>{file.name}</a>
                            </div>
                            <button type="button" onClick={() => removeAttachment(idx)} className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors" title="ลบไฟล์">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <details className="group bg-muted/20 rounded-lg border border-border mt-6">
                <summary className="flex items-center font-bold cursor-pointer list-none p-4 hover:bg-muted/30 transition-colors rounded-lg">
                  <span className="mr-2 transition-transform duration-300 group-open:rotate-90">▶</span>
                  <span className="text-primary mr-2">➕</span> ระบุสเปคหรือออปชันเพิ่มเติม (Optional แบบละเอียด)
                </summary>
                
                <div className="p-5 pt-2 border-t border-border space-y-8">
                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลสเปคฮาร์ดแวร์</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <InputField name="model" label="Model / นามสกุลรุ่น" placeholder="เช่น XPS 15 9520" />
                      <InputField name="cpu" label="CPU / Processor" placeholder="เช่น Intel Core i7-12700H หรือ Apple M2" />
                      <InputField name="ram" label="RAM (Memory)" placeholder="เช่น 32GB LPDDR5 4800MHz" />
                      <InputField name="storage" label="Storage (HDD/SSD)" placeholder="เช่น 1TB PCIe NVMe Gen4 SSD" />
                      <InputField name="gpu" label="GPU / การ์ดจอ" placeholder="เช่น NVIDIA RTX 3050Ti 4GB" />
                      <InputField name="display" label="Display / หน้าจอ" placeholder="เช่น 15.6 FHD (1920x1080) 144Hz" />
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลซอฟต์แวร์และเน็ตเวิร์ก</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <InputField name="os" label="OS / Windows Version" placeholder="เช่น Windows 11 Pro 64-bit" />
                      <InputField name="os_key" label="OS License Key (ถ้ามี)" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" />
                      <InputField name="windows_version" label="Windows Version (เวอร์ชัน)" placeholder="เช่น 10 Pro, 11 Home" />
                      <InputField name="office_version" label="Office Version" placeholder="เช่น 365, 2019, 2022" />
                      <InputField name="office_license" label="Office License" placeholder="เช่น rpm_admin1, No license" />
                      <div />
                      <InputField name="ip_address" label="IP Address" placeholder="เช่น 192.168.1.50" />
                      <InputField name="mac_address" label="MAC Address (LAN / Wi-Fi)" placeholder="เช่น 00:1A:2B:3C:4D:5E" className="uppercase" />
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลเพิ่มเติม</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <InputField name="nas_user" label="User NAS" placeholder="ชื่อผู้ใช้งาน File Server" />
                      <InputField name="password" label="รหัสผ่าน NAS" placeholder="รหัสผ่านล็อกอิน NAS" />
                    </div>
                  </div>
                </div>
              </details>

              <div className="space-y-1.5 pt-2">
                <Label className="text-sm font-bold">หมายเหตุ</Label>
                <textarea {...form.register('notes')} rows={3}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-input/30" placeholder="รายละเอียดอื่นๆ..." />
              </div>

              <div className="pt-6 border-t border-border">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-bold">การเซ็นรับมอบ</h4>
                    <span className="text-xs text-muted-foreground">ผู้รับมอบ: {form.watch('assigned_user') || '—'} | ตำแหน่ง: {form.watch('user_position') || '—'}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex justify-between">
                      <span>ลายเซ็น</span>
                      <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] text-primary hover:text-primary/80 underline">ล้างลายเซ็น</button>
                    </Label>
                    <div className="border border-input rounded-lg bg-background overflow-hidden shadow-sm h-36 w-full">
                      {signatureUrl && !newSignature ? (
                        <div className="relative h-full flex items-center justify-center bg-muted/10">
                          <img src={signatureUrl} alt="Signature" className="h-full w-auto max-w-full object-contain" />
                          <button type="button" onClick={() => {setSignatureUrl(null); setNewSignature(true);}} className="absolute top-2 right-2 bg-destructive/10 p-1.5 rounded-full text-destructive hover:bg-destructive/20 transition-colors shadow-sm">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="h-full relative cursor-crosshair">
                          <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: "w-full h-full" }} />
                          <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground pointer-events-none">เซ็นชื่อที่นี่</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {assetId && !isLoadingAsset && (
            <div className="mt-8 pt-6 border-t border-border max-w-4xl mx-auto">
              <h3 className="text-sm font-bold mb-4">ประวัติและไทม์ไลน์</h3>
              <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
                <AssetTimeline assetId={assetId} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-background mt-auto flex justify-end gap-3 shrink-0 shadow-sm z-10">
          <Button type="button" variant="outline" onClick={onClose} className="w-24">ยกเลิก</Button>
          <Button type="submit" form="asset-form" disabled={saveMutation.isPending || uploading} className="w-32">
            {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

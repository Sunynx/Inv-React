'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

import { Camera, Upload, X, CheckCircle2, AlertCircle, Clock, Ban, ChevronLeft, ChevronRight, Edit, FileText, FileSpreadsheet, Paperclip, Cpu, Monitor, Wifi, Users, ShoppingCart, Image as ImageIcon, Wand2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssetTimeline from './AssetTimeline';
import { generateAssetCodeStr } from '@/lib/utils';

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

export default function AssetSheet({ isOpen, onClose, assetId, mode = 'edit', onEdit }: { isOpen: boolean; onClose: () => void; assetId?: string; mode?: 'view' | 'edit'; onEdit?: () => void; }) {
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('basic');
  const queryClient = useQueryClient();

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
        ])).filter(Boolean);

        setFormData({
          ...assetData,
          images: initialImages,
          thumbnail_url: assetData.thumbnail_url || (initialImages.length > 0 ? initialImages[0] : null),
          signature_url: assetData.signatures?.[0]?.signature_url || null
        });
      } else if (!assetId) {
        setFormData({ status: 'ใช้งาน', images: [] });
      }
    } else {
      setFormData({});
      setActiveSection('basic');
    }
  }, [isOpen, assetId, assetData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      const uploadPromises = files.map(async (file) => {
        let processedFile = file;
        let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Convert HEIC/HEIF to JPEG
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
            // Fallback to original file if conversion fails
          }
        }
        
        const fileName = `${uuidv4()}.${fileExt || 'jpg'}`;
        const { error: uploadError } = await supabase.storage.from('asset-images').upload(fileName, processedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('asset-images').getPublicUrl(fileName);
        return data.publicUrl;
      });
      
      const newUrls = await Promise.all(uploadPromises);
      
      setFormData((prev: any) => {
        const currentImages = prev.images || [];
        const combinedImages = [...currentImages, ...newUrls];
        return {
          ...prev,
          images: combinedImages,
          thumbnail_url: combinedImages.length > 0 ? combinedImages[0] : null
        };
      });
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
      const file = e.target.files?.[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `docs/${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('asset-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('asset-images').getPublicUrl(fileName);
      
      setFormData({ 
        ...formData, 
        reference_url: data.publicUrl
      });
      toast.success('Document uploaded');
    } catch (err: any) { toast.error('Upload error: ' + err.message); }
    finally { setUploading(false); }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, asset_images, departments, categories, signatures, signature_url, images, new_signature, ...rest } = data;
      
      let finalAssetId = id;
      
      if (id) {
        const { error } = await supabase.from('assets').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newAsset, error } = await supabase.from('assets').insert([rest]).select('id').single();
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
      
      // Handle signature saving
      if (signature_url) {
        // Since we allow only one signature for handover currently, we can just insert or replace.
        // For simplicity, we just insert. The DB allows multiple signatures per asset.
        if (data.new_signature) {
           const { error: sigError } = await supabase.from('signatures').insert([{ asset_id: finalAssetId, signature_url }]);
           if (sigError) throw sigError;
        }
      } else if (data.signature_url === null && id) {
        // If signature was removed
        await supabase.from('signatures').delete().eq('asset_id', id);
      }

      // Auto-log transfer if assigned user or location changed
      if (id && assetData) {
        if (data.location !== assetData.location || data.assigned_user !== assetData.assigned_user) {
          const fromLocStr = [assetData.location, assetData.assigned_user].filter(Boolean).join(' - ');
          const toLocStr = [data.location, data.assigned_user].filter(Boolean).join(' - ');
          
          if (fromLocStr !== toLocStr) {
            await supabase.from('asset_transfers').insert([{
              asset_id: id,
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
    onSuccess: () => {
      toast.success(assetId ? 'Asset updated' : 'Asset created');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanData = { ...formData };
    
    // Auto-link signer fields from assigned user
    cleanData.signer_name = cleanData.assigned_user || null;
    cleanData.signer_position = cleanData.user_position || null;
    
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      cleanData.signature_url = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      cleanData.new_signature = true;
    }
    
    Object.keys(cleanData).forEach(key => { if (cleanData[key] === '') cleanData[key] = null; });
    saveMutation.mutate(cleanData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  // Auto-generate asset code real-time (New Asset only)
  useEffect(() => {
    if (!assetId) {
      const dept = departments.find(d => d.id === formData.department_id);
      const cat = categories.find(c => c.id === formData.category_id);
      
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
           
           setFormData((prev: any) => {
             // Only auto-update if it's currently empty, OR if it's a previously auto-generated code
             // To be simple, we just always update it when dept/cat changes for a new asset.
             if (prev.asset_code !== newCode) {
               return { ...prev, asset_code: newCode };
             }
             return prev;
           });
        } catch (e) {
           console.error('Error generating sequence', e);
        }
      };
      generateSeq();
    }
  }, [formData.department_id, formData.category_id, assetId, departments, categories]);

  const sections = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'assignment', label: 'Assignment' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'purchase', label: 'Purchase' },
  ];
  if (assetId) {
    sections.push({ id: 'timeline', label: 'Timeline' });
  }

  const currentImages = formData.images || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIdx === null) return;
      if (e.key === 'Escape') {
        setSelectedImageIdx(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageIdx(prev => (prev! > 0 ? prev! - 1 : currentImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImageIdx(prev => (prev! < currentImages.length - 1 ? prev! + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedImageIdx, currentImages.length]);

  if (mode === 'view') {
    const config = statusConfig[formData.status] || { icon: AlertCircle, className: 'text-muted-foreground bg-muted border-border/50' };
    const StatusIcon = config.icon;

    return (
      <>
        <Sheet 
          open={isOpen} 
          onOpenChange={(open) => {
            if (!open) {
              if (selectedImageIdx !== null) {
                // If image viewer is open, just close the viewer and prevent sheet from closing
                setSelectedImageIdx(null);
              } else {
                onClose();
              }
            }
          }}
        >
          <SheetContent className="!w-full sm:!w-[50vw] sm:!max-w-[50vw] p-0 flex flex-col bg-background text-foreground overflow-y-auto border-l border-border transition-colors duration-300">
          <SheetHeader className="p-6 pb-5 border-b border-border bg-muted/10">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{formData.name || 'Unknown Asset'}</h2>
                <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded-md">{formData.asset_code || '-'}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 pr-8 mt-2 sm:mt-0">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit} className="gap-2 h-8">
                    <Edit size={14} />
                    Edit Asset
                  </Button>
                )}
                <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 border shadow-sm ${config.className}`}>
                  <StatusIcon size={14} />
                  {formData.status}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-8 flex-1">
            {isLoadingAsset ? (
              <div className="py-12 text-center text-muted-foreground">Loading details...</div>
            ) : (
              <>
                {/* Image Gallery */}
                {currentImages.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photos ({currentImages.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-2">
                      {currentImages.map((img: string, i: number) => (
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

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Basic Info</h3>
                    <div className="space-y-3">
                      <DetailItem label="Category" value={categories.find(c => c.id === formData.category_id)?.name} />
                      <DetailItem label="Department" value={departments.find(d => d.id === formData.department_id)?.name} />
                      <DetailItem label="Serial Number" value={formData.serial_number} />
                    </div>
                  </div>

                  {/* Assignment & Handover */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Assignment</h3>
                    <div className="space-y-3">
                      <DetailItem label="Location / Room" value={formData.location} />
                      <DetailItem label="Assigned User" value={formData.assigned_user} />
                      <DetailItem label="Email" value={formData.assigned_email} />
                      <DetailItem label="Position" value={formData.user_position} />
                      <DetailItem label="Previous User" value={formData.previous_user} />
                      <DetailItem label="Handover Signer" value={formData.signer_name} />
                      <DetailItem label="Signer Position" value={formData.signer_position} />
                      {formData.signature_url && (
                        <div className="pt-2 border-t mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Signer Signature</p>
                          <div className="bg-white border rounded p-1 w-full max-w-[200px]">
                            <img src={formData.signature_url} alt="Signature" className="w-full h-auto" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hardware */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Hardware Specs</h3>
                    <div className="space-y-3">
                      <DetailItem label="Brand / Model" value={`${formData.brand || ''} ${formData.model || ''}`.trim() || null} />
                      <DetailItem label="CPU / RAM" value={`${formData.cpu || '-'} / ${formData.ram || '-'}`} />
                      <DetailItem label="Storage" value={formData.storage} />
                      <DetailItem label="GPU" value={formData.gpu} />
                      <DetailItem label="Display" value={formData.display} />
                    </div>
                  </div>

                  {/* Software & Licenses */}
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

                  {/* Network & Security */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Network & Security</h3>
                    <div className="space-y-3">
                      <DetailItem label="IP Address" value={formData.ip_address} />
                      <DetailItem label="MAC Address" value={formData.mac_address} />
                      <DetailItem label="Password / PIN" value={formData.password} />
                      <DetailItem label="NAS User" value={formData.nas_user} />
                    </div>
                  </div>

                  {/* Purchase */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Purchase Details</h3>
                    <div className="space-y-3">
                      <DetailItem label="Purchase Date" value={formData.purchase_date} />
                      <DetailItem label="Warranty Expiry" value={formData.warranty_expiry} />
                      <DetailItem label="Supplier" value={formData.supplier} />
                      <DetailItem label="Price (THB)" value={formData.price ? `฿${Number(formData.price).toLocaleString()}` : null} />
                      <DetailItem label="PO/PR Number" value={formData.po_number} />
                    </div>
                  </div>
                </div>

                {/* Notes & References */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                  {formData.notes && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Notes</h3>
                      <p className="text-sm bg-muted/30 p-3 rounded-md border border-border/50">{formData.notes}</p>
                    </div>
                  )}
                  {formData.reference_url && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Reference Document</h3>
                      <a href={formData.reference_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-md border border-blue-100 transition-colors">
                        {formData.reference_url.endsWith('.xlsx') || formData.reference_url.endsWith('.xls') ? <FileSpreadsheet size={18} className="text-green-600" /> : <FileText size={18} className="text-red-500" />}
                        <span className="font-medium">ดูเอกสารอ้างอิง</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Timeline */}
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
        
        {/* Full Screen Image Modal */}
        {selectedImageIdx !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedImageIdx(null)}>
            <button onClick={() => setSelectedImageIdx(null)} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
              <X size={24} />
            </button>
            
            {currentImages.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(prev => (prev! > 0 ? prev! - 1 : currentImages.length - 1)); }} className="absolute left-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
                  <ChevronLeft size={32} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(prev => (prev! < currentImages.length - 1 ? prev! + 1 : 0)); }} className="absolute right-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10">
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            
            <img src={currentImages[selectedImageIdx]} alt="Full Size" className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </>
    );
  }

  // EDIT MODE
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="!w-full sm:!w-[60vw] sm:!max-w-[60vw] p-0 flex flex-col bg-background text-foreground border-l border-border shadow-2xl transition-colors duration-300">
        <SheetHeader className="p-6 pb-4 bg-background border-b border-border shrink-0">
          <SheetTitle className="text-xl font-bold">
            {assetId ? 'แก้ไขข้อมูลทรัพย์สิน' : 'เพิ่มทรัพย์สินใหม่'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {isLoadingAsset ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center h-full">กำลังโหลดข้อมูล...</div>
          ) : (
            <form id="asset-form" onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6 pb-8">
              
              {/* IMAGE UPLOAD */}
              <div className="space-y-3">
                <Label className="text-sm font-bold">รูปภาพอ้างอิง</Label>
                <div className="flex flex-wrap gap-3">
                  {currentImages.map((img, i) => (
                    <div key={i} className="relative group shrink-0">
                      <img src={img} alt="" className="h-20 w-20 object-cover rounded-md border border-border" />
                      <Button type="button" size="icon" variant="destructive" 
                        onClick={() => {
                          setFormData((prev: any) => {
                            const currentImgs = prev.images || [];
                            const newImages = currentImgs.filter((_: any, idx: number) => idx !== i);
                            return { ...prev, images: newImages, thumbnail_url: newImages.length > 0 ? newImages[0] : null };
                          });
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

              {/* MAIN FORM GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div className="space-y-1.5"><Label className="text-sm font-bold">ชื่ออุปกรณ์ *</Label><Input required name="name" value={formData.name || ''} onChange={handleChange} placeholder="เช่น Laptop Dell Latitude 5540" /></div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">รหัสทรัพย์สิน *</Label>
                  <Input required name="asset_code" value={formData.asset_code || ''} onChange={handleChange} placeholder="สร้างอัตโนมัติเมื่อเลือกแผนกและประเภท" />
                </div>
                
                <div className="space-y-1.5"><Label className="text-sm font-bold">Serial Number</Label><Input name="serial_number" value={formData.serial_number || ''} onChange={handleChange} placeholder="Serial Number" /></div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">ประเภทอุปกรณ์</Label>
                  <Select value={formData.category_id || ''} onValueChange={(v) => handleSelectChange('category_id', v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-- เลือก --">{categories.find(c => c.id === formData.category_id)?.name || '-- เลือก --'}</SelectValue></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">แผนก</Label>
                  <Select value={formData.department_id || ''} onValueChange={(v) => handleSelectChange('department_id', v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-- เลือก --">{departments.find(d => d.id === formData.department_id)?.name || '-- เลือก --'}</SelectValue></SelectTrigger>
                    <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">สถานที่ / ห้อง</Label><Input name="location" value={formData.location || ''} onChange={handleChange} placeholder="เช่น ห้อง Server, ชั้น 2" /></div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">ชื่อผู้ใช้</Label><Input name="assigned_user" value={formData.assigned_user || ''} onChange={handleChange} placeholder="เช่น คุณสมชาย ใจดี" /></div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">ผู้ใช้ก่อนหน้า</Label><Input name="previous_user" value={formData.previous_user || ''} onChange={handleChange} placeholder="ผู้ใช้คนก่อน" /></div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">ตำแหน่ง</Label><Input name="user_position" value={formData.user_position || ''} onChange={handleChange} placeholder="เช่น ผู้จัดการไอที" /></div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">ยี่ห้อ (Brand)</Label><Input name="brand" value={formData.brand || ''} onChange={handleChange} placeholder="เช่น Dell, HP, Lenovo" /></div>

                <div className="space-y-1.5 md:col-span-2"><Label className="text-sm font-bold">อีเมลผู้ใช้งาน (Email)</Label><Input name="assigned_email" value={formData.assigned_email || ''} onChange={handleChange} placeholder="เช่น user@company.com" /></div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">สถานะ</Label>
                  <Select required value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)}>
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
                </div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">ราคา (บาท)</Label><Input type="number" step="0.01" name="price" value={formData.price || ''} onChange={handleChange} placeholder="0.00" /></div>

                <div className="space-y-1.5"><Label className="text-sm font-bold">วันที่ซื้อ</Label><Input type="date" name="purchase_date" value={formData.purchase_date || ''} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label className="text-sm font-bold">วันหมดประกัน</Label><Input type="date" name="warranty_expiry" value={formData.warranty_expiry || ''} onChange={handleChange} /></div>

                <div className="space-y-1.5 md:col-span-2"><Label className="text-sm font-bold">ผู้จำหน่าย / Supplier</Label><Input name="supplier" value={formData.supplier || ''} onChange={handleChange} placeholder="ชื่อผู้จำหน่าย" /></div>

                {/* PO/PR with inline file upload */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm font-bold">หมายเลข PO/PR</Label>
                  <div className="flex gap-3 items-start">
                    <Input name="po_number" value={formData.po_number || ''} onChange={handleChange} placeholder="เลขที่เอกสารสั่งซื้อ" className="flex-1" />
                    <div className="shrink-0">
                      {formData.reference_url ? (
                        <div className="flex items-center gap-2 h-8 px-3 bg-muted/50 border border-input rounded-lg">
                          {formData.reference_url.endsWith('.xlsx') || formData.reference_url.endsWith('.xls') ? <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" /> : <FileText className="h-4 w-4 text-destructive shrink-0" />}
                          <a href={formData.reference_url} target="_blank" rel="noreferrer" className="text-primary text-xs font-medium hover:underline truncate max-w-[120px]">
                            {formData.reference_url.split('/').pop() || 'ไฟล์'}
                          </a>
                          <button type="button" onClick={() => setFormData({ ...formData, reference_url: null })} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0" title="ลบไฟล์">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-2 h-8 px-4 bg-muted/30 hover:bg-muted border border-input rounded-lg transition-colors text-sm text-muted-foreground font-medium whitespace-nowrap">
                          <Paperclip className="h-4 w-4" />
                          {uploading ? 'อัปโหลด...' : 'แนบไฟล์'}
                          <input type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={handleDocumentUpload} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAILS SECTION (OPTIONAL SPECS) */}
              <details className="group bg-muted/20 rounded-lg border border-border mt-6">
                <summary className="flex items-center font-bold cursor-pointer list-none p-4 hover:bg-muted/30 transition-colors rounded-lg">
                  <span className="mr-2 transition-transform duration-300 group-open:rotate-90">▶</span>
                  <span className="text-primary mr-2">➕</span> ระบุสเปคหรือออปชันเพิ่มเติม (Optional แบบละเอียด)
                </summary>
                
                <div className="p-5 pt-2 border-t border-border space-y-8">
                  
                  {/* ข้อมูลสเปคฮาร์ดแวร์ */}
                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลสเปคฮาร์ดแวร์</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Model / นามสกุลรุ่น</Label><Input name="model" value={formData.model || ''} onChange={handleChange} placeholder="เช่น XPS 15 9520" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">CPU / Processor</Label><Input name="cpu" value={formData.cpu || ''} onChange={handleChange} placeholder="เช่น Intel Core i7-12700H หรือ Apple M2" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">RAM (Memory)</Label><Input name="ram" value={formData.ram || ''} onChange={handleChange} placeholder="เช่น 32GB LPDDR5 4800MHz" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Storage (HDD/SSD)</Label><Input name="storage" value={formData.storage || ''} onChange={handleChange} placeholder="เช่น 1TB PCIe NVMe Gen4 SSD" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">GPU / การ์ดจอ</Label><Input name="gpu" value={formData.gpu || ''} onChange={handleChange} placeholder="เช่น NVIDIA RTX 3050Ti 4GB" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Display / หน้าจอ</Label><Input name="display" value={formData.display || ''} onChange={handleChange} placeholder="เช่น 15.6 FHD (1920x1080) 144Hz" /></div>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* ข้อมูลซอฟต์แวร์และเน็ตเวิร์ก */}
                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลซอฟต์แวร์และเน็ตเวิร์ก</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-sm font-bold">OS / Windows Version</Label><Input name="os" value={formData.os || ''} onChange={handleChange} placeholder="เช่น Windows 11 Pro 64-bit" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">OS License Key (ถ้ามี)</Label><Input name="os_key" value={formData.os_key || ''} onChange={handleChange} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Windows Version (เวอร์ชัน)</Label><Input name="windows_version" value={formData.windows_version || ''} onChange={handleChange} placeholder="เช่น 10 Pro, 11 Home" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Office Version</Label><Input name="office_version" value={formData.office_version || ''} onChange={handleChange} placeholder="เช่น 365, 2019, 2022" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">Office License</Label><Input name="office_license" value={formData.office_license || ''} onChange={handleChange} placeholder="เช่น rpm_admin1, No license" /></div>
                      <div />
                      <div className="space-y-1.5"><Label className="text-sm font-bold">IP Address</Label><Input name="ip_address" value={formData.ip_address || ''} onChange={handleChange} placeholder="เช่น 192.168.1.50" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">MAC Address (LAN / Wi-Fi)</Label><Input name="mac_address" value={formData.mac_address || ''} onChange={handleChange} placeholder="เช่น 00:1A:2B:3C:4D:5E" className="uppercase" /></div>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* ข้อมูลเพิ่มเติม */}
                  <div>
                    <h4 className="text-[15px] font-bold mb-4">ข้อมูลเพิ่มเติม</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-sm font-bold">User NAS</Label><Input name="nas_user" value={formData.nas_user || ''} onChange={handleChange} placeholder="ชื่อผู้ใช้งาน File Server" /></div>
                      <div className="space-y-1.5"><Label className="text-sm font-bold">รหัสผ่าน NAS</Label><Input name="password" value={formData.password || ''} onChange={handleChange} placeholder="รหัสผ่านล็อกอิน NAS" /></div>
                    </div>
                  </div>

                </div>
              </details>

              {/* NOTES */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-sm font-bold">หมายเหตุ</Label>
                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-input/30" placeholder="รายละเอียดอื่นๆ..." />
              </div>

              {/* SIGNATURE - full width, linked to ชื่อผู้ใช้ and ตำแหน่ง */}
              <div className="pt-6 border-t border-border">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-bold">การเซ็นรับมอบ</h4>
                    <span className="text-xs text-muted-foreground">ผู้รับมอบ: {formData.assigned_user || '—'} | ตำแหน่ง: {formData.user_position || '—'}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex justify-between">
                      <span>ลายเซ็น</span>
                      <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] text-primary hover:text-primary/80 underline">ล้างลายเซ็น</button>
                    </Label>
                    <div className="border border-input rounded-lg bg-background overflow-hidden shadow-sm h-36 w-full">
                      {formData.signature_url && !formData.new_signature ? (
                        <div className="relative h-full flex items-center justify-center bg-muted/10">
                          <img src={formData.signature_url} alt="Signature" className="h-full w-auto max-w-full object-contain" />
                          <button type="button" onClick={() => setFormData({...formData, signature_url: null, new_signature: true})} className="absolute top-2 right-2 bg-destructive/10 p-1.5 rounded-full text-destructive hover:bg-destructive/20 transition-colors shadow-sm">
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

          {/* Timeline in Edit Mode */}
          {assetId && !isLoadingAsset && (
            <div className="mt-8 pt-6 border-t border-border max-w-4xl mx-auto">
              <h3 className="text-sm font-bold mb-4">ประวัติและไทม์ไลน์</h3>
              <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
                <AssetTimeline assetId={assetId} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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

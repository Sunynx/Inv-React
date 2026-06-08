'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Upload, X, CheckCircle2, AlertCircle, Clock, Ban, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssetTimeline from './AssetTimeline';

const statusConfig: Record<string, { icon: any; className: string }> = {
  'ใช้งาน': { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200/50' },
  'ส่งซ่อม': { icon: AlertCircle, className: 'text-red-600 bg-red-50 border-red-200/50' },
  'สำรอง': { icon: Clock, className: 'text-amber-600 bg-amber-50 border-amber-200/50' },
  'แทงจำหน่าย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
  'สูญหาย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
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
        setFormData({
          ...assetData,
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
      const file = e.target.files?.[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('asset-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('asset-images').getPublicUrl(fileName);
      
      const currentImages = formData.images || [];
      const newImages = [...currentImages, data.publicUrl];
      
      setFormData({ 
        ...formData, 
        images: newImages,
        thumbnail_url: newImages.length > 0 ? newImages[0] : null
      });
      toast.success('Image uploaded');
    } catch (err: any) { toast.error('Upload error: ' + err.message); }
    finally { setUploading(false); }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, asset_images, departments, categories, signatures, signature_url, ...rest } = data;
      
      let finalAssetId = id;
      
      if (id) {
        const { error } = await supabase.from('assets').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newAsset, error } = await supabase.from('assets').insert([rest]).select('id').single();
        if (error) throw error;
        finalAssetId = newAsset.id;
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
    setFormData({ ...formData, [name]: value });
  };

  const sections = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'assignment', label: 'Assignment' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'purchase', label: 'Purchase' },
  ];
  if (assetId) {
    sections.push({ id: 'timeline', label: 'Timeline' });
  }

  const currentImages = Array.from(new Set([
    formData.thumbnail_url,
    ...(formData.asset_images?.map((img: any) => img.file_url) || []),
    ...(formData.images || [])
  ])).filter(Boolean);

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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIdx, currentImages.length]);

  if (mode === 'view') {
    const config = statusConfig[formData.status] || { icon: AlertCircle, className: 'text-muted-foreground bg-muted border-border/50' };
    const StatusIcon = config.icon;

    return (
      <>
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
                      <a href={formData.reference_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline">
                        View Reference Document
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
      <SheetContent className="!w-full sm:!w-[50vw] sm:!max-w-[50vw] p-0 flex flex-col bg-background text-foreground overflow-y-auto border-l border-border shadow-2xl transition-colors duration-300">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-semibold text-foreground">{assetId ? 'Edit Asset' : 'Add New Asset'}</SheetTitle>
        </SheetHeader>

        {/* Image Upload - Multi */}
        <div className="px-6 pt-4 pb-4 border-b border-border bg-white">
          <div className="flex overflow-x-auto gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border transition-colors items-center scrollbar-thin">
            {currentImages.map((img: string, i: number) => (
              <div key={i} className="relative group shrink-0">
                <img src={img} alt="" className="h-16 w-16 object-cover rounded-lg border border-border" />
                <Button type="button" size="icon" variant="destructive" 
                  onClick={() => {
                    const newImages = currentImages.filter((_, idx) => idx !== i);
                    setFormData({...formData, images: newImages, thumbnail_url: newImages.length > 0 ? newImages[0] : null});
                  }} 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} />
                </Button>
              </div>
            ))}
            
            <div className={`flex-1 min-w-0 min-h-[64px] flex flex-col justify-center ${currentImages.length > 0 ? 'border-l pl-3 ml-1' : ''}`}>
              <p className="text-xs font-medium text-foreground">Asset Photos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">JPG, PNG up to 5MB</p>
              <Label className="cursor-pointer text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1 w-fit">
                <Upload size={12} />
                {uploading ? 'Uploading...' : 'Upload Image'}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              </Label>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 flex-1 bg-gray-50/30">
          {isLoadingAsset ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : (
            <form id="asset-form" onSubmit={handleSave} className="space-y-8">
              
              <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Basic Info</h3>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Asset Name *</Label>
                    <Input required name="name" value={formData.name || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Asset Code *</Label>
                      <Input required name="asset_code" value={formData.asset_code || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Serial Number</Label>
                      <Input name="serial_number" value={formData.serial_number || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Category</Label>
                      <Select value={formData.category_id || ''} onValueChange={(v) => handleSelectChange('category_id', v)}>
                        <SelectTrigger className="h-9 shadow-sm bg-white">
                          <SelectValue placeholder="Select...">{categories.find(c => c.id === formData.category_id)?.name || 'Select...'}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Status</Label>
                      <Select required value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)}>
                        <SelectTrigger className="h-9 shadow-sm bg-white"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ใช้งาน">ใช้งาน (Active)</SelectItem>
                          <SelectItem value="ส่งซ่อม">ส่งซ่อม (Repair)</SelectItem>
                          <SelectItem value="สำรอง">สำรอง (Spare)</SelectItem>
                          <SelectItem value="สูญหาย">สูญหาย (Lost)</SelectItem>
                          <SelectItem value="แทงจำหน่าย">แทงจำหน่าย (Disposed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Department</Label>
                    <Select value={formData.department_id || ''} onValueChange={(v) => handleSelectChange('department_id', v)}>
                      <SelectTrigger className="h-9 shadow-sm bg-white">
                        <SelectValue placeholder="Select...">{departments.find(d => d.id === formData.department_id)?.name || 'Select...'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Assignment & Handover */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Assignment & Handover</h3>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Location / Room</Label>
                    <Input name="location" value={formData.location || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Assigned User</Label>
                      <Input name="assigned_user" value={formData.assigned_user || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Email</Label>
                      <Input name="assigned_email" value={formData.assigned_email || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Position</Label>
                      <Input name="user_position" value={formData.user_position || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Previous User</Label>
                      <Input name="previous_user" value={formData.previous_user || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Handover Signer</Label>
                      <Input name="signer_name" value={formData.signer_name || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Signer Position</Label>
                      <Input name="signer_position" value={formData.signer_position || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-semibold text-gray-700 flex justify-between">
                      <span>Signature</span>
                      <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] text-blue-600 hover:underline">Clear Canvas</button>
                    </Label>
                    <div className="border border-input rounded-md bg-white overflow-hidden shadow-sm">
                      {formData.signature_url && !formData.new_signature ? (
                        <div className="relative h-24 bg-slate-50 flex items-center justify-center">
                          <img src={formData.signature_url} alt="Signature" className="h-full w-auto max-w-full object-contain" />
                          <button type="button" onClick={() => setFormData({...formData, signature_url: null, new_signature: true})} className="absolute top-1 right-1 bg-red-100 p-1.5 rounded-full text-red-600 hover:bg-red-200 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="h-24 bg-slate-50 relative cursor-crosshair">
                          <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: "w-full h-full" }} />
                          <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground pointer-events-none">Draw here</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hardware */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Hardware Specs</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Brand</Label>
                      <Input name="brand" value={formData.brand || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Model</Label>
                      <Input name="model" value={formData.model || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">CPU</Label>
                      <Input name="cpu" value={formData.cpu || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">RAM</Label>
                      <Input name="ram" value={formData.ram || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Storage</Label>
                      <Input name="storage" value={formData.storage || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">GPU</Label>
                      <Input name="gpu" value={formData.gpu || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Display</Label>
                    <Input name="display" value={formData.display || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                  </div>
                </div>

                {/* Software & Licenses */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Software & Licenses</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Operating System</Label>
                      <Input name="os" value={formData.os || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Windows Version</Label>
                      <Input name="windows_version" value={formData.windows_version || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">OS Product Key</Label>
                    <Input name="os_key" value={formData.os_key || ''} onChange={handleChange} className="h-9 shadow-sm bg-white font-mono text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Office Version</Label>
                      <Input name="office_version" value={formData.office_version || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Office License</Label>
                      <Input name="office_license" value={formData.office_license || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                </div>

                {/* Network & Security */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Network & Security</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">IP Address</Label>
                      <Input name="ip_address" value={formData.ip_address || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">MAC Address</Label>
                      <Input name="mac_address" value={formData.mac_address || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Password / PIN</Label>
                      <Input name="password" value={formData.password || ''} onChange={handleChange} className="h-9 shadow-sm bg-white font-mono text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">NAS User</Label>
                      <Input name="nas_user" value={formData.nas_user || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                </div>

                {/* Purchase */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Purchase Details</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Purchase Date</Label>
                      <Input type="date" name="purchase_date" value={formData.purchase_date || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Warranty Expiry</Label>
                      <Input type="date" name="warranty_expiry" value={formData.warranty_expiry || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Supplier</Label>
                    <Input name="supplier" value={formData.supplier || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Price (THB)</Label>
                      <Input type="number" step="0.01" name="price" value={formData.price || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">PO/PR Number</Label>
                      <Input name="po_number" value={formData.po_number || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" />
                    </div>
                  </div>
                </div>

                {/* Documents & Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Documents & Notes</h3>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Notes</Label>
                    <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2}
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Reference Document URL</Label>
                    <Input type="url" name="reference_url" value={formData.reference_url || ''} onChange={handleChange} className="h-9 shadow-sm bg-white" placeholder="https://" />
                  </div>
                </div>
              </div>

            </form>
          )}

          {/* Timeline in Edit Mode */}
          {assetId && !isLoadingAsset && (
            <div className="mt-10 space-y-4 pt-6 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History & Timeline</h3>
              <AssetTimeline assetId={assetId} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 mt-auto flex gap-3 transition-colors shrink-0">
          <Button type="button" variant="outline" onClick={onClose} className="w-32">Cancel</Button>
          <Button type="submit" form="asset-form" disabled={saveMutation.isPending || uploading} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            {saveMutation.isPending ? 'Saving...' : 'Save Asset'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

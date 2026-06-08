'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AssetModal({ isOpen, onClose, assetId }: { isOpen: boolean; onClose: () => void; assetId?: string }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchLookups();
      if (assetId) {
        fetchAssetData(assetId);
      } else {
        setFormData({ status: 'ใช้งาน' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, assetId]);

  async function fetchLookups() {
    try {
      const [deptRes, catRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name')
      ]);
      setDepartments(deptRes.data || []);
      setCategories(catRes.data || []);
    } catch (error) {
      console.error('Error fetching lookups', error);
    }
  }

  async function fetchAssetData(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('assets').select('*').eq('id', id).single();
      if (error) throw error;
      setFormData(data);
    } catch (err: any) {
      toast.error('Failed to load asset: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('asset-images').getPublicUrl(filePath);
      
      setFormData({ ...formData, thumbnail_url: data.publicUrl });
      toast.success('Image uploaded successfully');
    } catch (err: any) {
      toast.error('Error uploading image: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanData = { ...formData };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '') cleanData[key] = null;
      });

      if (assetId) {
        const { error } = await supabase.from('assets').update(cleanData).eq('id', assetId);
        if (error) throw error;
        toast.success('Asset updated successfully');
      } else {
        const { error } = await supabase.from('assets').insert([cleanData]);
        if (error) throw error;
        toast.success('Asset created successfully');
      }
      onClose();
    } catch (err: any) {
      toast.error('Error saving asset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{assetId ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
        </DialogHeader>

        {loading && !assetId ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8 mt-4">
            {/* Image Upload */}
            <div className="flex flex-col items-center p-6 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/25">
              {formData.thumbnail_url ? (
                <div className="relative group">
                  <img src={formData.thumbnail_url} alt="Preview" className="h-40 w-40 object-cover rounded-xl shadow-sm" />
                  <Button 
                    type="button" size="icon" variant="destructive"
                    onClick={() => setFormData({...formData, thumbnail_url: null})}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-background rounded-full flex items-center justify-center border mb-3 shadow-sm text-primary">
                    <Camera size={28} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Upload asset photo</p>
                  <Label className="cursor-pointer bg-background px-4 py-2 border rounded-md shadow-sm text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors inline-flex items-center gap-2">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Choose Image'}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  </Label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b">
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>
              
              <div className="space-y-2">
                <Label>Asset Name *</Label>
                <Input required name="name" value={formData.name || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Asset Code *</Label>
                <Input required name="asset_code" value={formData.asset_code || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input name="serial_number" value={formData.serial_number || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category_id || ''} onValueChange={(v) => handleSelectChange('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Category...">{categories.find(c => c.id === formData.category_id)?.name || 'Select Category...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formData.department_id || ''} onValueChange={(v) => handleSelectChange('department_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Department...">{departments.find(d => d.id === formData.department_id)?.name || 'Select Department...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select required value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ใช้งาน">ใช้งาน (Active)</SelectItem>
                    <SelectItem value="ส่งซ่อม">ส่งซ่อม (Repairing)</SelectItem>
                    <SelectItem value="สำรอง">สำรอง (Spare)</SelectItem>
                    <SelectItem value="สูญหาย">สูญหาย (Lost)</SelectItem>
                    <SelectItem value="แทงจำหน่าย">แทงจำหน่าย (Disposed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location & Assignment */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b mt-4">
                <h3 className="text-lg font-semibold">Assignment & Location</h3>
              </div>
              
              <div className="space-y-2">
                <Label>Location / Room</Label>
                <Input name="location" value={formData.location || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Assigned User</Label>
                <Input name="assigned_user" value={formData.assigned_user || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Input name="user_position" value={formData.user_position || ''} onChange={handleChange} />
              </div>

              {/* Hardware Specs */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b mt-4">
                <h3 className="text-lg font-semibold">Hardware Specifications</h3>
              </div>
              
              <div className="space-y-2">
                <Label>Brand / Model</Label>
                <Input name="model" value={formData.model || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>CPU</Label>
                <Input name="cpu" value={formData.cpu || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>RAM</Label>
                <Input name="ram" value={formData.ram || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Storage (HDD/SSD)</Label>
                <Input name="storage" value={formData.storage || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input name="ip_address" value={formData.ip_address || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>MAC Address</Label>
                <Input name="mac_address" value={formData.mac_address || ''} onChange={handleChange} />
              </div>

              {/* Purchase Info */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b mt-4">
                <h3 className="text-lg font-semibold">Purchase & Warranty</h3>
              </div>
              
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input type="date" name="purchase_date" value={formData.purchase_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expiry</Label>
                <Input type="date" name="warranty_expiry" value={formData.warranty_expiry || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input name="supplier" value={formData.supplier || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Price (THB)</Label>
                <Input type="number" step="0.01" name="price" value={formData.price || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>PO/PR Number</Label>
                <Input name="po_number" value={formData.po_number || ''} onChange={handleChange} />
              </div>
              
              {/* Notes */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4 space-y-2">
                <Label>Notes / Remarks</Label>
                <textarea 
                  name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading || uploading}>
                {loading ? 'Saving...' : 'Save Asset'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LicenseModal({ isOpen, onClose, recordId }: { isOpen: boolean; onClose: () => void; recordId?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ['assets_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_code').order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const { data: recordData, isLoading: isLoadingRecord } = useQuery({
    queryKey: ['license', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data, error } = await supabase.from('licenses').select('*').eq('id', recordId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!recordId
  });

  useEffect(() => {
    if (isOpen) {
      if (recordId && recordData) {
        setFormData(recordData);
      } else if (!recordId) {
        setFormData({ status: 'active', start_date: new Date().toISOString().split('T')[0], type: 'Software' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      // "none" comes from SelectItem when unassigned
      if (payload.asset_id === 'none') {
        payload.asset_id = null;
      }
      if (recordId) {
        const { error } = await supabase.from('licenses').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('licenses').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(recordId ? 'License updated' : 'License added successfully');
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving license: ' + err.message)
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };
    saveMutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{recordId ? 'Edit License' : 'Add Software License'}</DialogTitle>
        </DialogHeader>

        {isLoadingRecord ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            <div className="space-y-2">
              <Label>Asset (ผูกกับอุปกรณ์)</Label>
              <Select value={formData.asset_id || ''} onValueChange={(v) => handleSelectChange('asset_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select an Asset...">{assets.find(a => a.id === formData.asset_id) ? `[${assets.find(a => a.id === formData.asset_id)?.asset_code}] ${assets.find(a => a.id === formData.asset_id)?.name}` : 'Select an Asset...'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- ไม่ระบุ (No Asset) --</SelectItem>
                  {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Software Name (ชื่อซอฟต์แวร์) *</Label>
                <Input required name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g. MS Office 2021" />
              </div>

              <div className="space-y-2">
                <Label>License Key</Label>
                <Input name="license_key" value={formData.license_key || ''} onChange={handleChange} className="font-mono text-sm" />
              </div>
              
              <div className="space-y-2">
                <Label>Assigned Date (วันที่ติดตั้ง/เริ่มใช้)</Label>
                <Input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Expiration Date (วันหมดอายุ)</Label>
                <Input type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Select value={formData.status || 'active'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">ใช้งานอยู่ (Active)</SelectItem>
                    <SelectItem value="expired">หมดอายุ (Expired)</SelectItem>
                    <SelectItem value="cancelled">ยกเลิก (Cancelled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Vendor (ผู้ขาย/เจ้าของ)</Label>
                <Input name="vendor" value={formData.vendor || ''} onChange={handleChange} />
              </div>
              
              <div className="space-y-2">
                <Label>Assigned To (ผู้ถือครอง)</Label>
                <Input name="assigned_to" value={formData.assigned_to || ''} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Notes (รายละเอียดเพิ่มเติม)</Label>
              <textarea 
                name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save License'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

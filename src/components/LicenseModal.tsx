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
        setFormData({ 
          status: 'active', 
          start_date: new Date().toISOString().split('T')[0], 
          category: 'Productivity',
          license_type: 'Subscription',
          assignment_status: 'Assigned',
          total_seats: 1,
          assigned_seats: 1,
          available_seats: 0
        });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
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
      <DialogContent className="max-w-full md:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{recordId ? 'Edit License' : 'Add Software License'}</DialogTitle>
        </DialogHeader>

        {isLoadingRecord ? (
          <div className="space-y-4 py-8 px-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-muted/50 rounded-full animate-pulse"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted/50 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-muted/50 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            {/* Core Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Software Name (ชื่อซอฟต์แวร์) *</Label>
                <Input required name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g. MS Office 2021" />
              </div>
              <div className="space-y-2">
                <Label>License Key / Contract Ref</Label>
                <Input name="license_key" value={formData.license_key || ''} onChange={handleChange} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input name="vendor" value={formData.vendor || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" value={formData.category || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>License Type</Label>
                <Input name="license_type" value={formData.license_type || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>License Status</Label>
                <Select value={formData.status || 'active'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates & Cost */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Assigned Date</Label>
                <Input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Renewal Type</Label>
                <Input name="renewal_type" value={formData.renewal_type || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Input name="billing_cycle" value={formData.billing_cycle || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input type="number" step="0.01" name="unit_cost" value={formData.unit_cost || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Annual Cost</Label>
                <Input type="number" step="0.01" name="annual_cost" value={formData.annual_cost || ''} onChange={handleChange} />
              </div>
            </div>

            {/* Assignment & Seats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Total Seats</Label>
                <Input type="number" name="total_seats" value={formData.total_seats || 1} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Assigned Seats</Label>
                <Input type="number" name="assigned_seats" value={formData.assigned_seats || 1} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Available Seats</Label>
                <Input type="number" name="available_seats" value={formData.available_seats || 0} onChange={handleChange} />
              </div>
              
              <div className="space-y-2 md:col-span-3">
                <Label>Asset (ผูกกับอุปกรณ์)</Label>
                <Select value={formData.asset_id || ''} onValueChange={(v) => handleSelectChange('asset_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select an Asset..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- ไม่ระบุ (No Asset) --</SelectItem>
                    {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assigned To / User Name</Label>
                <Input name="assigned_to" value={formData.assigned_to || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Account / Email</Label>
                <Input name="account_email" value={formData.account_email || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Device / Hostname</Label>
                <Input name="device_hostname" value={formData.device_hostname || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Assignment Status</Label>
                <Select value={formData.assignment_status || 'Assigned'} onValueChange={(v) => handleSelectChange('assignment_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input name="owner" value={formData.owner || ''} onChange={handleChange} />
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>License Notes</Label>
                <textarea 
                  name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Assignment Notes</Label>
                <textarea 
                  name="assignment_notes" value={formData.assignment_notes || ''} onChange={handleChange} rows={3} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
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

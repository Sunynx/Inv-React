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

export default function CheckoutModal({ isOpen, onClose, recordId }: { isOpen: boolean; onClose: () => void; recordId?: string }) {
  const [formData, setFormData] = useState<any>({});
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ['available_assets'],
    queryFn: async () => {
      // Fetch active/spare assets that aren't currently checked out
      const { data } = await supabase.from('assets')
        .select('id, name, asset_code')
        .in('status', ['ใช้งาน', 'สำรอง']);
      return data || [];
    },
    enabled: isOpen
  });

  const { data: recordData, isLoading } = useQuery({
    queryKey: ['checkout_record', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data, error } = await supabase.from('asset_checkouts').select('*').eq('id', recordId).single();
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
        setFormData({ status: 'checked_out' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (recordId) {
        const { error } = await supabase.from('asset_checkouts').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('asset_checkouts').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(recordId ? 'Record updated' : 'Checkout recorded');
      queryClient.invalidateQueries({ queryKey: ['asset_checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving: ' + err.message)
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{recordId ? 'Edit Checkout' : 'New Checkout'}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-8 px-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-muted/50 rounded-full animate-pulse"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted/50 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-muted/50 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <div className="h-4 bg-muted/50 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-muted/50 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-muted/50 rounded w-4/5 animate-pulse"></div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            <div className="space-y-2">
              <Label>Asset (อุปกรณ์)</Label>
              <Select value={formData.asset_id || ''} onValueChange={(v) => handleSelectChange('asset_id', v)} disabled={!!recordId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Asset...">
                    {assets.find(a => a.id === formData.asset_id)?.name || formData.asset_id || 'Select Asset...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Checked Out To (ผู้ยืม)</Label>
                <Input required name="checked_out_to" value={formData.checked_out_to || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Department (แผนก)</Label>
                <Input name="department" value={formData.department || ''} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Return Date</Label>
                <Input type="date" required name="expected_return_date" value={formData.expected_return_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || 'checked_out'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checked_out">ยืม (Borrowed)</SelectItem>
                    <SelectItem value="returned">คืนแล้ว (Returned)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (หมายเหตุ)</Label>
              <textarea 
                name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

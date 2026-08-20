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

export default function MaintenanceModal({ isOpen, onClose, recordId, defaultDate }: { isOpen: boolean; onClose: () => void; recordId?: string; defaultDate?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [autoScheduleNext, setAutoScheduleNext] = useState(true);
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
    queryKey: ['maintenance_schedule', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data, error } = await supabase.from('maintenance_schedules').select('*').eq('id', recordId).single();
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
        setFormData({ status: 'pending', frequency: 'monthly', next_due_at: defaultDate || '' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (recordId) {
        const { error } = await supabase.from('maintenance_schedules').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maintenance_schedules').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(recordId ? 'Maintenance record updated successfully' : 'Maintenance record created successfully');
      
      // Auto-schedule logic
      if (autoScheduleNext && variables.status === 'completed' && variables.frequency) {
        let d = new Date(variables.next_due_at || new Date());
        if (isNaN(d.getTime())) d = new Date();
        switch(variables.frequency) {
          case 'daily': d.setDate(d.getDate() + 1); break;
          case 'weekly': d.setDate(d.getDate() + 7); break;
          case 'monthly': d.setMonth(d.getMonth() + 1); break;
          case 'quarterly': d.setMonth(d.getMonth() + 3); break;
          case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
        }
        const nextDateStr = d.toISOString().split('T')[0];
        
        const nextPayload = {
          ...variables,
          status: 'pending',
          next_due_at: nextDateStr,
          cost: null,
          description: '',
          performed_by: null
        };
        delete nextPayload.id;
        delete nextPayload.created_at;
        
        supabase.from('maintenance_schedules').insert([nextPayload]).then(({error}) => {
          if (!error) {
            toast.success(`Next schedule auto-created for ${nextDateStr}`);
            queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
          }
        });
      }

      queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving record: ' + err.message)
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
          <DialogTitle className="text-2xl">{recordId ? 'Edit Maintenance Record' : 'Schedule Maintenance (PM)'}</DialogTitle>
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
              <Select value={formData.asset_id || ''} onValueChange={(v) => handleSelectChange('asset_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select an Asset...">{assets.find(a => a.id === formData.asset_id) ? `[${assets.find(a => a.id === formData.asset_id)?.asset_code}] ${assets.find(a => a.id === formData.asset_id)?.name}` : 'Select an Asset...'}</SelectValue></SelectTrigger>
                <SelectContent>
                  {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title (หัวข้อ/ประเภท) *</Label>
                <Input required name="title" value={formData.title || ''} onChange={handleChange} placeholder="e.g. Preventive Maintenance" />
              </div>

              <div className="space-y-2">
                <Label>Frequency (ความถี่)</Label>
                <Select value={formData.frequency || 'monthly'} onValueChange={(v) => handleSelectChange('frequency', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Frequency...">{({'daily':'Daily','weekly':'Weekly','monthly':'Monthly','quarterly':'Quarterly','yearly':'Yearly'} as Record<string,string>)[formData.frequency] || 'Select Frequency...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scheduled Date (วันที่กำหนด)</Label>
                <Input type="date" required name="next_due_at" value={formData.next_due_at || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Select value={formData.status || 'pending'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status...">{({'pending':'รอคิว (Pending)','completed':'เสร็จสิ้น (Completed)','cancelled':'ยกเลิก (Cancelled)'} as Record<string,string>)[formData.status] || 'Select Status...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอคิว (Pending)</SelectItem>
                    <SelectItem value="completed">เสร็จสิ้น (Completed)</SelectItem>
                    <SelectItem value="cancelled">ยกเลิก (Cancelled)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.status === 'completed' && formData.frequency && (
                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="autoSchedule" 
                      checked={autoScheduleNext}
                      onChange={e => setAutoScheduleNext(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="autoSchedule" className="text-xs font-medium text-blue-700 cursor-pointer">
                      Auto-create next schedule ({formData.frequency})
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Cost (ค่าใช้จ่าย)</Label>
                <Input type="number" name="cost" value={formData.cost || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Performed By (ผู้ดำเนินการ)</Label>
                <Input name="performed_by" value={formData.performed_by || ''} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Description (รายละเอียด/หมายเหตุ)</Label>
              <textarea 
                name="description" value={formData.description || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

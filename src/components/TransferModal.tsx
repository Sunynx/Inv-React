'use client';
import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TransferModal({ isOpen, onClose, recordId }: { isOpen: boolean; onClose: () => void; recordId?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const sigCanvas = useRef<SignatureCanvas>(null);
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ['assets_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_code, location').order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const { data: recordData, isLoading: isLoadingRecord } = useQuery({
    queryKey: ['asset_transfer', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data, error } = await supabase.from('asset_transfers').select('*').eq('id', recordId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!recordId
  });

  const { data: existingSignature } = useQuery({
    queryKey: ['transfer_signature', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data } = await supabase.from('signatures').select('*').eq('reference_id', recordId).eq('reference_type', 'asset_transfers').maybeSingle();
      return data;
    },
    enabled: isOpen && !!recordId
  });

  useEffect(() => {
    if (isOpen) {
      if (recordId && recordData) {
        setFormData(recordData);
      } else if (!recordId) {
        setFormData({ transfer_date: new Date().toISOString().split('T')[0], status: 'รอดำเนินการ' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      let targetId = recordId;

      if (recordId) {
        const { error } = await supabase.from('asset_transfers').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('asset_transfers').insert([payload]).select().single();
        if (error) throw error;
        targetId = data?.id;
      }

      if (payload.asset_id && payload.to_location && payload.status === 'เสร็จสมบูรณ์') {
        await supabase.from('assets').update({ location: payload.to_location, assigned_user: payload.signed_by || payload.authorized_by }).eq('id', payload.asset_id);
      }

      if (payload.status === 'เสร็จสมบูรณ์' && sigCanvas.current && !sigCanvas.current.isEmpty() && targetId) {
        const sigData = sigCanvas.current.toDataURL();
        await supabase.from('signatures').insert([{
          reference_type: 'asset_transfers',
          reference_id: targetId,
          signature_data: sigData,
          signed_by: payload.signed_by || payload.authorized_by || 'Unknown'
        }]);
      }
    },
    onSuccess: () => {
      toast.success(recordId ? 'Transfer record updated' : 'Transfer recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['asset_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] }); // Refresh assets if location changed
      onClose();
    },
    onError: (err: any) => toast.error('Error saving transfer: ' + err.message)
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
    if (name === 'asset_id') {
      const selected = assets.find(a => a.id === value);
      if (selected && !formData.from_location) {
        setFormData((prev: any) => ({ ...prev, from_location: selected.location || '' }));
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{recordId ? 'Edit Transfer' : 'Record Asset Transfer'}</DialogTitle>
        </DialogHeader>

        {isLoadingRecord ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
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
                <Label>From Location (จากสถานที่)</Label>
                <Input required name="from_location" value={formData.from_location || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>To Location (ถึงสถานที่)</Label>
                <Input required name="to_location" value={formData.to_location || ''} onChange={handleChange} />
              </div>
              
              <div className="space-y-2">
                <Label>Transfer Date (วันที่โอนย้าย)</Label>
                <Input type="date" required name="transfer_date" value={formData.transfer_date || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Authorized By (ผู้อนุมัติ/ผู้ดำเนินการ)</Label>
                <Input name="authorized_by" value={formData.authorized_by || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Select value={formData.status || 'รอดำเนินการ'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="รอดำเนินการ">รอดำเนินการ (Pending)</SelectItem>
                    <SelectItem value="อนุมัติแล้ว">อนุมัติแล้ว (Approved)</SelectItem>
                    <SelectItem value="เสร็จสมบูรณ์">เสร็จสมบูรณ์ (Completed)</SelectItem>
                    <SelectItem value="ปฏิเสธ">ปฏิเสธ (Rejected)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Reason / Notes (เหตุผลการโอนย้าย)</Label>
              <textarea 
                required
                name="reason" value={formData.reason || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {formData.status === 'เสร็จสมบูรณ์' && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-blue-600 font-semibold">Digital Signature (ลายเซ็นผู้รับมอบอุปกรณ์)</Label>
                
                {existingSignature ? (
                  <div className="border rounded-md bg-muted/30 p-4 flex flex-col items-center">
                    <img src={existingSignature.signature_data} alt="Signature" className="h-24 object-contain" />
                    <p className="text-xs text-muted-foreground mt-2">Signed by: {existingSignature.signed_by}</p>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-md bg-white border-blue-200">
                      <SignatureCanvas 
                        ref={sigCanvas}
                        canvasProps={{ className: 'w-full h-32 rounded-md', style: { touchAction: 'none' } }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => sigCanvas.current?.clear()} className="text-xs">
                        Clear Signature
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Signed By (ชื่อผู้เซ็นรับ)</Label>
                      <Input name="signed_by" value={formData.signed_by || ''} onChange={handleChange} required />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save Transfer'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

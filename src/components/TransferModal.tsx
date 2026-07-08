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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TransferModal({ isOpen, onClose, recordId }: { isOpen: boolean; onClose: () => void; recordId?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [assetComboOpen, setAssetComboOpen] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ['assets_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_code, location, assigned_user, department_id').order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
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

  useEffect(() => {
    if (isOpen) {
      if (recordId && recordData) {
        setFormData(recordData);
      } else if (!recordId) {
        setFormData({ transfer_date: new Date().toISOString().split('T')[0] });
        setTimeout(() => sigCanvas.current?.clear(), 50);
      }
    } else {
      setFormData({});
      setTimeout(() => sigCanvas.current?.clear(), 50);
    }
  }, [isOpen, recordId, recordData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const sigUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        payload.signature_url = sigUrl;

        // Automatically update the main asset's signature to the new owner's signature
        if (payload.asset_id) {
          await supabase.from('signatures').delete().eq('asset_id', payload.asset_id);
          const { error: sigError } = await supabase.from('signatures').insert([{ 
            asset_id: payload.asset_id, 
            signature_url: sigUrl 
          }]);
          
          if (sigError) {
            throw sigError;
          }
        }
      }

      let targetId = recordId;

      if (recordId) {
        const { error } = await supabase.from('asset_transfers').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('asset_transfers').insert([payload]).select().single();
        if (error) throw error;
        targetId = data?.id;
      }

      if (payload.asset_id) {
        // Update asset location, assigned_user, previous_user, and department_id
        const updateData: any = {};
        if (payload.to_location) updateData.location = payload.to_location;
        if (payload.to_user) {
          updateData.assigned_user = payload.to_user;
          updateData.previous_user = payload.from_user;
        }
        if (payload.to_department_id) {
          updateData.department_id = payload.to_department_id;
        }
        await supabase.from('assets').update(updateData).eq('id', payload.asset_id);
      }
    },
    onSuccess: () => {
      toast.success(recordId ? 'Transfer record updated' : 'Transfer recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['asset_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
      queryClient.invalidateQueries({ queryKey: ['asset_timeline'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving transfer: ' + err.message)
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };
    // Handle empty department select
    if (payload.from_department_id === 'none') payload.from_department_id = null;
    if (payload.to_department_id === 'none') payload.to_department_id = null;
    
    saveMutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    if (name === 'asset_id') {
      const selected = assets.find((a: any) => a.id === value);
      if (selected) {
        setFormData((prev: any) => ({ 
          ...prev, 
          asset_id: value,
          from_location: selected.location || '',
          from_user: selected.assigned_user || '',
          from_department_id: selected.department_id || ''
        }));
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{recordId ? 'Edit Transfer' : 'Record Asset Transfer'}</DialogTitle>
        </DialogHeader>

        {isLoadingRecord ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            <div className="space-y-2 flex flex-col">
              <Label>Asset (อุปกรณ์)</Label>
              <Popover open={assetComboOpen} onOpenChange={setAssetComboOpen}>
                <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-normal" />}>
                  {formData.asset_id
                    ? `[${assets.find((a:any) => a.id === formData.asset_id)?.asset_code}] ${assets.find((a:any) => a.id === formData.asset_id)?.name}`
                    : "Select an Asset..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search asset..." />
                    <CommandList>
                      <CommandEmpty>No asset found.</CommandEmpty>
                      <CommandGroup>
                        {assets.map((a:any) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.asset_code} ${a.name}`}
                            onSelect={() => {
                              handleSelectChange('asset_id', a.id);
                              setAssetComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.asset_id === a.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            [{a.asset_code}] {a.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-2">
                <Label>From User (ผู้ใช้เดิม)</Label>
                <Input name="from_user" value={formData.from_user || ''} onChange={handleChange} placeholder="e.g. Somchai" />
              </div>
              <div className="space-y-2">
                <Label>To User (ผู้ใช้ใหม่)</Label>
                <Input name="to_user" value={formData.to_user || ''} onChange={handleChange} placeholder="e.g. Somsri" />
              </div>

              <div className="space-y-2">
                <Label>From Department (แผนกเดิม)</Label>
                <Select value={formData.from_department_id || 'none'} onValueChange={(v) => handleSelectChange('from_department_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Dept">
                      {formData.from_department_id && formData.from_department_id !== 'none' 
                        ? departments.find((d:any) => d.id === formData.from_department_id)?.name || formData.from_department_id 
                        : "Select Dept"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {departments.map((d:any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Department (แผนกใหม่)</Label>
                <Select value={formData.to_department_id || 'none'} onValueChange={(v) => handleSelectChange('to_department_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Dept">
                      {formData.to_department_id && formData.to_department_id !== 'none' 
                        ? departments.find((d:any) => d.id === formData.to_department_id)?.name || formData.to_department_id 
                        : "Select Dept"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {departments.map((d:any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Location (จากสถานที่)</Label>
                <Input name="from_location" value={formData.from_location || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>To Location (ถึงสถานที่)</Label>
                <Input name="to_location" value={formData.to_location || ''} onChange={handleChange} />
              </div>
              
              <div className="space-y-2">
                <Label>Transfer Date (วันที่โอนย้าย)</Label>
                <Input type="date" required name="transfer_date" value={formData.transfer_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Transferred By (ผู้ดำเนินการ)</Label>
                <Input name="transferred_by" value={formData.transferred_by || ''} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Reason / Notes (เหตุผลการโอนย้าย)</Label>
              <textarea 
                required
                name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-blue-600 font-semibold dark:text-blue-400">Digital Signature (ลายเซ็นผู้รับมอบอุปกรณ์)</Label>
              
              {formData.signature_url ? (
                <div className="border rounded-md bg-muted/30 p-4 flex flex-col items-center relative">
                  <img src={formData.signature_url} alt="Signature" className="h-24 object-contain dark:invert" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, signature_url: null})} className="absolute top-2 right-2 text-xs">
                    Clear
                  </Button>
                </div>
              ) : (
                <>
                  <div className="border rounded-md bg-white border-blue-200 overflow-hidden">
                    <SignatureCanvas 
                      ref={sigCanvas}
                      canvasProps={{ className: 'w-full h-32', style: { touchAction: 'none' } }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => sigCanvas.current?.clear()} className="text-xs">
                      Clear Signature
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border mt-8">
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

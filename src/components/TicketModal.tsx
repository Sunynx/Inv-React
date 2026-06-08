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

export default function TicketModal({ isOpen, onClose, ticketId }: { isOpen: boolean; onClose: () => void; ticketId?: string }) {
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

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock_items_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('stock_items').select('id, name, quantity, unit').gt('quantity', 0).order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [partQty, setPartQty] = useState<number>(1);

  const { data: ticketData, isLoading: isLoadingTicket } = useQuery({
    queryKey: ['repair_ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const { data, error } = await supabase.from('repair_tickets').select('*').eq('id', ticketId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!ticketId
  });

  useEffect(() => {
    if (isOpen) {
      if (ticketId && ticketData) {
        setFormData(ticketData);
      } else if (!ticketId) {
        setFormData({ status: 'แจ้งซ่อม', priority: 'ปานกลาง' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, ticketId, ticketData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.status === 'ซ่อมสำเร็จ' || payload.status === 'ยกเลิก') {
        if (!payload.resolved_at) payload.resolved_at = new Date().toISOString();
      } else {
        payload.resolved_at = null;
      }

      let currentTicketId = ticketId;

      if (ticketId) {
        const { error } = await supabase.from('repair_tickets').update(payload).eq('id', ticketId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('repair_tickets').insert([payload]).select().single();
        if (error) throw error;
        if (data) currentTicketId = data.id;
      }

      if (selectedPartId && partQty > 0 && currentTicketId) {
        const { data: currentStock } = await supabase.from('stock_items').select('quantity').eq('id', selectedPartId).single();
        if (currentStock) {
          const newQty = currentStock.quantity - partQty;
          await supabase.from('stock_items').update({ quantity: newQty }).eq('id', selectedPartId);
          await supabase.from('stock_transactions').insert([{
            stock_item_id: selectedPartId,
            type: 'distribute',
            quantity: partQty,
            reference_doc: `Ticket ID: ${currentTicketId}`,
            recipient: payload.assigned_to || payload.reported_by || 'Ticket System',
            notes: 'Auto-deducted from repair ticket'
          }]);
        }
      }
    },
    onSuccess: () => {
      toast.success(ticketId ? 'Ticket updated successfully' : 'Ticket created successfully');
      setSelectedPartId('');
      setPartQty(1);
      queryClient.invalidateQueries({ queryKey: ['repair_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving ticket: ' + err.message)
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
      <DialogContent className="sm:max-w-[500px] bg-background text-foreground transition-colors duration-300">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{ticketId ? 'Edit Repair Ticket' : 'Create Repair Ticket'}</DialogTitle>
        </DialogHeader>

        {isLoadingTicket ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            <div className="space-y-2">
              <Label>Asset (อุปกรณ์ที่เสีย)</Label>
              <Select value={formData.asset_id || ''} onValueChange={(v) => handleSelectChange('asset_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select an Asset...">{assets.find(a => a.id === formData.asset_id) ? `[${assets.find(a => a.id === formData.asset_id)?.asset_code}] ${assets.find(a => a.id === formData.asset_id)?.name}` : 'Select an Asset...'}</SelectValue></SelectTrigger>
                <SelectContent>
                  {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Issue Description (อาการที่เสีย) *</Label>
              <textarea 
                required
                name="issue_description" value={formData.issue_description || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority (ความสำคัญ)</Label>
                <Select value={formData.priority || 'ปานกลาง'} onValueChange={(v) => handleSelectChange('priority', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Priority..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ต่ำ">ต่ำ (Low)</SelectItem>
                    <SelectItem value="ปานกลาง">ปานกลาง (Medium)</SelectItem>
                    <SelectItem value="สูง">สูง (High)</SelectItem>
                    <SelectItem value="ด่วนมาก">ด่วนมาก (Critical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Select value={formData.status || 'รอการตรวจสอบ'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="รอการตรวจสอบ">รอการตรวจสอบ (Pending)</SelectItem>
                    <SelectItem value="กำลังดำเนินการ">กำลังดำเนินการ (In Progress)</SelectItem>
                    <SelectItem value="รออะไหล่">รออะไหล่ (Waiting for parts)</SelectItem>
                    <SelectItem value="ส่งซ่อมภายนอก">ส่งซ่อมภายนอก (External Repair)</SelectItem>
                    <SelectItem value="ซ่อมสำเร็จ">ซ่อมสำเร็จ (Resolved)</SelectItem>
                    <SelectItem value="ยกเลิก">ยกเลิก (Cancelled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reported By (ผู้แจ้งซ่อม)</Label>
                <Input name="reported_by" value={formData.reported_by || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Assigned To (ช่าง/ผู้รับผิดชอบ)</Label>
                <Input name="assigned_to" value={formData.assigned_to || ''} onChange={handleChange} />
              </div>
            </div>

            {(formData.status === 'ซ่อมสำเร็จ' || formData.status === 'ยกเลิก' || ticketId) && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Resolution Notes (รายละเอียดการแก้ไข)</Label>
                <textarea 
                  name="resolution_notes" value={formData.resolution_notes || ''} onChange={handleChange} rows={3} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-blue-600 font-semibold">Use Parts from Stock (เบิกอะไหล่)</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger><SelectValue placeholder="Select Part to Deduct..." /></SelectTrigger>
                    <SelectContent>
                      {stockItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit} in stock)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedPartId && (
                  <div className="w-24">
                    <Input type="number" min="1" max={stockItems.find(i => i.id === selectedPartId)?.quantity || 1} value={partQty} onChange={(e) => setPartQty(Number(e.target.value))} />
                  </div>
                )}
              </div>
              {selectedPartId && <p className="text-xs text-muted-foreground">This will deduct stock and log a transaction automatically upon save.</p>}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save Ticket'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { logAudit, formatAuditDetails } from '@/lib/auditLog';

const ticketSchema = z.object({
  asset_id: z.string().nullable().optional(),
  title: z.string().min(1, 'กรุณาระบุหัวข้อการแจ้งซ่อม'),
  description: z.string().nullable().optional(),
  priority: z.string().min(1),
  status: z.string().min(1),
  cost: z.coerce.number().nullable().optional(),
});
type TicketFormValues = z.infer<typeof ticketSchema>;

export default function TicketModal({ isOpen, onClose, ticketId }: { isOpen: boolean; onClose: () => void; ticketId?: string }) {
  const queryClient = useQueryClient();

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { status: 'เปิด', priority: 'ปกติ' }
  });

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
  const [comments, setComments] = useState<{author: string, text: string, time: string}[]>([]);
  const [newComment, setNewComment] = useState('');

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
        let desc = ticketData.description || '';
        let loadedComments: any[] = [];
        if (desc.includes('<!--COMMENTS-->')) {
          const parts = desc.split('<!--COMMENTS-->');
          desc = parts[0].trim();
          try {
            loadedComments = JSON.parse(parts[1]);
          } catch(e) {}
        }
        
        form.reset({
          ...ticketData,
          description: desc,
          cost: ticketData.cost ? Number(ticketData.cost) : null
        });
        setComments(loadedComments);
      } else if (!ticketId) {
        form.reset({ status: 'เปิด', priority: 'ปกติ', description: '' });
        setComments([]);
      }
      setSelectedPartId('');
      setPartQty(1);
      setNewComment('');
    }
  }, [isOpen, ticketId, ticketData, form]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { keepOpen, ...dbPayload } = payload;
      const validStatuses = ['เปิด', 'กำลังดำเนินการ', 'รอะไหล่', 'เสร็จสิ้น', 'ยกเลิก'];
      if (!validStatuses.includes(dbPayload.status)) dbPayload.status = 'เปิด';
      
      const validPriorities = ['ต่ำ', 'ปกติ', 'สูง', 'เร่งด่วน'];
      if (!validPriorities.includes(dbPayload.priority)) dbPayload.priority = 'ปกติ';

      if (dbPayload.status === 'เสร็จสิ้น' || dbPayload.status === 'ยกเลิก') {
        if (!dbPayload.resolved_at) dbPayload.resolved_at = new Date().toISOString();
      } else {
        dbPayload.resolved_at = null;
      }

      let currentTicketId = ticketId;

      if (ticketId) {
        const { error } = await supabase.from('repair_tickets').update(dbPayload).eq('id', ticketId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('repair_tickets').insert([dbPayload]).select().single();
        if (error) throw error;
        if (data) currentTicketId = data.id;
      }

      if (selectedPartId && partQty > 0 && currentTicketId) {
        const { data: currentStock } = await supabase.from('stock_items').select('quantity, name').eq('id', selectedPartId).single();
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
          
          logAudit({
            action: 'update',
            details: `Deducted ${partQty} of ${currentStock.name} for Ticket ${currentTicketId}`
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      const action = ticketId ? 'update' : 'create';
      logAudit({
        action,
        details: `Ticket ${action}d: ${variables.title}`
      });
      toast.success(ticketId ? 'Ticket updated successfully' : 'Ticket created successfully');
      queryClient.invalidateQueries({ queryKey: ['repair_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['asset_timeline'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      if (!variables.keepOpen) {
        onClose();
      }
    },
    onError: (err: any) => toast.error('Error saving ticket: ' + err.message)
  });

  const onSubmit = (data: TicketFormValues, keepOpen = false) => {
    let finalComments = [...comments];
    if (newComment.trim()) {
      finalComments.push({
        author: 'User', // In a real app, get from auth
        text: newComment.trim(),
        time: new Date().toISOString()
      });
      setComments(finalComments);
      setNewComment('');
    }
    
    let finalDescription = data.description || '';
    if (finalComments.length > 0) {
      finalDescription += `\n<!--COMMENTS-->${JSON.stringify(finalComments)}`;
    }
    
    saveMutation.mutate({ ...data, description: finalDescription, keepOpen });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-background text-foreground transition-colors duration-300 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl font-bold">{ticketId ? 'Edit Repair Ticket' : 'Create Repair Ticket'}</DialogTitle>
        </DialogHeader>

        {isLoadingTicket ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            <form id="ticket-form" onSubmit={form.handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
            
            <div className="space-y-2">
              <Label>Asset (อุปกรณ์ที่เสีย)</Label>
              <Controller name="asset_id" control={form.control} render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select an Asset...">{field.value ? (() => { const a = assets.find(a => a.id === field.value); return a ? `[${a.asset_code}] ${a.name}` : 'Select an Asset...'; })() : 'Select an Asset...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {assets.map(a => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="space-y-2">
              <Label>Title (หัวข้อการแจ้งซ่อม) *</Label>
              <Input {...form.register('title')} />
              {form.formState.errors.title && <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Description (รายละเอียดอาการที่เสีย)</Label>
              <textarea 
                {...form.register('description')} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority (ความสำคัญ)</Label>
                <Controller name="priority" control={form.control} render={({ field }) => (
                  <Select value={field.value || 'ปกติ'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select Priority..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ต่ำ">ต่ำ (Low)</SelectItem>
                      <SelectItem value="ปกติ">ปกติ (Medium)</SelectItem>
                      <SelectItem value="สูง">สูง (High)</SelectItem>
                      <SelectItem value="เร่งด่วน">เร่งด่วน (Critical)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Controller name="status" control={form.control} render={({ field }) => (
                  <Select value={field.value || 'เปิด'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="เปิด">เปิด (Pending)</SelectItem>
                      <SelectItem value="กำลังดำเนินการ">กำลังดำเนินการ (In Progress)</SelectItem>
                      <SelectItem value="รอะไหล่">รอะไหล่ (Waiting for parts)</SelectItem>
                      <SelectItem value="เสร็จสิ้น">เสร็จสิ้น (Resolved)</SelectItem>
                      <SelectItem value="ยกเลิก">ยกเลิก (Cancelled)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="space-y-2">
                <Label>Cost (ค่าซ่อม)</Label>
                <Input type="number" {...form.register('cost')} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-blue-600 dark:text-blue-400 font-semibold">Use Parts from Stock (เบิกอะไหล่)</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger><SelectValue placeholder="Select Part to Deduct...">{selectedPartId ? (() => { const item = stockItems.find(i => i.id === selectedPartId); return item ? `${item.name} (${item.quantity} ${item.unit} in stock)` : 'Select Part to Deduct...'; })() : 'Select Part to Deduct...'}</SelectValue></SelectTrigger>
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

            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-primary font-semibold">Activity & Comments (ความคืบหน้า)</Label>
              {comments.length > 0 ? (
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border">
                  {comments.map((comment, idx) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">{comment.author.charAt(0)}</span>
                      </div>
                      <div className="flex-1 bg-background border rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-xs">{comment.author}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(comment.time).toLocaleString('th-TH')}</span>
                        </div>
                        <p className="text-muted-foreground text-xs whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-muted/30 rounded-lg border border-border border-dashed text-xs text-muted-foreground">ยังไม่มีการบันทึกความคืบหน้า</div>
              )}
              
              <div className="flex gap-2">
                <Input 
                  placeholder="พิมพ์ข้อความเพื่อบันทึกความคืบหน้า..." 
                  value={newComment} 
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSubmit(form.getValues(), true);
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => { if(newComment.trim()) onSubmit(form.getValues(), true); }}>Add</Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save Ticket'}
              </Button>
            </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

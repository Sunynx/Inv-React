'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { logAudit } from '@/lib/auditLog';

const stockItemSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อสินค้า'),
  sku: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
  location: z.string().nullable().optional(),
  unit: z.string().min(1, 'กรุณาระบุหน่วยนับ'),
  description: z.string().nullable().optional()
});
type StockItemFormValues = z.infer<typeof stockItemSchema>;

export default function StockItemSheet({ isOpen, onClose, itemId }: { isOpen: boolean; onClose: () => void; itemId?: string }) {
  const queryClient = useQueryClient();

  const form = useForm<StockItemFormValues>({
    resolver: zodResolver(stockItemSchema),
    defaultValues: { quantity: 0, min_stock: 0, unit: 'ชิ้น' }
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const { data: itemData, isLoading: isLoadingItem } = useQuery({
    queryKey: ['stock_item', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase.from('stock_items').select('*').eq('id', itemId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!itemId
  });

  const { data: history = [] } = useQuery({
    queryKey: ['stock_history', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase.from('stock_transactions').select('*').eq('stock_item_id', itemId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!itemId
  });

  useEffect(() => {
    if (isOpen) {
      if (itemId && itemData) {
        form.reset({
          ...itemData,
          quantity: Number(itemData.quantity) || 0,
          min_stock: Number(itemData.min_stock) || 0
        });
      } else if (!itemId) {
        form.reset({ quantity: 0, min_stock: 0, unit: 'ชิ้น' });
      }
    }
  }, [isOpen, itemId, itemData, form]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (itemId) {
        // Prevent updating quantity directly if it's an edit. Quantity should be updated via transactions.
        delete payload.quantity;
        const { error } = await supabase.from('stock_items').update(payload).eq('id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_items').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      logAudit({ 
        action: itemId ? 'update' : 'create', 
        details: `${itemId ? 'Updated' : 'Added'} stock item: ${variables.name}` 
      });
      toast.success(itemId ? 'Item updated' : 'Item added to stock');
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving item: ' + err.message)
  });

  const onSubmit = (data: StockItemFormValues) => {
    saveMutation.mutate(data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md w-[450px] p-0 flex flex-col bg-background text-foreground overflow-y-auto border-l border-border transition-colors duration-300">
        <SheetHeader className="p-6 pb-2 border-b border-border">
          <SheetTitle className="text-xl font-semibold text-foreground">{itemId ? 'Edit Item Details' : 'Add New Item'}</SheetTitle>
        </SheetHeader>

        {/* Form Area */}
        <div className="p-6 flex-1">
          {isLoadingItem ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : (
            <form id="stock-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Item Name *</Label>
                <Input {...form.register('name')} className="h-9 shadow-sm" />
                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">SKU / Part Number</Label>
                <Input {...form.register('sku')} className="h-9 shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Category</Label>
                  <Controller name="category_id" control={form.control} render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 shadow-sm bg-background">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Quantity (Target)</Label>
                  <Input type="number" {...form.register('quantity')} className="h-9 shadow-sm" disabled={!!itemId} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Minimum (Limit)</Label>
                  <Input type="number" {...form.register('min_stock')} className="h-9 shadow-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Location</Label>
                  <Input {...form.register('location')} className="h-9 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Unit *</Label>
                  <Input {...form.register('unit')} className="h-9 shadow-sm" placeholder="e.g. ชิ้น" />
                  {form.formState.errors.unit && <p className="text-xs text-red-500">{form.formState.errors.unit.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Description / Notes</Label>
                <textarea 
                  {...form.register('description')} rows={2} 
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                />
              </div>
            </form>
          )}

          {!isLoadingItem && itemId && (
            <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-semibold text-base mb-4 text-foreground">Transaction History</h3>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No transactions found.</div>
                ) : history.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-start border-b border-border pb-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${tx.type === 'receive' ? 'text-emerald-600 dark:text-emerald-400' : tx.type === 'distribute' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {tx.type === 'receive' ? '+ Receive' : tx.type === 'distribute' ? '- Distribute' : tx.type}
                        </span>
                        <span className="font-bold text-foreground">{tx.quantity}</span>
                      </div>
                      <div className="text-muted-foreground text-xs mt-1 space-y-0.5">
                        {tx.recipient && <div>Recipient: <span className="font-medium text-foreground">{tx.recipient}</span></div>}
                        {tx.reference_doc && <div>Ref: {tx.reference_doc}</div>}
                        {tx.notes && <div>Notes: {tx.notes}</div>}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
                      <div>{new Date(tx.created_at).toLocaleDateString()}</div>
                      <div>{new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 mt-auto flex gap-3 transition-colors">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" form="stock-form" disabled={saveMutation.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            {saveMutation.isPending ? 'Saving...' : 'Submit'}
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
}

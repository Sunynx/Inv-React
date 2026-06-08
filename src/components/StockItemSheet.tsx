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

export default function StockItemSheet({ isOpen, onClose, itemId }: { isOpen: boolean; onClose: () => void; itemId?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const queryClient = useQueryClient();

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
        setFormData(itemData);
      } else if (!itemId) {
        setFormData({ quantity: 0, min_stock: 0, unit: 'ชิ้น', status: 'Active' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, itemId, itemData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (itemId) {
        const { error } = await supabase.from('stock_items').update(payload).eq('id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_items').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(itemId ? 'Item updated' : 'Item added to stock');
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving item: ' + err.message)
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
            <form id="stock-form" onSubmit={handleSave} className="space-y-5">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Item Name</Label>
                <Input required name="name" value={formData.name || ''} onChange={handleChange} className="h-9 shadow-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">SKU / Part Number</Label>
                <Input name="sku" value={formData.sku || ''} onChange={handleChange} className="h-9 shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Category</Label>
                  <Select value={formData.category_id || ''} onValueChange={(v) => handleSelectChange('category_id', v)}>
                    <SelectTrigger className="h-9 shadow-sm bg-white">
                      <SelectValue placeholder="Select...">{categories.find(c => c.id === formData.category_id)?.name || 'Select...'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Status</Label>
                  <Select value={formData.status || 'Active'} onValueChange={(v) => handleSelectChange('status', v)}>
                    <SelectTrigger className="h-9 shadow-sm bg-white"><SelectValue placeholder="Status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Quantity (Target)</Label>
                  <Input type="number" name="quantity" value={formData.quantity || 0} onChange={handleChange} className="h-9 shadow-sm" disabled={!!itemId} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Minimum (Limit)</Label>
                  <Input type="number" name="min_stock" value={formData.min_stock || 0} onChange={handleChange} className="h-9 shadow-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Location</Label>
                  <Input name="location" value={formData.location || ''} onChange={handleChange} className="h-9 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Unit</Label>
                  <Input name="unit" value={formData.unit || ''} onChange={handleChange} className="h-9 shadow-sm" placeholder="e.g. ชิ้น" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Description / Notes</Label>
                <textarea 
                  name="description" value={formData.description || ''} onChange={handleChange} rows={2} 
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                />
              </div>
            </form>
          )}

          {!isLoadingItem && itemId && (
            <div className="mt-8 border-t pt-6">
              <h3 className="font-semibold text-base mb-4">Transaction History</h3>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No transactions found.</div>
                ) : history.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-start border-b border-border pb-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${tx.type === 'receive' ? 'text-emerald-600' : tx.type === 'distribute' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {tx.type === 'receive' ? '+ Receive' : tx.type === 'distribute' ? '- Distribute' : tx.type}
                        </span>
                        <span className="font-bold">{tx.quantity}</span>
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

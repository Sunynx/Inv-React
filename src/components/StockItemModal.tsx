'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StockItemModal({ isOpen, onClose, itemId }: { isOpen: boolean; onClose: () => void; itemId?: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (itemId) {
        fetchItem(itemId);
      } else {
        setFormData({ quantity: 0, minimum_quantity: 0, unit: 'ชิ้น', status: 'Active' });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, itemId]);

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  }

  async function fetchItem(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('stock_items').select('*').eq('id', id).single();
      if (error) throw error;
      setFormData(data);
    } catch (err: any) {
      toast.error('Failed to load item: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      
      if (itemId) {
        const { error } = await supabase.from('stock_items').update(payload).eq('id', itemId);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase.from('stock_items').insert([payload]);
        if (error) throw error;
        toast.success('Item added to stock');
      }
      onClose();
    } catch (err: any) {
      toast.error('Error saving item: ' + err.message);
    } finally {
      setLoading(false);
    }
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
          <DialogTitle className="text-2xl">{itemId ? 'Edit Stock Item' : 'Add Stock Item'}</DialogTitle>
        </DialogHeader>

        {loading && !itemId ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 mt-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name (ชื่ออะไหล่) *</Label>
                <Input required name="name" value={formData.name || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>SKU / Part Number</Label>
                <Input name="sku" value={formData.sku || ''} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Category (หมวดหมู่)</Label>
                <Select value={formData.category_id || ''} onValueChange={(v) => handleSelectChange('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select a Category...">{categories.find(c => c.id === formData.category_id)?.name || 'Select a Category...'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit (หน่วยนับ)</Label>
                <Input name="unit" value={formData.unit || ''} onChange={handleChange} placeholder="e.g. ชิ้น, กล่อง, เส้น" />
              </div>

              {!itemId && (
                <div className="space-y-2">
                  <Label>Initial Quantity (จำนวนเริ่มต้น)</Label>
                  <Input type="number" name="quantity" value={formData.quantity || 0} onChange={handleChange} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Minimum Quantity (จุดสั่งซื้อ)</Label>
                <Input type="number" name="minimum_quantity" value={formData.minimum_quantity || 0} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Location (สถานที่เก็บ)</Label>
                <Input name="location" value={formData.location || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Status (สถานะ)</Label>
                <Select value={formData.status || 'Active'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active (ใช้งาน)</SelectItem>
                    <SelectItem value="Inactive">Inactive (เลิกใช้งาน)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Description / Notes</Label>
              <textarea 
                name="description" value={formData.description || ''} onChange={handleChange} rows={3} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Item'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

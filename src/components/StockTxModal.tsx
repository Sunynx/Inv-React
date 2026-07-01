'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { logAudit } from '@/lib/auditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StockTxModal({ 
  isOpen, onClose, itemId, currentQty, itemName, type 
}: { 
  isOpen: boolean; onClose: () => void; itemId: string; currentQty: number; itemName: string; type: 'receive' | 'distribute' 
}) {
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [responsible, setResponsible] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (type === 'distribute' && qty > currentQty) {
      toast.error('Cannot distribute more than current stock!');
      return;
    }

    setLoading(true);
    try {
      const newQty = type === 'receive' ? currentQty + qty : currentQty - qty;
      
      // Update item quantity
      const { error: updateErr } = await supabase.from('stock_items').update({ quantity: newQty }).eq('id', itemId);
      if (updateErr) throw updateErr;

      // Insert transaction
      const { error: txErr } = await supabase.from('stock_transactions').insert([{
        stock_item_id: itemId,
        type: type,
        quantity: qty,
        reference_doc: refNo || null,
        notes: notes || null,
        recipient: responsible || null
      }]);
      if (txErr) throw txErr;

      logAudit({ 
        action: type === 'receive' ? 'create' : 'update', 
        details: `${type === 'receive' ? 'Received' : 'Distributed'} ${qty} units of ${itemName}` 
      });

      toast.success(`Successfully ${type === 'receive' ? 'received' : 'distributed'} ${qty} items.`);
      onClose();
    } catch (err: any) {
      toast.error('Error processing transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={type === 'receive' ? 'text-emerald-600' : 'text-blue-600'}>
            {type === 'receive' ? 'Receive Stock In' : 'Distribute Stock Out'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-4">
          <div className="bg-muted p-3 rounded-md mb-4">
            <p className="text-sm text-muted-foreground">Item</p>
            <p className="font-semibold">{itemName}</p>
            <p className="text-xs mt-1">Current Stock: <span className="font-bold">{currentQty}</span></p>
          </div>

          <div className="space-y-2">
            <Label>Quantity to {type === 'receive' ? 'Receive' : 'Distribute'} *</Label>
            <Input type="number" min="1" required value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Reference Number (PO/PR/Ticket)</Label>
            <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{type === 'receive' ? 'Received By / Supplier' : 'Issued To (Person/Dept)'}</Label>
            <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea 
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} 
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} variant={type === 'receive' ? 'default' : 'secondary'} className={type === 'receive' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
              {loading ? 'Processing...' : `Confirm ${type === 'receive' ? 'Receive' : 'Distribute'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

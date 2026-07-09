import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoveRight, Package } from 'lucide-react';

const transferSchema = z.object({
  assigned_user: z.string().min(1, 'Required'),
  location: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});

type TransferForm = z.infer<typeof transferSchema>;

interface BulkTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: any[];
  onSuccess?: () => void;
}

export default function BulkTransferModal({ isOpen, onClose, selectedAssets, onSuccess }: BulkTransferModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { assigned_user: '', location: '', notes: '' },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: TransferForm) => {
      // 1. Update all assets
      const assetIds = selectedAssets.map(a => a.id);
      const { error: assetError } = await supabase
        .from('assets')
        .update({
          assigned_user: data.assigned_user,
          location: data.location,
          updated_at: new Date().toISOString()
        })
        .in('id', assetIds);
        
      if (assetError) throw assetError;

      // 2. Insert into transfers history individually for auditing
      const transferRecords = selectedAssets.map(asset => ({
        asset_id: asset.id,
        from_location: asset.location || 'Unknown',
        to_location: data.location,
        from_user: asset.assigned_user || 'Unknown',
        to_user: data.assigned_user,
        transfer_date: new Date().toISOString(),
        notes: data.notes ? `[BULK TRANSFER] ${data.notes}` : '[BULK TRANSFER]',
        status: 'เสร็จสิ้น',
        signature_url: null,
      }));

      const { error: transferError } = await supabase
        .from('transfers')
        .insert(transferRecords);

      if (transferError) throw transferError;
      
      // 3. Insert Audit Logs
      const auditRecords = selectedAssets.map(asset => ({
        asset_id: asset.id,
        action: 'bulk_transfer',
        details: `Bulk transferred to ${data.assigned_user} at ${data.location}`,
        performed_by: 'System User', // Should be current user
      }));
      
      await supabase.from('audit_log').insert(auditRecords);

      return true;
    },
    onSuccess: () => {
      toast.success(`Successfully transferred ${selectedAssets.length} assets`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      form.reset();
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error('Failed to transfer: ' + err.message);
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MoveRight className="w-5 h-5 text-blue-600" />
            Bulk Transfer
          </DialogTitle>
        </DialogHeader>

        <div className="bg-blue-50/50 p-4 rounded-lg mb-4 flex items-start gap-3 border border-blue-100">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-full shrink-0 mt-0.5">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Transferring {selectedAssets.length} Assets</h4>
            <p className="text-xs text-blue-700/80 mt-1 line-clamp-2">
              {selectedAssets.slice(0, 3).map(a => a.asset_code).join(', ')}
              {selectedAssets.length > 3 && ` ...and ${selectedAssets.length - 3} more`}
            </p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit((data) => transferMutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>New Assigned User (พนักงานที่รับมอบ)</Label>
            <Input {...form.register('assigned_user')} placeholder="e.g. John Doe" />
            {form.formState.errors.assigned_user && <span className="text-xs text-red-500">{form.formState.errors.assigned_user.message}</span>}
          </div>
          
          <div className="space-y-2">
            <Label>New Location (สถานที่ตั้งใหม่)</Label>
            <Input {...form.register('location')} placeholder="e.g. Floor 12, Zone B" />
            {form.formState.errors.location && <span className="text-xs text-red-500">{form.formState.errors.location.message}</span>}
          </div>

          <div className="space-y-2">
            <Label>Notes (หมายเหตุ)</Label>
            <Input {...form.register('notes')} placeholder="Optional notes for this transfer" />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={transferMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {transferMutation.isPending ? 'Processing...' : 'Confirm Transfer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

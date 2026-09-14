import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SeatAssignmentModal({ 
  isOpen, 
  onClose, 
  seatId, 
  licenseMasterId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  seatId?: string | null;
  licenseMasterId?: string;
}) {
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

  const { data: employees = [] } = useQuery({
    queryKey: ['employees_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id, name, email').order('name');
      return data || [];
    },
    enabled: isOpen
  });

  const { data: seatData, isLoading: isLoadingSeat } = useQuery({
    queryKey: ['license_seat', seatId],
    queryFn: async () => {
      if (!seatId) return null;
      const { data, error } = await supabase.from('licenses').select('*').eq('id', seatId).single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!seatId
  });

  useEffect(() => {
    if (isOpen) {
      if (seatId && seatData) {
        setFormData(seatData);
      } else if (!seatId) {
        setFormData({ 
          status: 'active',
          assignment_status: 'Unassigned',
          license_master_id: licenseMasterId
        });
      }
    } else {
      setFormData({});
    }
  }, [isOpen, seatId, seatData, licenseMasterId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Clean up empty associations
      if (payload.asset_id === 'none' || !payload.asset_id) payload.asset_id = null;
      if (payload.employee_id === 'none' || !payload.employee_id) payload.employee_id = null;
      
      // Auto-update assignment status
      if (payload.asset_id || payload.employee_id) {
        payload.assignment_status = 'Assigned';
      } else {
        payload.assignment_status = 'Unassigned';
      }

      if (seatId) {
        const { error } = await supabase.from('licenses').update(payload).eq('id', seatId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('licenses').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(seatId ? 'Seat updated' : 'Seat added successfully');
      queryClient.invalidateQueries({ queryKey: ['license_seats'] });
      queryClient.invalidateQueries({ queryKey: ['asset_licenses'] });
      onClose();
    },
    onError: (err: any) => toast.error('Error saving seat: ' + err.message)
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
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
          <DialogTitle className="text-xl">{seatId ? 'Edit Seat Assignment' : 'Add New Seat'}</DialogTitle>
        </DialogHeader>

        {isLoadingSeat ? (
          <div className="py-8 text-center animate-pulse">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seat No.</Label>
                <Input type="number" name="seat_no" value={formData.seat_no || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>License Key</Label>
                <Input name="license_key" value={formData.license_key || ''} onChange={handleChange} className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Assign to Asset (อุปกรณ์)</Label>
                <Select value={formData.asset_id || 'none'} onValueChange={(v) => handleSelectChange('asset_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select an Asset..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- ไม่ระบุ (No Asset) --</SelectItem>
                    {assets.map((a: any) => <SelectItem key={a.id} value={a.id}>[{a.asset_code}] {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Employee (พนักงาน)</Label>
                <Select value={formData.employee_id || 'none'} onValueChange={(v) => handleSelectChange('employee_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select an Employee..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- ไม่ระบุ (No Employee) --</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || 'active'} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment Status</Label>
                <Select value={formData.assignment_status || 'Unassigned'} onValueChange={(v) => handleSelectChange('assignment_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Assignment Notes</Label>
              <textarea 
                name="assignment_notes" value={formData.assignment_notes || ''} onChange={handleChange} rows={2} 
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? 'Saving...' : 'Save Assignment'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, CheckCircle2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import CheckoutModal from '@/components/CheckoutModal';

export default function CheckoutsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(undefined);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['asset_checkouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_checkouts')
        .select(`*, assets(name, asset_code)`)
        .order('checkout_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const returnMutation = useMutation({
    mutationFn: async (payload: { id: string, asset_id: string }) => {
      const { error } = await supabase
        .from('asset_checkouts')
        .update({ status: 'returned', actual_return_date: new Date().toISOString() })
        .eq('id', payload.id);
      if (error) throw error;
      
      // Update asset back to general 'ใช้งาน' if you want
      // await supabase.from('assets').update({ status: 'ใช้งาน' }).eq('id', payload.asset_id);
    },
    onSuccess: () => {
      toast.success('Asset returned successfully');
      queryClient.invalidateQueries({ queryKey: ['asset_checkouts'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const cancelReturnMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { error } = await supabase
        .from('asset_checkouts')
        .update({ status: 'checked_out', actual_return_date: null })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ยกเลิกการคืนสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['asset_checkouts'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const filteredRecords = records.filter(r => {
    const matchSearch = r.checked_out_to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.asset_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'assets.name',
      header: 'Asset',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.assets?.name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">{row.original.assets?.asset_code || '-'}</div>
        </div>
      )
    },
    {
      accessorKey: 'checked_out_to',
      header: 'Checked Out To',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.checked_out_to}</div>
          <div className="text-xs text-muted-foreground">{row.original.department}</div>
        </div>
      )
    },
    {
      accessorKey: 'checkout_date',
      header: 'Checkout Date',
      cell: ({ row }) => <span className="text-sm">{row.original.checkout_date ? format(new Date(row.original.checkout_date), 'dd MMM yyyy HH:mm') : '-'}</span>
    },
    {
      accessorKey: 'expected_return_date',
      header: 'Return Date',
      cell: ({ row }) => {
        const expectedDate = row.original.expected_return_date;
        const actualDate = row.original.actual_return_date;
        const status = row.original.status;
        
        if (status === 'returned' && actualDate) {
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-emerald-600">คืนเมื่อ: {format(new Date(actualDate), 'dd MMM yyyy')}</span>
              <span className="text-[11px] text-muted-foreground">กำหนด: {expectedDate ? format(new Date(expectedDate), 'dd MMM yyyy') : '-'}</span>
            </div>
          );
        }

        const isLate = status === 'checked_out' && expectedDate && new Date(expectedDate) < new Date();
        return (
          <div className="flex flex-col">
            <span className={`text-sm ${isLate ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
              กำหนด: {expectedDate ? format(new Date(expectedDate), 'dd MMM yyyy') : '-'}
            </span>
            {isLate && <span className="text-[10px] text-red-500 font-medium mt-0.5">เลยกำหนดการคืน</span>}
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        let displayStatus = status;
        let colorClass = 'bg-gray-100 text-gray-700';
        if (status === 'checked_out') {
          displayStatus = 'ยืม';
          colorClass = 'bg-amber-100 text-amber-700';
        } else if (status === 'returned') {
          displayStatus = 'คืนแล้ว';
          colorClass = 'bg-emerald-100 text-emerald-700';
        } else if (status === 'overdue') {
          displayStatus = 'เลยกำหนด';
          colorClass = 'bg-red-100 text-red-700';
        }
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorClass}`}>
            {displayStatus}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {record.status === 'checked_out' && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => returnMutation.mutate({ id: record.id, asset_id: record.asset_id })}>
                <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> Return
              </Button>
            )}
            {record.status === 'returned' && (
              <Button variant="outline" size="sm" className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800" onClick={() => cancelReturnMutation.mutate({ id: record.id })}>
                <RotateCcw className="h-4 w-4 mr-1 text-amber-600" /> ยกเลิกการคืน
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedRecordId(record.id); setIsModalOpen(true); }}>
              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Asset Checkouts</h1>
          <p className="text-muted-foreground mt-1">Manage borrowed equipment and return tracking</p>
        </div>
        <Button onClick={() => { setSelectedRecordId(undefined); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> New Checkout
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by user, department or asset..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <select 
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="checked_out">ยืม (Borrowed)</option>
              <option value="returned">คืนแล้ว (Returned)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-sm">
        <DataTable columns={columns} data={filteredRecords} isLoading={isLoading} />
      </Card>

      <CheckoutModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); queryClient.invalidateQueries({ queryKey: ['asset_checkouts'] }); }} 
        recordId={selectedRecordId}
      />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import TransferModal from '@/components/TransferModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      return data || [];
    }
  });

  const getDeptName = (id: string) => departments.find((d: any) => d.id === id)?.name || id;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['asset_transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_transfers')
        .select(`*, assets ( name, asset_code )`)
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asset_transfers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Record deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['asset_transfers'] });
    },
    onError: (err: any) => toast.error('Error deleting record: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = r.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.from_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.to_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.from_user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.to_user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['asset_transfers'] });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'assets.name',
      header: 'Asset',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div>
            <div className="font-medium">{record.assets?.name || 'Unknown Asset'}</div>
            <div className="text-xs text-muted-foreground">{record.assets?.asset_code || '-'}</div>
          </div>
        );
      }
    },
    {
      id: 'user_change',
      header: 'User Change',
      cell: ({ row }) => {
        const r = row.original;
        if (!r.from_user && !r.to_user) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col text-sm">
            {r.from_user && <span className="text-muted-foreground line-through decoration-muted-foreground/50">{r.from_user}</span>}
            <span className="text-primary font-medium">{r.to_user || '-'}</span>
          </div>
        );
      }
    },
    {
      id: 'dept_change',
      header: 'Department Change',
      cell: ({ row }) => {
        const r = row.original;
        if (!r.from_department_id && !r.to_department_id) return <span className="text-muted-foreground">-</span>;
        const fromName = r.from_department_id ? getDeptName(r.from_department_id) : '';
        const toName = r.to_department_id ? getDeptName(r.to_department_id) : '';
        return (
          <div className="flex flex-col text-sm">
            {fromName && <span className="text-muted-foreground line-through decoration-muted-foreground/50">{fromName}</span>}
            <span className="text-primary font-medium">{toName || '-'}</span>
          </div>
        );
      }
    },
    {
      id: 'location_change',
      header: 'Location Change',
      cell: ({ row }) => {
        const r = row.original;
        if (!r.from_location && !r.to_location) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col text-sm">
            {r.from_location && <span className="text-muted-foreground line-through decoration-muted-foreground/50">{r.from_location}</span>}
            <span className="text-primary font-medium">{r.to_location || '-'}</span>
          </div>
        );
      }
    },
    {
      accessorKey: 'transfer_date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.transfer_date ? format(new Date(row.original.transfer_date), 'dd MMM yyyy') : '-'}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedRecord(record); setIsModalOpen(true); }}>
              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Asset Transfers</h1>
          <p className="text-muted-foreground mt-1">Track asset movements and relocation history</p>
        </div>
        <Button onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Record Transfer
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by user, asset, location or notes..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0">
        <DataTable columns={columns} data={filteredRecords} isLoading={isLoading} />
      </Card>

      <TransferModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); refreshData(); }} 
        recordId={selectedRecord?.id}
      />
    </div>
  );
}

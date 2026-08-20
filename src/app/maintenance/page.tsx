'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import MaintenanceModal from '@/components/MaintenanceModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import MaintenanceCalendar from '@/components/MaintenanceCalendar';
import * as Tabs from '@radix-ui/react-tabs';

export default function MaintenancePage() {
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import MaintenanceModal from '@/components/MaintenanceModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import MaintenanceCalendar from '@/components/MaintenanceCalendar';
import * as Tabs from '@radix-ui/react-tabs';

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['maintenance_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`*, assets ( name, asset_code )`)
        .order('next_due_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Record deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
    },
    onError: (err: any) => toast.error('Error deleting record: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.asset_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchFrequency = filterType === 'all' || r.frequency === filterType;
    return matchSearch && matchStatus && matchFrequency;
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
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
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.title}</span>
    },
    {
      accessorKey: 'next_due_at',
      header: 'Scheduled Date',
      cell: ({ row }) => (
        <span>
          {row.original.next_due_at ? format(new Date(row.original.next_due_at), 'dd MMM yyyy') : '-'}
        </span>
      )
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            status === 'completed' ? 'bg-green-100 text-green-700' :
            status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {status || 'Unknown'}
          </span>
        );
      }
    },
    {
      accessorKey: 'performed_by',
      header: 'Performed By',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.performed_by || '-'}</span>
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Maintenance (PM)</h1>
          <p className="text-muted-foreground mt-1">Schedule and track preventive maintenance</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs.Root value={viewMode} onValueChange={(v) => setViewMode(v as 'list'|'calendar')} className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center">
            <Tabs.List className="flex gap-1">
              <Tabs.Trigger value="calendar" className="px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-500 hover:text-slate-900 dark:hover:text-slate-300">
                <CalendarIcon className="w-4 h-4" />
              </Tabs.Trigger>
              <Tabs.Trigger value="list" className="px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-500 hover:text-slate-900 dark:hover:text-slate-300">
                <LayoutList className="w-4 h-4" />
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          <Button onClick={() => { setSelectedRecord(null); setSelectedDate(undefined); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Schedule PM
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by asset code or notes..."
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
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select 
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Frequencies</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'calendar' ? (
        <MaintenanceCalendar 
          records={filteredRecords} 
          onRecordClick={(record) => {
            setSelectedRecord(record);
            setIsModalOpen(true);
          }} 
          onDayClick={(date) => {
            setSelectedRecord(null);
            setSelectedDate(format(date, 'yyyy-MM-dd'));
            setIsModalOpen(true);
          }}
        />
      ) : (
        <Card className="overflow-hidden border-0">
          <CardContent className="p-0">
            <DataTable 
              columns={columns} 
              data={filteredRecords} 
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      )}

      <MaintenanceModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); refreshData(); }} 
        recordId={selectedRecord?.id}
        defaultDate={selectedDate}
      />
    </div>
  );
}

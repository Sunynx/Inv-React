'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, MoreHorizontal, Edit, Trash2, CheckCircle2, AlertCircle, Clock, Wrench, Ban, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import TicketModal from '@/components/TicketModal';
import ReportExportModal from '@/components/ReportExportModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

const statusConfig: Record<string, { icon: any; className: string }> = {
  'แจ้งซ่อม': { icon: AlertCircle, className: 'text-amber-600 bg-amber-50 border-amber-200/50' },
  'กำลังดำเนินการ': { icon: Wrench, className: 'text-blue-600 bg-blue-50 border-blue-200/50' },
  'รออะไหล่': { icon: Clock, className: 'text-orange-600 bg-orange-50 border-orange-200/50' },
  'ซ่อมสำเร็จ': { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200/50' },
  'ส่งซ่อมภายนอก': { icon: Wrench, className: 'text-purple-600 bg-purple-50 border-purple-200/50' },
  'ยกเลิก': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
};

const priorityConfig: Record<string, string> = {
  'ต่ำ': 'bg-gray-100 text-gray-600',
  'ปานกลาง': 'bg-blue-100 text-blue-700',
  'สูง': 'bg-red-100 text-red-700',
  'ด่วนมาก': 'bg-red-200 text-red-800',
  'Low': 'bg-gray-100 text-gray-600',
  'Medium': 'bg-blue-100 text-blue-700',
  'High': 'bg-red-100 text-red-700',
  'Critical': 'bg-red-200 text-red-800',
};

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['repair_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_tickets')
        .select(`*, assets(name, asset_code)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('repair_tickets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ticket deleted');
      queryClient.invalidateQueries({ queryKey: ['repair_tickets'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('ลบ Ticket นี้หรือไม่?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.issue_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.assets?.asset_code?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchTab = true;
    if (filterTab !== 'all') matchTab = t.status === filterTab;
    return matchSearch && matchTab;
  });

  const countByStatus = (s: string) => tickets.filter(t => t.status === s).length;

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['repair_tickets'] });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'assets.name',
      header: 'Asset',
      cell: ({ row }) => {
        const ticket = row.original;
        return (
          <div>
            <div className="font-medium text-sm text-foreground">{ticket.assets?.name || 'Unknown'}</div>
            <div className="text-[11px] text-muted-foreground">{ticket.assets?.asset_code || '-'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'issue_description',
      header: 'Issue',
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate text-sm text-muted-foreground" title={row.original.issue_description}>
          {row.original.issue_description}
        </div>
      )
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.original.priority;
        const pc = priorityConfig[priority] || 'bg-muted text-foreground/80';
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${pc}`}>
            {priority || 'N/A'}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const sc = statusConfig[status] || statusConfig['ยกเลิก'];
        const Icon = sc.icon;
        return (
          <div className={`inline-flex items-center text-[13px] font-medium border px-2.5 py-1 rounded-full ${sc.className}`}>
            <Icon className="w-3.5 h-3.5 mr-1.5" /> {status}
          </div>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.created_at ? format(new Date(row.original.created_at), 'dd MMM yyyy') : '-'}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const ticket = row.original;
        return (
          <div className="text-right pr-4" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setIsModalOpen(true); }}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete(ticket.id)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Repair Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage maintenance and repair requests</p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60 rounded-xl overflow-hidden bg-card border-0 transition-colors duration-300">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <Tabs.Root value={filterTab} onValueChange={setFilterTab} className="w-full md:w-auto">
            <Tabs.List className="flex gap-1 flex-wrap">
              {[
                { value: 'all', label: 'All', count: tickets.length },
                { value: 'แจ้งซ่อม', label: 'แจ้งซ่อม', count: countByStatus('แจ้งซ่อม') },
                { value: 'กำลังดำเนินการ', label: 'กำลังดำเนินการ', count: countByStatus('กำลังดำเนินการ') },
                { value: 'ซ่อมสำเร็จ', label: 'ซ่อมสำเร็จ', count: countByStatus('ซ่อมสำเร็จ') },
              ].map(tab => (
                <Tabs.Trigger key={tab.value} value={tab.value} className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 data-[state=active]:text-gray-900 data-[state=active]:bg-gray-100 rounded-md transition-colors flex items-center gap-2">
                  {tab.label} <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{tab.count}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search issue or asset..." className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setIsExportModalOpen(true)}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" className="h-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setSelectedTicket(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> New Ticket
            </Button>
          </div>
        </div>

        <div className="p-4 bg-gray-50/30">
          <DataTable columns={columns} data={filteredTickets} isLoading={isLoading} />
        </div>
      </Card>

      <TicketModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); refreshData(); }} ticketId={selectedTicket?.id} />
      <ReportExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        initialDataTypes={['tickets']}
      />
    </div>
  );
}

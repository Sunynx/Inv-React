'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2, AlertTriangle, FileText, ShoppingCart, Clock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import ProcurementModal from '@/components/ProcurementModal';
import ProcurementReceiveModal from '@/components/ProcurementReceiveModal';
import { EmptyState } from '@/components/EmptyState';
import ImportPRModal from '@/components/ImportPRModal';
import PRPrintView from '@/components/PRPrintView';
import toast from 'react-hot-toast';

export default function ProcurementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<any | null>(null);
  const [filterTab, setFilterTab] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['procurement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching procurement:", error);
        return [];
      }
      return data || [];
    }
  });

  const filteredDocs = documents.filter(doc => {
    const matchSearch = doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        doc.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchTab = true;
    if (filterTab !== 'all') matchTab = doc.status === filterTab;
    
    let matchType = true;
    if (filterType !== 'all') matchType = doc.type === filterType;
    
    return matchSearch && matchTab && matchType;
  }).sort((a, b) => {
    if (sortBy === 'date_desc') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'date_asc') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === 'amount_desc') {
      return Number(b.total_amount || 0) - Number(a.total_amount || 0);
    } else if (sortBy === 'amount_asc') {
      return Number(a.total_amount || 0) - Number(b.total_amount || 0);
    }
    return 0;
  });

  const countByStatus = (s: string) => documents.filter(d => d.status === s).length;

  const handleEdit = (doc: any) => {
    setSelectedDoc(doc);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedDoc(null);
    setIsModalOpen(true);
  };

  const handleReceive = (doc: any) => {
    setSelectedDoc(doc);
    setIsReceiveModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("คุณแน่ใจหรือไม่ที่จะลบเอกสารนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้")) {
      try {
        const { error } = await supabase.from('procurement').delete().eq('id', id);
        if (error) throw error;
        toast.success("ลบเอกสารสำเร็จ");
        queryClient.invalidateQueries({ queryKey: ['procurement'] });
      } catch (err) {
        console.error(err);
        toast.error("เกิดข้อผิดพลาดในการลบเอกสาร");
      }
    }
  };

  const handleApprove = async (doc: any) => {
    if (confirm(`Approve this PR (${doc.document_number}) and change status to Ordered?`)) {
      try {
        const { error } = await supabase
          .from('procurement')
          .update({ status: 'สั่งซื้อแล้ว' })
          .eq('id', doc.id);
        
        if (error) throw error;
        toast.success(`PR ${doc.document_number} approved and ordered.`);
        queryClient.invalidateQueries({ queryKey: ['procurement'] });
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    }
  };

  const handlePrint = (doc: any) => {
    setPrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 500); // Give time for the component to render in DOM
  };

  const handleExportExcel = async (doc: any) => {
    try {
      const response = await fetch('/Template_PR.xlsx');
      if (!response.ok) throw new Error('Template not found');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const ws = workbook.getWorksheet(1);
      
      const metadata = doc.metadata || {};
      const items = doc.items || [];
      const finalTotalAmount = doc.total_amount || 0;

      if (ws) {
        ws.getCell('C6').value = metadata.department || '';
        ws.getCell('C8').value = metadata.date || metadata.original_date || new Date().toLocaleDateString('en-GB');
        ws.getCell('K7').value = metadata.telephone || '';
        ws.getCell('K8').value = metadata.email || '';
        ws.getCell('B11').value = metadata.reason_for_purchase || doc.title || '';
        ws.getCell('K11').value = metadata.date_required || '';
        
        items.forEach((item: any, index: number) => {
          const row = 15 + index;
          if (row <= 22) {
             ws.getCell(`B${row}`).value = item.quantity;
             ws.getCell(`C${row}`).value = item.name;
             ws.getCell(`L${row}`).value = item.price || '';
          }
        });
        
        ws.getCell('E24').value = finalTotalAmount;
        ws.getCell('I24').value = metadata.total_foreign || '';
        if (metadata.budget_control === 'Budgeted') ws.getCell('C26').value = '✔';
        if (metadata.budget_control === 'Not Budgeted') ws.getCell('E26').value = '✔';
        ws.getCell('I26').value = metadata.budget_code || '';
        ws.getCell('H28').value = metadata.quotes_summary || '';
        ws.getCell('I29').value = metadata.no_quotes_reason || '';
        ws.getCell('D31').value = metadata.preferred_supplier || '';
        ws.getCell('E32').value = metadata.preferred_quote_thb || '';
        ws.getCell('H32').value = metadata.preferred_quote_foreign || '';
        ws.getCell('I33').value = metadata.not_lowest_reason || '';
        ws.getCell('D36').value = metadata.recommended_supplier || '';
        ws.getCell('J36').value = metadata.recommended_remark || '';
        ws.getCell('E37').value = metadata.recommended_price_thb || '';
        ws.getCell('H37').value = metadata.recommended_price_foreign || '';
        ws.getCell('C42').value = metadata.appr_head_name || '';
        ws.getCell('E42').value = metadata.appr_head_date || '';
        ws.getCell('G42').value = metadata.appr_pur_name || '';
        ws.getCell('K42').value = metadata.appr_pur_date || '';
        ws.getCell('B46').value = metadata.appr_fin_name || '';
        ws.getCell('E46').value = metadata.appr_fin_date || '';
        ws.getCell('B50').value = metadata.appr_md_name || '';
        ws.getCell('E50').value = metadata.appr_md_date || '';
        ws.getCell('G50').value = metadata.appr_chair_name || '';
        ws.getCell('K50').value = metadata.appr_chair_date || '';
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `PR_${doc.document_number || 'Form'}.xlsx`);
      toast.success('Exported to Excel successfully!');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export to Excel.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'รอดำเนินการ':
        return <span className="inline-flex items-center text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
      case 'อนุมัติแล้ว':
        return <span className="inline-flex items-center text-blue-600 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><FileText className="w-3 h-3 mr-1" /> Approved</span>;
      case 'สั่งซื้อแล้ว':
        return <span className="inline-flex items-center text-purple-600 bg-purple-50 border border-purple-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><ShoppingCart className="w-3 h-3 mr-1" /> Ordered</span>;
      case 'ได้รับของแล้ว':
        return <span className="inline-flex items-center text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Received</span>;
      case 'รับของบางส่วน':
        return <span className="inline-flex items-center text-teal-600 bg-teal-50 border border-teal-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Partial</span>;
      case 'ยกเลิก':
        return <span className="inline-flex items-center text-red-600 bg-red-50 border border-red-200/50 px-2 py-0.5 rounded-full text-xs font-medium"><AlertTriangle className="w-3 h-3 mr-1" /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center text-gray-600 bg-gray-50 border border-gray-200/50 px-2 py-0.5 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'document_number',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Document No.
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.document_number}</span>,
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{row.original.created_at ? format(new Date(row.original.created_at), 'dd/MM/yyyy') : '-'}</span>,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${row.original.type === 'PR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {row.original.type}
        </span>
      ),
    },
    {
      accessorKey: 'supplier',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Supplier
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.supplier || '-'}</span>,
    },
    {
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Total Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">฿{Number(row.original.total_amount || 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => handlePrint(doc)}>Print</Button>
            <Button variant="ghost" size="sm" onClick={() => handleExportExcel(doc)}>Excel</Button>
            <Button variant="ghost" size="sm" onClick={() => handleEdit(doc)}>Edit</Button>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(doc.id)}>Delete</Button>
            
            {doc.status === 'รอดำเนินการ' && (
              <Button variant="outline" size="sm" className="ml-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" onClick={() => handleApprove(doc)}>
                Approve
              </Button>
            )}

            {(doc.status === 'สั่งซื้อแล้ว' || doc.status === 'รับของบางส่วน') && (
              <Button variant="outline" size="sm" className="ml-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" onClick={() => handleReceive(doc)}>
                Receive Items
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Procurement (PR/PO)</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage purchase requests and orders.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50">
            <Upload className="w-4 h-4 mr-2" />
            Import History
          </Button>
          <Button onClick={handleCreate} className="flex-1 sm:flex-none bg-[#1b365d] hover:bg-[#1b365d]/90">
            <Plus className="w-4 h-4 mr-2" />
            Create Request
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
            <Tabs.Root value={filterTab} onValueChange={setFilterTab} className="w-full md:w-auto">
              <Tabs.List className="flex gap-1 flex-wrap">
                {[
                  { value: 'all', label: 'ทั้งหมด', count: documents.length },
                  { value: 'รอดำเนินการ', label: 'รออนุมัติ', count: countByStatus('รอดำเนินการ') },
                  { value: 'สั่งซื้อแล้ว', label: 'สั่งซื้อแล้ว', count: countByStatus('สั่งซื้อแล้ว') },
                  { value: 'รับของบางส่วน', label: 'รับบางส่วน', count: countByStatus('รับของบางส่วน') },
                  { value: 'ได้รับของแล้ว', label: 'ได้รับของแล้ว', count: countByStatus('ได้รับของแล้ว') },
                  { value: 'ยกเลิก', label: 'ยกเลิก', count: countByStatus('ยกเลิก') },
                ].map(tab => (
                  <Tabs.Trigger key={tab.value} value={tab.value} className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-muted rounded-md transition-colors flex items-center gap-2">
                    {tab.label} <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{tab.count}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs.Root>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[120px] bg-white">
                  <SelectValue placeholder="ประเภท">
                    {filterType === 'all' ? 'ทุกประเภท' : filterType === 'PR' ? 'PR' : filterType === 'PO' ? 'PO' : 'ประเภท'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="PR">PR</SelectItem>
                  <SelectItem value="PO">PO</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[150px] bg-white">
                  <SelectValue placeholder="เรียงลำดับ">
                    {sortBy === 'date_desc' ? 'ใหม่ล่าสุด' : 
                     sortBy === 'date_asc' ? 'เก่าที่สุด' : 
                     sortBy === 'amount_desc' ? 'ราคาสูง-ต่ำ' : 
                     sortBy === 'amount_asc' ? 'ราคาต่ำ-สูง' : 'เรียงลำดับ'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">ใหม่ล่าสุด</SelectItem>
                  <SelectItem value="date_asc">เก่าที่สุด</SelectItem>
                  <SelectItem value="amount_desc">ราคาสูง-ต่ำ</SelectItem>
                  <SelectItem value="amount_asc">ราคาต่ำ-สูง</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative w-full sm:max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="ค้นหา PR/PO..." 
                  className="pl-9 bg-muted/50 w-full"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-1">
            <DataTable
              columns={columns}
              data={filteredDocs}
              isLoading={isLoading}
              enableRowSelection={false}
              emptyState={
                <EmptyState 
                  title="ไม่พบเอกสารจัดซื้อ" 
                  description="ยังไม่มีเอกสาร PR/PO ที่ตรงกับเงื่อนไขการค้นหาของคุณ หรือยังไม่ได้สร้างเอกสารใหม่"
                  actionLabel="สร้างเอกสารใหม่"
                  onAction={handleCreate}
                />
              }
            />
          </div>
        </CardContent>
      </Card>

      <ProcurementModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        document={selectedDoc}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['procurement'] });
        }}
      />

      <ProcurementReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        document={selectedDoc}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['procurement'] });
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          queryClient.invalidateQueries({ queryKey: ['stock_items'] });
        }}
      />

      <ImportPRModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['procurement'] })}
      />

      {/* Hidden print view injected into DOM when printing */}
      <PRPrintView document={printDoc} />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2, AlertTriangle, FileText, ShoppingCart, Clock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
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
    
    return matchSearch && matchTab;
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

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search PR/PO number, title..." 
                className="pl-9 bg-muted/50 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Document No.</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Supplier</th>
                  <th className="px-6 py-3 font-medium">Total Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skel-${i}`} className="border-border/30">
                      <td className="px-6 py-3"><Skeleton className="h-4 w-24" style={{ animationDelay: `${i * 100}ms` }} /></td>
                      <td className="px-6 py-3"><Skeleton className="h-4 w-48" style={{ animationDelay: `${i * 100 + 30}ms` }} /></td>
                      <td className="px-6 py-3"><Skeleton className="h-5 w-12 rounded" style={{ animationDelay: `${i * 100 + 60}ms` }} /></td>
                      <td className="px-6 py-3"><Skeleton className="h-4 w-28" style={{ animationDelay: `${i * 100 + 90}ms` }} /></td>
                      <td className="px-6 py-3"><Skeleton className="h-4 w-20" style={{ animationDelay: `${i * 100 + 120}ms` }} /></td>
                      <td className="px-6 py-3"><Skeleton className="h-5 w-24 rounded-full" style={{ animationDelay: `${i * 100 + 150}ms` }} /></td>
                      <td className="px-6 py-3 text-right"><Skeleton className="h-8 w-32 ml-auto" style={{ animationDelay: `${i * 100 + 180}ms` }} /></td>
                    </tr>
                  ))
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState 
                        title="ไม่พบเอกสารจัดซื้อ" 
                        description="ยังไม่มีเอกสาร PR/PO ที่ตรงกับเงื่อนไขการค้นหาของคุณ หรือยังไม่ได้สร้างเอกสารใหม่"
                        actionLabel="สร้างเอกสารใหม่"
                        onAction={handleCreate}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 font-medium">{doc.document_number}</td>
                      <td className="px-6 py-3">{doc.title}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${doc.type === 'PR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{doc.type}</span>
                      </td>
                      <td className="px-6 py-3">{doc.supplier || '-'}</td>
                      <td className="px-6 py-3 font-medium">฿{Number(doc.total_amount).toLocaleString()}</td>
                      <td className="px-6 py-3">{getStatusBadge(doc.status)}</td>
                      <td className="px-6 py-3 text-right space-x-2">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

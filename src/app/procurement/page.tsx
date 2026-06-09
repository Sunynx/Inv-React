'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2, AlertTriangle, FileText, ShoppingCart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import ProcurementModal from '@/components/ProcurementModal';
import ProcurementReceiveModal from '@/components/ProcurementReceiveModal';
import PRPrintView from '@/components/PRPrintView';

export default function ProcurementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<any | null>(null);

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

  const filteredDocs = documents.filter(doc => 
    doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handlePrint = (doc: any) => {
    setPrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 500); // Give time for the component to render in DOM
  };

  const handleExportExcel = (doc: any) => {
    const meta = doc.metadata || {};
    const items = doc.items || [];
    
    // Create a simplified worksheet combining PR details and items
    const wsData = [
      ["PURCHASE REQUISITION FORM"],
      [],
      ["Department", meta.department || "", "", "Telephone", meta.telephone || ""],
      ["Date", new Date().toLocaleDateString('en-GB'), "", "Email", meta.email || ""],
      [],
      ["1. Reason for Purchase"],
      [meta.reason_for_purchase || ""],
      ["Date Required:", meta.date_required || ""],
      [],
      ["2. Description of Items"],
      ["QTY", "ITEM", "UNIT PRICE", "TOTAL"],
      ...items.map((i: any) => [i.quantity, i.name, i.price, (i.quantity * i.price)]),
      [],
      ["3. Total Cost", "THB:", doc.total_amount || 0],
      [],
      ["4. Budget Control", meta.budget_control || "", "Code:", meta.budget_code || ""],
      [],
      ["5. Summary of 3 Quotes"],
      [meta.quotes_summary || ""],
      ["If no 3 quotes, reason:", meta.no_quotes_reason || ""],
      [],
      ["6. Preferred Supplier", meta.preferred_supplier || ""],
      ["Quote THB:", meta.preferred_quote_thb || "", "Foreign:", meta.preferred_quote_foreign || ""],
      ["Reason if not lowest:", meta.not_lowest_reason || ""],
      [],
      ["7. Recommended Supplier", meta.recommended_supplier || ""],
      ["Final Price THB:", meta.recommended_price_thb || "", "Foreign:", meta.recommended_price_foreign || ""]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PR Form");
    XLSX.writeFile(wb, `${doc.document_number || 'PR'}.xlsx`);
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
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Create Request
        </Button>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
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
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredDocs.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No documents found.</td></tr>
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
                        {doc.status === 'สั่งซื้อแล้ว' && (
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

      {selectedDoc && (
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
      )}

      {/* Hidden print view injected into DOM when printing */}
      <PRPrintView document={printDoc} />
    </div>
  );
}

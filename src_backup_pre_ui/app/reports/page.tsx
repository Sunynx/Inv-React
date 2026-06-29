'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, PieChart, BarChart2, ShieldAlert, DownloadCloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReportExportModal from '@/components/ReportExportModal';

export default function ReportsPage() {
  const [summary, setSummary] = useState({ assets: 0, repairs: 0, stock: 0, audit: 0 });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [
        { count: aCount }, 
        { count: rCount },
        { count: sCount },
        { count: auCount }
      ] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('repair_tickets').select('*', { count: 'exact', head: true }),
        supabase.from('stock_transactions').select('*', { count: 'exact', head: true }),
        supabase.from('audit_log').select('*', { count: 'exact', head: true })
      ]);
      setSummary({ 
        assets: aCount || 0, 
        repairs: rCount || 0, 
        stock: sCount || 0,
        audit: auCount || 0
      });
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#1b365d] to-[#2a4d80] p-8 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-blue-100 mt-2 text-sm max-w-xl">
            Generate and export custom Excel or PDF reports across all modules. Filter by date range and select exactly what data you need.
          </p>
        </div>
        <Button 
          onClick={() => setIsExportModalOpen(true)}
          className="bg-white text-[#1b365d] hover:bg-gray-100 font-semibold px-6 py-6 h-auto shadow-md gap-2 rounded-xl transition-all hover:scale-105"
        >
          <DownloadCloud className="h-6 w-6" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm">Generate</span>
            <span className="text-lg">Custom Report</span>
          </div>
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold px-1">System Overview Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Asset Stat */}
          <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total IT Assets</p>
                  <p className="text-3xl font-bold">{summary.assets}</p>
                </div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Stat */}
          <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Repair Tickets</p>
                  <p className="text-3xl font-bold">{summary.repairs}</p>
                </div>
                <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                  <PieChart className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Stat */}
          <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Stock Transactions</p>
                  <p className="text-3xl font-bold">{summary.stock}</p>
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                  <BarChart2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Stat */}
          <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Audit Events</p>
                  <p className="text-3xl font-bold">{summary.audit}</p>
                </div>
                <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      <ReportExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />
    </div>
  );
}

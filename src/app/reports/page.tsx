'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, FileText, PieChart, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const [summary, setSummary] = useState({ assets: 0, repairs: 0, stockValue: 0 });

  useEffect(() => {
    async function loadData() {
      const [{ count: aCount }, { count: rCount }] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('repair_tickets').select('*', { count: 'exact', head: true })
      ]);
      setSummary({ assets: aCount || 0, repairs: rCount || 0, stockValue: 0 });
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate and export system reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Asset Report */}
        <Card className="shadow-sm border-border/60 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="text-blue-500" /> Asset Inventory Report</CardTitle>
            <CardDescription>Complete list of all assets and their current status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">{summary.assets} <span className="text-sm font-normal text-muted-foreground">Total Assets</span></div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </CardContent>
        </Card>

        {/* Maintenance Report */}
        <Card className="shadow-sm border-border/60 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="text-purple-500" /> Maintenance Report</CardTitle>
            <CardDescription>Repair history, downtime, and active tickets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">{summary.repairs} <span className="text-sm font-normal text-muted-foreground">Total Tickets</span></div>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </CardContent>
        </Card>

        {/* Stock Report */}
        <Card className="shadow-sm border-border/60 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 className="text-emerald-500" /> Stock Movement</CardTitle>
            <CardDescription>History of stock received and distributed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">--- <span className="text-sm font-normal text-muted-foreground">Transactions</span></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import * as Tabs from '@radix-ui/react-tabs';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList, LineChart, Line
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { 
  Download, Calendar, TrendingUp, TrendingDown, Clock, Activity, HardDrive, Wrench, Shield, Box, Search, Send, Bot, AlertCircle, Command, Filter
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { syncNotifications } from '@/lib/syncNotifications';
import DashboardKPICards from '@/components/DashboardKPICards';
import ReportExportModal from '@/components/ReportExportModal';
import Notifications from '@/components/Notifications';

export default function Dashboard() {
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<'all' | '30d' | '90d' | '1y'>('all');
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isAiLoading]);

  useEffect(() => {
    // Sync notifications automatically when dashboard loads
    syncNotifications();
  }, []);

  // ============ Keyboard Shortcut: Ctrl+K for Global Search ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============ Global Search: Debounced Search Effect ============
  useEffect(() => {
    if (globalSearch.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const term = `%${globalSearch}%`;
        
        const [assetsRes, stockRes, ticketsRes] = await Promise.all([
          supabase.from('assets')
            .select('id, name, asset_code, status, assigned_user')
            .or(`name.ilike.${term},asset_code.ilike.${term},assigned_user.ilike.${term},location.ilike.${term}`)
            .limit(5),
          supabase.from('stock_items')
            .select('id, name, sku, quantity')
            .or(`name.ilike.${term},sku.ilike.${term}`)
            .limit(3),
          supabase.from('repair_tickets')
            .select('id, title, status, assets(name)')
            .or(`title.ilike.${term},description.ilike.${term}`)
            .limit(3),
        ]);

        const results: any[] = [];
        
        (assetsRes.data || []).forEach(a => {
          results.push({
            type: 'Asset',
            id: a.id,
            title: a.name,
            subtitle: `${a.asset_code || ''} · ${a.status || ''} · ${a.assigned_user || 'ไม่ระบุผู้ใช้'}`,
            link: `/assets?highlight=${a.id}`,
          });
        });

        (stockRes.data || []).forEach(s => {
          results.push({
            type: 'Stock',
            id: s.id,
            title: s.name,
            subtitle: `SKU: ${s.sku || '-'} · คงเหลือ: ${s.quantity || 0}`,
            link: `/stock?highlight=${s.id}`,
          });
        });

        (ticketsRes.data || []).forEach(t => {
          results.push({
            type: 'Ticket',
            id: t.id,
            title: t.title,
            subtitle: `สถานะ: ${t.status || '-'} · ${(t as any).assets?.name || '-'}`,
            link: `/tickets?highlight=${t.id}`,
          });
        });

        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounceTimer);
  }, [globalSearch]);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard_data', dateRange],
    queryFn: async () => {
      const [assetsRes, deptsRes, catsRes, ticketsRes] = await Promise.all([
        supabase.from('assets').select('status, created_at, department_id, category_id, price, name, asset_code, model, cpu, ram, storage, purchase_date, warranty_expiry'),
        supabase.from('departments').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('repair_tickets').select(`*, assets(name)`).order('created_at', { ascending: false })
      ]);

      let assets = assetsRes.data || [];
      const depts = deptsRes.data || [];
      const cats = catsRes.data || [];
      let tickets = ticketsRes.data || [];

      if (dateRange !== 'all') {
        const now = new Date();
        const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
        const cutoff = subDays(now, days);
        assets = assets.filter(a => isAfter(new Date(a.created_at || a.purchase_date || now), cutoff));
        tickets = tickets.filter(t => isAfter(new Date(t.created_at || now), cutoff));
      }

      // Calculate Stats
      const t = assets.length;
      const a = assets.filter(x => x.status === 'ใช้งาน').length;
      const r = assets.filter(x => x.status === 'ส่งซ่อม').length;
      const s = assets.filter(x => x.status === 'สำรอง').length;
      
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      const newAssetsThisWeek = assets.filter(x => new Date(x.created_at) >= oneWeekAgo).length;
      const newTicketsThisWeek = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo).length;
      
      // Calculate % change from last month
      const assetsThisMonth = assets.filter(x => new Date(x.created_at) >= oneMonthAgo).length;
      const assetsLastMonth = assets.filter(x => {
        const d = new Date(x.created_at);
        return d >= twoMonthsAgo && d < oneMonthAgo;
      }).length;
      const fromLastMonth = assetsLastMonth > 0 
        ? Math.round(((assetsThisMonth - assetsLastMonth) / assetsLastMonth) * 100) 
        : assetsThisMonth > 0 ? 100 : 0;

      const activeRate = t > 0 ? Math.round((a / t) * 100) : 0;
      const spareRate = t > 0 ? Math.round((s / t) * 100) : 0;
      const repairRate = t > 0 ? Math.round((r / t) * 100) : 0;

      const statsObj = { 
        total: t, 
        active: a, 
        repair: r, 
        spare: s,
        newAssetsThisWeek,
        newTicketsThisWeek,
        activeRate,
        spareRate,
        repairRate,
        fromLastMonth
      };

      // Chart Data
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const realData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthYear = `${monthNames[d.getMonth()]}`;
        const addedInMonth = assets.filter(x => {
          const assetDate = new Date(x.created_at);
          return assetDate.getMonth() === d.getMonth() && assetDate.getFullYear() === d.getFullYear();
        }).length;
        const retiredInMonth = assets.filter(x => {
          const assetDate = new Date(x.created_at);
          return assetDate.getMonth() === d.getMonth() && assetDate.getFullYear() === d.getFullYear() && (x.status === 'ชำรุด' || x.status === 'จำหน่าย');
        }).length;
        realData.push({ name: monthYear, added: addedInMonth, retired: retiredInMonth });
      }

      // Dept Stats
      const deptStats = depts.map(d => {
        const deptAssets = assets.filter(a => a.department_id === d.id);
        const totalValue = deptAssets.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
        return {
          ...d,
          assetCount: deptAssets.length,
          totalValue: totalValue
        };
      }).sort((a, b) => b.assetCount - a.assetCount);

      // Cat Stats
      const catStats = cats.map(c => ({
        name: c.name,
        value: assets.filter(a => a.category_id === c.id).length
      })).filter(c => c.value > 0);

      // Tickets by Priority
      const pendingTickets = tickets.filter(t => t.status !== 'เสร็จสิ้น' && t.status !== 'ยกเลิก');
      const priorityCount: Record<string, number> = { 'ต่ำ': 0, 'ปกติ': 0, 'สูง': 0, 'เร่งด่วน': 0 };
      pendingTickets.forEach(t => {
        if (t.priority && priorityCount[t.priority] !== undefined) {
          priorityCount[t.priority]++;
        } else if (t.priority) {
          priorityCount[t.priority] = 1;
        }
      });
      const priorityStats = Object.keys(priorityCount).map(k => ({ name: k, value: priorityCount[k] })).filter(p => p.value > 0);

      // Category breakdown per department
      const deptCatBreakdown = depts.map(d => {
        const dAssets = assets.filter(a => a.department_id === d.id);
        if (dAssets.length === 0) return null;
        
        const catCounts: Record<string, number> = {};
        dAssets.forEach(a => {
          const cat = cats.find(c => c.id === a.category_id)?.name || 'ไม่ระบุ';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        
        const catStr = Object.entries(catCounts).map(([k, v]) => `${k}(${v})`).join(', ');
        return `${d.name}: ${catStr}`;
      }).filter(Boolean);

      // Asset Details for AI
      const assetDetailsList = assets.map(a => {
        const specs = [a.model, a.cpu, a.ram, a.storage].filter(Boolean).join(', ');
        return `- [${a.asset_code || 'ไม่มีรหัส'}] ${a.name || 'ไม่ระบุชื่อ'} ${specs ? `(สเปค: ${specs})` : ''} - แผนก: ${depts.find(d => d.id === a.department_id)?.name || '-'} - สถานะ: ${a.status}`;
      });
      const assetDetailsStr = assetDetailsList.length > 0 ? assetDetailsList.join('\n') : 'ไม่มีข้อมูล';

      // Warranty Alerts
      const expiringAssets = assets.map(a => {
        if (!a.warranty_expiry) return null;
        const expDate = new Date(a.warranty_expiry);
        const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (daysLeft <= 30 && a.status !== 'จำหน่าย' && a.status !== 'ชำรุด') {
          return { ...a, daysLeft, expDate };
        }
        return null;
      }).filter(Boolean).sort((a: any, b: any) => a.daysLeft - b.daysLeft);

      return {
        stats: statsObj,
        chartData: realData,
        departments: deptStats,
        categoriesStats: catStats,
        repairs: tickets.slice(0, 5),
        priorityStats: priorityStats,
        deptCatBreakdown: deptCatBreakdown,
        assetDetailsStr: assetDetailsStr,
        expiringAssets: expiringAssets
      };
    },
    enabled: !!dateRange
  });

  const stats = dashboardData?.stats || { total: 0, active: 0, repair: 0, spare: 0, fromLastMonth: 0, newAssetsThisWeek: 0, newTicketsThisWeek: 0, activeRate: 0, spareRate: 0, repairRate: 0 };
  const chartData = dashboardData?.chartData || [];
  const departments = dashboardData?.departments || [];
  const categoriesStats = dashboardData?.categoriesStats || [];
  const repairs = dashboardData?.repairs || [];
  const priorityStats = dashboardData?.priorityStats || [];
  const deptCatBreakdown = dashboardData?.deptCatBreakdown || [];
  const assetDetailsStr = dashboardData?.assetDetailsStr || '';
  const recentAssets = dashboardData?.recentAssets || [];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-6 mb-6">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of your IT assets and operations</p>
        </div>
        
        <div className="flex-1 max-w-md relative w-full sm:mx-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            ref={searchInputRef}
            placeholder="Global search (Assets, Stock, Tickets)..." 
            className="pl-10 pr-16 h-10 bg-white/60 dark:bg-slate-900/60 border-slate-200/60 shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all w-full rounded-xl"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Command size={10} />K
          </kbd>
          
          {/* Search Results Dropdown */}
          {globalSearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto transition-colors duration-300">
              {isSearching ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-sm text-center text-slate-500">No results found for &quot;{globalSearch}&quot;</div>
              ) : (
                <ul className="py-2">
                  {searchResults.map((res, i) => (
                    <li key={`${res.type}-${res.id}-${i}`}>
                      <button 
                        onClick={() => { router.push(res.link); setGlobalSearch(''); }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 outline-none flex flex-col transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{res.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            res.type === 'Asset' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                            res.type === 'Stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          }`}>{res.type}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{res.subtitle || 'No details'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl flex">
            {[
              { id: 'all', label: 'All Time' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: '1y', label: '1 Year' },
            ].map(range => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateRange === range.id 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-9 rounded-xl bg-white shadow-sm border-slate-200 hover:bg-slate-50 transition-all" onClick={() => setIsExportModalOpen(true)}>
            <Download className="mr-2 h-4 w-4 text-slate-500" /> Export
          </Button>
        </div>
      </div>

      {/* Tabs System */}
      <Tabs.Root defaultValue="overview" className="flex flex-col gap-6">
        <Tabs.List className="flex flex-wrap gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-xl w-full sm:w-fit border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
          <Tabs.Trigger value="overview" className="px-5 py-2 text-sm font-semibold rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-all outline-none">
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="px-5 py-2 text-sm font-semibold rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-all outline-none">
            Analytics
          </Tabs.Trigger>
          <Tabs.Trigger value="reports" className="px-5 py-2 text-sm font-semibold rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-all outline-none">
            Reports
          </Tabs.Trigger>
          <Tabs.Trigger value="notifications" className="px-5 py-2 text-sm font-semibold rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-all outline-none">
            Notifications
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="space-y-6 outline-none">
          {/* KPI Cards — extracted component with skeleton */}
          <DashboardKPICards stats={stats as any} isLoading={isLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Area Chart */}
            <Card className="lg:col-span-2 shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Asset Acquisition Activity - Monthly</CardTitle>
                <p className="text-sm text-muted-foreground">Showing total assets added vs retired for the last 6 months</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full mt-4 rounded-lg" />
                ) : (
                  <ChartContainer 
                    config={{
                      added: { label: "Added", color: "#3b82f6" },
                      retired: { label: "Retired", color: "#f43f5e" }
                    }} 
                    className="h-[300px] w-full mt-4"
                  >
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillAdded" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-added)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--color-added)" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="fillRetired" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-retired)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--color-retired)" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} horizontal={true} strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={8} />
                      <YAxis axisLine={false} tickLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="added" stroke="var(--color-added)" fill="url(#fillAdded)" />
                      <Area type="monotone" dataKey="retired" stroke="var(--color-retired)" fill="url(#fillRetired)" />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart Summary */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
                <p className="text-sm text-muted-foreground">Current distribution of assets</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3 mt-4">
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-[200px] w-full rounded-lg mt-6" />
                  </div>
                ) : (
                  <>
                    <div className="mt-4 mb-2">
                      <p className="text-3xl font-bold">{stats.total}</p>
                      <p className={`text-sm font-medium ${stats.fromLastMonth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stats.fromLastMonth >= 0 ? '+' : ''}{stats.fromLastMonth}% from last month
                      </p>
                    </div>
                    <ChartContainer 
                      config={{
                        value: { label: "Assets", color: "#10b981" }
                      }} 
                      className="h-[200px] w-full mt-6"
                    >
                      <BarChart data={[
                        { name: 'Active', value: stats.active, fill: "#10b981" },
                        { name: 'Spare', value: stats.spare, fill: "#f59e0b" },
                        { name: 'Repair', value: stats.repair, fill: "#ef4444" }
                      ]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                        <Bar 
                          dataKey="value" 
                          radius={[4, 4, 0, 0]} 
                          barSize={40} 
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(data: any) => {
                            if (!data || !data.name) return;
                            const statusMap: Record<string, string> = { 'Active': 'ใช้งาน', 'Spare': 'สำรอง', 'Repair': 'ส่งซ่อม' };
                            const mappedStatus = statusMap[data.name];
                            if (mappedStatus) {
                              router.push(`/assets?status=${mappedStatus}`);
                            }
                          }}
                        />
                      </BarChart>
                    </ChartContainer>
                  </>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tickets by Priority */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Pending Tickets by Priority</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Active repair requests</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full rounded-lg" />
                ) : priorityStats.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No pending tickets.</div>
                ) : (
                  <ChartContainer 
                    config={{
                      'เร่งด่วน': { label: 'Critical', color: '#ef4444' },
                      'สูง': { label: 'High', color: '#f97316' },
                      'ปกติ': { label: 'Medium', color: '#eab308' },
                      'ต่ำ': { label: 'Low', color: '#3b82f6' }
                    }}
                    className="h-[250px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={priorityStats.map(p => ({ ...p, fill: `var(--color-${p.name})` }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={80}
                        paddingAngle={3}
                        stroke="var(--background)"
                        strokeWidth={3}
                      />
                      <ChartLegend content={<ChartLegendContent />} className="mt-4" />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent Tickets Table */}
            <Card className="lg:col-span-2 shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Repair Tickets</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Manage recent support requests.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>View All</Button>
              </CardHeader>
              <CardContent>
                <div className="border border-border/60 rounded-md overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Asset</th>
                        <th className="px-4 py-3 font-medium">Issue</th>
                        <th className="px-4 py-3 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {isLoading ? (
                        [...Array(3)].map((_, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                            <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          </tr>
                        ))
                      ) : repairs.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent tickets.</td></tr>
                      ) : (
                        repairs.map(r => (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  r.status === 'เสร็จสิ้น' ? 'bg-emerald-500' :
                                  r.status === 'ยกเลิก' ? 'bg-gray-400' : 'bg-amber-500'
                                }`} />
                                <span className="font-medium text-foreground">{r.status}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{r.assets?.name || '-'}</td>
                            <td className="px-4 py-3 truncate max-w-[200px]">{((r.description || '').replace(/<!--COMMENTS-->[\s\S]*/, '').trim()) || r.title}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {format(new Date(r.created_at), 'dd MMM yyyy')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Assets by Department */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Top Departments</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Departments with the most IT assets.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Skeleton className="h-4 w-8 ml-auto" />
                        <Skeleton className="h-3 w-12 ml-auto" />
                      </div>
                    </div>
                  ))
                ) : departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No departments found.</p>
                ) : (
                  departments.slice(0,4).map((dept, idx) => {
                    const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700'];
                    const color = colors[idx % colors.length];
                    const initials = dept.name.substring(0, 2).toUpperCase();
                    return (
                      <div key={dept.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center font-bold text-sm`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{dept.name}</p>
                            <p className="text-xs text-muted-foreground">Department</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{dept.assetCount}</p>
                          <p className="text-xs text-muted-foreground">Assets</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Warranty Alerts */}
            <Card className="shadow-sm border-amber-200/60 bg-gradient-to-br from-amber-50/30 to-orange-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800">
                  <AlertCircle size={18} />
                  Warranty Alerts
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Expiring within 30 days or expired</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="flex flex-col gap-1.5 border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                      <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                  ))
                ) : dashboardData?.expiringAssets?.length === 0 ? (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">No expiring warranties.</div>
                ) : (
                  dashboardData?.expiringAssets?.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.daysLeft <= 0 ? 'bg-red-100 text-red-700 font-semibold' : 'bg-amber-100 text-amber-800'}`}>
                          {a.daysLeft <= 0 ? 'Expired' : `${a.daysLeft} days left`}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{a.asset_code}</span>
                        <span>Exp: {format(new Date(a.expDate), 'dd MMM yyyy')}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

          </div>
        </Tabs.Content>

        <Tabs.Content value="analytics" className="space-y-6 outline-none">
          {/* AI Chat Interface */}
          <Card className="border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/30 to-indigo-50/30">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-900">
                <Bot size={18} className="text-blue-600" /> AI Inventory Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="h-[200px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-10">
                    ถามคำถามเกี่ยวกับสินทรัพย์ เช่น &quot;แผนกไหนมีการส่งซ่อมบ่อยที่สุด?&quot;
                  </p>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`text-sm px-4 py-2 max-w-[85%] rounded-2xl ${
                        msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border border-border/50 text-foreground rounded-bl-none shadow-sm'
                      }`}>
                        {msg.role === 'ai' ? (
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.text.split(/(\*\*.*?\*\*)/g).map((part, idx) => 
                              part.startsWith('**') && part.endsWith('**') 
                                ? <strong key={idx} className="font-semibold text-blue-900">{part.slice(2, -2)}</strong> 
                                : <span key={idx}>{part}</span>
                            )}
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="text-sm px-4 py-2 rounded-2xl bg-card border border-border/50 rounded-bl-none shadow-sm flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="flex gap-2">
                <Input 
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask about your inventory..." 
                  className="bg-background transition-colors"
                  onKeyDown={e => {
                    if (e.key === 'Enter') document.getElementById('btn-send-ai')?.click();
                  }}
                />
                <Button 
                  id="btn-send-ai"
                  disabled={!chatInput.trim() || isAiLoading}
                  onClick={async () => {
                    const q = chatInput.trim();
                    if (!q) return;
                    setChatInput('');
                    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
                    setIsAiLoading(true);

                    try {
                      const apiMessages = [
                        ...chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
                        { role: 'user', content: q }
                      ];

                      const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          messages: apiMessages
                        })
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error.message || 'API Error');
                      
                      const reply = data.choices?.[0]?.message?.content || 'ไม่สามารถตอบคำถามได้';
                      setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
                    } catch (e: any) {
                      setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}` }]);
                    } finally {
                      setIsAiLoading(false);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  <Send size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pie Chart: Categories */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Assets by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                ) : (
                  <ChartContainer 
                    config={categoriesStats.reduce((acc, curr, idx) => {
                      const safeId = curr.name.replace(/[^a-zA-Z0-9]/g, '');
                      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#84cc16', '#eab308', '#d946ef', '#f43f5e', '#0ea5e9'];
                      return { ...acc, [safeId]: { label: curr.name, color: palette[idx % palette.length] } };
                    }, {} as Record<string, any>)}
                    className="h-[300px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={categoriesStats.map(c => ({ 
                          ...c, 
                          safeId: c.name.replace(/[^a-zA-Z0-9]/g, ''),
                          fill: `var(--color-${c.name.replace(/[^a-zA-Z0-9]/g, '')})` 
                        }))}
                        dataKey="value"
                        nameKey="safeId"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke="var(--background)"
                        strokeWidth={3}
                        onClick={(data) => { 
                          if (data && data.name) {
                            router.push('/assets?category=' + encodeURIComponent(data.name));
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <ChartLegend content={<ChartLegendContent />} className="flex-wrap" />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Horizontal Bar Chart: Departments */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Assets by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                ) : (
                  <ChartContainer 
                    config={{
                      assets: { label: "Assets", color: "#8b5cf6" }
                    }}
                    className="h-[300px] w-full"
                  >
                    <BarChart
                      layout="vertical"
                      data={departments.filter(d => d.assetCount > 0).slice(0, 5).map(d => ({ name: d.name.substring(0, 15), fullName: d.name, assets: d.assetCount }))}
                      margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                      <Bar 
                        dataKey="assets" 
                        fill="var(--color-assets)" 
                        radius={[0, 4, 4, 0]} 
                        barSize={24}
                        onClick={(data) => {
                          if (data && data.fullName) {
                            router.push('/assets?department=' + encodeURIComponent(data.fullName));
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <LabelList dataKey="assets" position="right" fontSize={12} fill="#6b7280" />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Total Value by Department */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Value by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                ) : (
                  <ChartContainer 
                    config={{
                      value: { label: "Value (฿)", color: "#ec4899" }
                    }}
                    className="h-[300px] w-full"
                  >
                    <BarChart
                      data={departments.filter(d => d.totalValue > 0).sort((a,b) => b.totalValue - a.totalValue).slice(0, 5).map(d => ({ name: d.name.substring(0, 10), fullName: d.name, value: d.totalValue }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                      <Bar 
                        dataKey="value" 
                        fill="var(--color-value)" 
                        radius={[4, 4, 0, 0]} 
                        barSize={30}
                        onClick={(data) => {
                          if (data && data.fullName) {
                            router.push('/assets?department=' + encodeURIComponent(data.fullName));
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <LabelList dataKey="value" position="top" fontSize={10} fill="#6b7280" formatter={(val: number) => `฿${val.toLocaleString()}`} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Line Chart: Asset Trend */}
            <Card className="md:col-span-3 shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Asset Acquisition Trend (Line Chart)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Monthly trend of new assets added to the inventory.</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                ) : (
                  <ChartContainer 
                    config={{
                      added: { label: "Assets Added", color: "#3b82f6" }
                    }}
                    className="h-[300px] w-full"
                  >
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                      <Line type="monotone" dataKey="added" stroke="var(--color-added)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs.Content>

        {/* ============ Reports Tab — Now wired to ReportExportModal ============ */}
        <Tabs.Content value="reports" className="space-y-6 outline-none">
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Custom Reports</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Generate and download reports in Excel or PDF format.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Asset Inventory', desc: 'Complete list of all IT assets', types: ['assets'] },
                  { label: 'Repair Tickets', desc: 'All repair and support tickets', types: ['tickets'] },
                  { label: 'Stock Movements', desc: 'Stock transaction history', types: ['stock'] },
                  { label: 'Full Report', desc: 'All data combined', types: ['assets', 'tickets', 'stock', 'audit'] },
                ].map((report, i) => (
                  <button
                    key={i}
                    onClick={() => setIsExportModalOpen(true)}
                    className="text-left p-5 rounded-xl border border-border/60 bg-card hover:bg-muted/30 hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Download size={20} />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">{report.label}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{report.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* ============ Notifications Tab — Now shows inline notification list ============ */}
        <Tabs.Content value="notifications" className="space-y-6 outline-none">
          <NotificationsInlinePanel />
        </Tabs.Content>
      </Tabs.Root>

      {/* Report Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}

// ============ Inline Notifications Panel for Dashboard Tab ============
function NotificationsInlinePanel() {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) return [];
      return data || [];
    },
  });

  const getColor = (severity: string) => {
    switch(severity) {
      case 'error': case 'danger': return 'text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400';
      case 'info': return 'text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400';
      default: return 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500" />
          Alerts & Notifications
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Recent system notifications and alerts.</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <Activity size={32} />
            </div>
            <h3 className="text-lg font-bold">All caught up!</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              No new critical alerts. All systems operational and asset thresholds are within normal limits.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {notifications.map((n: any) => (
              <div key={n.id} className={`flex items-start gap-3 py-4 first:pt-0 last:pb-0 ${!n.is_read ? 'bg-primary/5 -mx-6 px-6 rounded-lg' : ''}`}>
                <div className={`p-2 rounded-full shrink-0 ${getColor(n.severity)}`}>
                  <AlertCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {n.created_at ? format(new Date(n.created_at), 'dd MMM yyyy HH:mm') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

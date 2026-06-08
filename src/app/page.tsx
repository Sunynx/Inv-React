'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as Tabs from '@radix-ui/react-tabs';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { 
  Download, Calendar, TrendingUp, TrendingDown, Clock, Activity, HardDrive, Wrench, Shield, Box, Search, Send, Bot, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isAiLoading]);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard_data'],
    queryFn: async () => {
      const [assetsRes, deptsRes, catsRes, ticketsRes] = await Promise.all([
        supabase.from('assets').select('status, created_at, department_id, category_id, price, name, asset_code, model, cpu, ram, storage, purchase_date, warranty_expiry'),
        supabase.from('departments').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('repair_tickets').select(`*, assets(name)`).order('created_at', { ascending: false })
      ]);

      const assets = assetsRes.data || [];
      const depts = deptsRes.data || [];
      const cats = catsRes.data || [];
      const tickets = ticketsRes.data || [];

      // Calculate Stats
      const t = assets.length;
      const a = assets.filter(x => x.status === 'ใช้งาน').length;
      const r = assets.filter(x => x.status === 'ส่งซ่อม').length;
      const s = assets.filter(x => x.status === 'สำรอง').length;
      
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const totalLastMonth = assets.filter(x => new Date(x.created_at) < lastMonth).length;
      const diff = t - totalLastMonth;
      const pct = totalLastMonth > 0 ? (diff / totalLastMonth) * 100 : 100;
      
      const statsObj = { total: t, active: a, repair: r, spare: s, fromLastMonth: parseFloat(pct.toFixed(1)) };

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
          return assetDate.getMonth() === d.getMonth() && assetDate.getFullYear() === d.getFullYear() && (x.status === 'สูญหาย' || x.status === 'แทงจำหน่าย');
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
      const pendingTickets = tickets.filter(t => t.status !== 'ซ่อมสำเร็จ' && t.status !== 'ยกเลิก');
      const priorityCount: Record<string, number> = { 'ต่ำ': 0, 'ปานกลาง': 0, 'สูง': 0, 'ด่วนมาก': 0 };
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
        if (daysLeft <= 30 && a.status !== 'แทงจำหน่าย' && a.status !== 'สูญหาย') {
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
    }
  });

  const stats = dashboardData?.stats || { total: 0, active: 0, repair: 0, spare: 0, fromLastMonth: 0 };
  const chartData = dashboardData?.chartData || [];
  const departments = dashboardData?.departments || [];
  const categoriesStats = dashboardData?.categoriesStats || [];
  const repairs = dashboardData?.repairs || [];
  const priorityStats = dashboardData?.priorityStats || [];
  const deptCatBreakdown = dashboardData?.deptCatBreakdown || [];
  const assetDetailsStr = dashboardData?.assetDetailsStr || '';

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        
        <div className="flex-1 max-w-md relative w-full sm:mx-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Global search (Assets, Stock, Tickets)..." 
            className="pl-10 bg-background/50 focus:bg-background transition-colors w-full"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          
          {/* Search Results Dropdown */}
          {globalSearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/60 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto transition-colors duration-300">
              {isSearching ? (
                <div className="p-4 text-sm text-center text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted-foreground">No results found for "{globalSearch}"</div>
              ) : (
                <ul className="py-2">
                  {searchResults.map((res, i) => (
                    <li key={`${res.type}-${res.id}-${i}`}>
                      <button 
                        onClick={() => router.push(res.link)}
                        className="w-full text-left px-4 py-2 hover:bg-muted/50 focus:bg-muted/50 outline-none flex flex-col transition-colors"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-sm text-foreground truncate">{res.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            res.type === 'Asset' ? 'bg-blue-100 text-blue-700' :
                            res.type === 'Stock' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{res.type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate mt-0.5">{res.subtitle || 'No details'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button variant="outline" size="sm" className="h-9">
            <Calendar className="mr-2 h-4 w-4" /> Pick a date
          </Button>
        </div>
      </div>

      {/* Tabs System */}
      <Tabs.Root defaultValue="overview" className="flex flex-col gap-6">
        <Tabs.List className="flex space-x-1 bg-secondary/30 p-1 rounded-md w-fit border border-border/50">
          <Tabs.Trigger value="overview" className="px-4 py-1.5 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50 transition-all outline-none">
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="px-4 py-1.5 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50 transition-all outline-none">
            Analytics
          </Tabs.Trigger>
          <Tabs.Trigger value="reports" className="px-4 py-1.5 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50 transition-all outline-none">
            Reports
          </Tabs.Trigger>
          <Tabs.Trigger value="notifications" className="px-4 py-1.5 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50 transition-all outline-none">
            Notifications
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="space-y-6 outline-none">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assets */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <HardDrive size={14} /> Total Assets
                    </p>
                    <p className="text-3xl font-bold">{isLoading ? '...' : stats.total}</p>
                    <p className="text-xs text-muted-foreground">Since Last week</p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-full">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span className="flex items-center text-emerald-600 font-medium">
                    15.54% <TrendingUp size={14} className="ml-1" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Active Assets */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Shield size={14} /> Active Assets
                    </p>
                    <p className="text-3xl font-bold">{isLoading ? '...' : stats.active}</p>
                    <p className="text-xs text-muted-foreground">Since Last week</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span className="flex items-center text-emerald-600 font-medium">
                    10.2% <TrendingUp size={14} className="ml-1" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Repairing */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench size={14} /> In Repair
                    </p>
                    <p className="text-3xl font-bold">{isLoading ? '...' : stats.repair}</p>
                    <p className="text-xs text-muted-foreground">Since Last week</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span className="flex items-center text-red-600 font-medium">
                    4.1% <TrendingDown size={14} className="ml-1" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Spare */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Box size={14} /> Spare Units
                    </p>
                    <p className="text-3xl font-bold">{isLoading ? '...' : stats.spare}</p>
                    <p className="text-xs text-muted-foreground">Since Last week</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span className="flex items-center text-emerald-600 font-medium">
                    2.5% <TrendingUp size={14} className="ml-1" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Area Chart */}
            <Card className="lg:col-span-2 shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Asset Acquisition Activity - Monthly</CardTitle>
                <p className="text-sm text-muted-foreground">Showing total assets added vs retired for the last 6 months</p>
              </CardHeader>
              <CardContent>
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
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis axisLine={false} tickLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="added" stroke="var(--color-added)" fill="url(#fillAdded)" />
                    <Area type="monotone" dataKey="retired" stroke="var(--color-retired)" fill="url(#fillRetired)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Bar Chart Summary */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
                <p className="text-sm text-muted-foreground">Current distribution of assets</p>
              </CardHeader>
              <CardContent>
                <div className="mt-4 mb-2">
                  <p className="text-3xl font-bold">{isLoading ? '...' : stats.total}</p>
                  <p className="text-sm text-emerald-600 font-medium">+{stats.fromLastMonth}% from last month</p>
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
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ChartContainer>
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
                {priorityStats.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No pending tickets.</div>
                ) : (
                  <ChartContainer 
                    config={{
                      'ด่วนมาก': { label: 'Critical', color: '#ef4444' },
                      'สูง': { label: 'High', color: '#f97316' },
                      'ปานกลาง': { label: 'Medium', color: '#eab308' },
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
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
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
                <div className="border border-border/60 rounded-md overflow-hidden">
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
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                      ) : repairs.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent tickets.</td></tr>
                      ) : (
                        repairs.map(r => (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  r.status === 'ซ่อมสำเร็จ' ? 'bg-emerald-500' :
                                  r.status === 'ยกเลิก' ? 'bg-gray-400' : 'bg-amber-500'
                                }`} />
                                <span className="font-medium text-foreground">{r.status}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{r.assets?.name || '-'}</td>
                            <td className="px-4 py-3 truncate max-w-[200px]">{r.issue_description}</td>
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
                  <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
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
                  <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
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
                    ถามคำถามเกี่ยวกับสินทรัพย์ เช่น "แผนกไหนมีการส่งซ่อมบ่อยที่สุด?"
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
                      // Fetch full database context just-in-time
                      const [
                        allAssetsRes,
                        licensesRes,
                        maintenanceRes,
                        stockRes
                      ] = await Promise.all([
                        supabase.from('assets').select('*, departments(name), categories(name)'),
                        supabase.from('licenses').select('*'),
                        supabase.from('maintenance_schedules').select('*, assets(name)'),
                        supabase.from('stock_items').select('*')
                      ]);

                      const allAssets = allAssetsRes.data || [];
                      const licenses = licensesRes.data || [];
                      const maintenance = maintenanceRes.data || [];
                      const stock = stockRes.data || [];

                      const assetsFullStr = allAssets.map(a => 
                        `- [${a.asset_code||'-'}] ${a.name||'-'} (แผนก: ${a.departments?.name||'-'}, หมวด: ${a.categories?.name||'-'}) ` +
                        `| สถานะ: ${a.status||'-'} | สถานที่: ${a.location||'-'} | ผู้ถือครอง: ${a.assigned_user||'-'} | IP: ${a.ip_address||'-'} ` +
                        `| สเปค: ${[a.model, a.cpu, a.ram, a.storage].filter(Boolean).join(', ')||'-'} | ราคา: ฿${a.price||0}`
                      ).join('\n');

                      const licensesStr = licenses.map(l => 
                        `- ${l.software_name} (Key: ${l.license_key||'-'}) | วันหมดอายุ: ${l.expiration_date||'-'} | สถานะ: ${l.status||'-'}`
                      ).join('\n');

                      const maintenanceStr = maintenance.map(m => 
                        `- ${m.maintenance_type} สำหรับ ${m.assets?.name||'อุปกรณ์'} | กำหนดการ: ${m.scheduled_date||'-'} | สถานะ: ${m.status||'-'} | หมายเหตุ: ${m.notes||'-'}`
                      ).join('\n');

                      const stockStr = stock.map(s => 
                        `- ${s.name} | คงเหลือ: ${s.quantity} ${s.unit} (ขั้นต่ำ: ${s.min_stock||0})`
                      ).join('\n');

                      const recentIssues = repairs.length > 0 ? repairs.map(t => `- ${t.assets?.name || 'อุปกรณ์'}: ${t.issue_description} (สถานะ: ${t.status})`).join('\n') : 'ไม่มี';
                      const deptStr = departments.slice(0, 5).map(d => `${d.name} (${d.assetCount} รายการ, มูลค่า ฿${d.totalValue.toLocaleString()})`).join(', ');
                      const priorityStr = priorityStats.map(p => `${p.name}: ${p.value}`).join(', ');

                      const systemPrompt = `คุณคือ AI Inventory Assistant ผู้ช่วยส่วนตัวสำหรับระบบจัดการทรัพย์สินไอที (IT Asset Management) ขององค์กร
หน้าที่ของคุณคือตอบคำถามด้วยข้อมูลจากฐานข้อมูลทั้งหมดอย่างแม่นยำ เป็นมิตร และกระชับ

--- สถิติภาพรวม ---
- ทรัพย์สินทั้งหมด: ${stats.total} รายการ (ใช้งานอยู่ ${stats.active}, ส่งซ่อม ${stats.repair}, สำรอง ${stats.spare})
- 5 แผนกที่มีทรัพย์สินเยอะสุด: ${deptStr || '-'}
- งานซ่อมแยกตามความสำคัญ: ${priorityStr || '-'}
- รายการซ่อมล่าสุด:\n${recentIssues}

--- ข้อมูลในฐานข้อมูลทั้งหมด (สำหรับใช้ค้นหาและตอบคำถามเชิงลึก) ---
1. รายการทรัพย์สิน (Assets) พร้อมรายละเอียด สเปค ผู้ถือครอง สถานที่ และราคา:
${assetsFullStr || 'ไม่มีข้อมูล'}

2. ลิขสิทธิ์ซอฟต์แวร์ (Licenses):
${licensesStr || 'ไม่มีข้อมูล'}

3. รอบซ่อมบำรุง (Maintenance):
${maintenanceStr || 'ไม่มีข้อมูล'}

4. รายการสต๊อกอะไหล่ (Stock Items):
${stockStr || 'ไม่มีข้อมูล'}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทย ใช้ Bullet point หรือ Emoji เพื่อให้อ่านง่าย
2. หากผู้ใช้ถามถึงอุปกรณ์ รายชื่อพนักงานที่ถือครอง สเปค ไอพีแอดเดรส (IP) ราคา หรือสต๊อกอะไหล่ ให้ค้นหาจากข้อมูลด้านบนแล้วตอบให้ตรงประเด็นที่สุด
3. หากคำถามอยู่นอกเหนือจากข้อมูลที่มี ให้ตอบสุภาพว่า "ตรวจสอบจากฐานข้อมูลแล้ว ไม่พบข้อมูลดังกล่าวครับ"`;

                      const apiMessages = [
                        { role: 'system', content: systemPrompt },
                        ...chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
                        { role: 'user', content: q }
                      ];

                      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
                          'HTTP-Referer': window.location.origin,
                          'X-Title': 'IT Inventory System',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          model: 'google/gemini-2.5-flash',
                          messages: apiMessages,
                          max_tokens: 3000,
                          temperature: 0.3
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
                      innerRadius={0}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({percent}: any) => percent ? `${(percent * 100).toFixed(0)}%` : null}
                    />
                    <ChartLegend content={<ChartLegendContent />} className="flex-wrap" />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Horizontal Bar Chart: Departments */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Assets by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer 
                  config={{
                    assets: { label: "Assets", color: "#8b5cf6" }
                  }}
                  className="h-[300px] w-full"
                >
                  <BarChart
                    layout="vertical"
                    data={departments.filter(d => d.assetCount > 0).slice(0, 5).map(d => ({ name: d.name.substring(0, 15), assets: d.assetCount }))}
                    margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                    <Bar dataKey="assets" fill="var(--color-assets)" radius={[0, 4, 4, 0]} barSize={24}>
                      <LabelList dataKey="assets" position="right" fontSize={12} fill="#6b7280" />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Total Value by Department */}
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Value by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer 
                  config={{
                    value: { label: "Value (฿)", color: "#ec4899" }
                  }}
                  className="h-[300px] w-full"
                >
                  <BarChart
                    data={departments.filter(d => d.totalValue > 0).sort((a,b) => b.totalValue - a.totalValue).slice(0, 5).map(d => ({ name: d.name.substring(0, 10), value: d.totalValue }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} barSize={30}>
                      <LabelList dataKey="value" position="top" fontSize={10} fill="#6b7280" formatter={(val: number) => `฿${val.toLocaleString()}`} />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="reports" className="space-y-6 outline-none">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Download size={32} />
              </div>
              <h3 className="text-lg font-bold">Custom Reports Module</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Select your preferred metrics, generate PDF/Excel reports, and schedule automated emails to department heads.
              </p>
              <Button className="mt-6" variant="outline">Request Feature Access</Button>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="notifications" className="space-y-6 outline-none">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                <Activity size={32} />
              </div>
              <h3 className="text-lg font-bold">Alerts & Notifications</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                No new critical alerts. All systems operational and asset thresholds are within normal limits.
              </p>
              <Button className="mt-6" variant="outline">Configure Alert Rules</Button>
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

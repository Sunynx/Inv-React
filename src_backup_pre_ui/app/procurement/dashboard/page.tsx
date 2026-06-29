'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { FileText, DollarSign, ShoppingCart, Loader2, TrendingUp, Package } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function PRDashboardPage() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['procurement_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // 1. KPIs
  const totalPRs = documents.length;
  const pendingAmount = documents
    .filter(d => d.status === 'รอดำเนินการ')
    .reduce((sum, d) => sum + (Number(d.total_amount) || 0), 0);
  const orderedAmount = documents
    .filter(d => d.status === 'สั่งซื้อแล้ว' || d.status === 'รับของบางส่วน' || d.status === 'ได้รับของแล้ว')
    .reduce((sum, d) => sum + (Number(d.total_amount) || 0), 0);

  // 2. Monthly Spend (Bar Chart)
  // group by YYYY-MM
  const monthlyDataMap: Record<string, number> = {};
  documents.forEach(d => {
    if (d.status !== 'ยกเลิก' && d.created_at) {
      const monthYear = format(parseISO(d.created_at), 'MMM yyyy', { locale: th });
      if (!monthlyDataMap[monthYear]) monthlyDataMap[monthYear] = 0;
      monthlyDataMap[monthYear] += (Number(d.total_amount) || 0);
    }
  });
  const monthlyData = Object.keys(monthlyDataMap).map(key => ({
    name: key,
    total: monthlyDataMap[key]
  }));

  // 3. Department Spend (Pie Chart)
  const deptDataMap: Record<string, number> = {};
  documents.forEach(d => {
    if (d.status !== 'ยกเลิก' && d.metadata?.department) {
      const dept = d.metadata.department || 'Unknown';
      if (!deptDataMap[dept]) deptDataMap[dept] = 0;
      deptDataMap[dept] += (Number(d.total_amount) || 0);
    }
  });
  const deptData = Object.keys(deptDataMap).map(key => ({
    name: key,
    value: deptDataMap[key]
  })).sort((a, b) => b.value - a.value);

  // 4. Status Distribution (Donut Chart)
  const statusMap: Record<string, number> = {};
  documents.forEach(d => {
    const s = d.status || 'Unknown';
    if (!statusMap[s]) statusMap[s] = 0;
    statusMap[s] += 1;
  });
  const statusData = Object.keys(statusMap).map(key => ({
    name: key,
    value: statusMap[key]
  })).sort((a, b) => b.value - a.value);

  const STATUS_COLORS: Record<string, string> = {
    'รอดำเนินการ': '#f59e0b',
    'สั่งซื้อแล้ว': '#3b82f6',
    'รับของบางส่วน': '#8b5cf6',
    'ได้รับของแล้ว': '#10b981',
    'ยกเลิก': '#ef4444'
  };

  // 4.1 Top 5 Items (Horizontal Bar)
  const itemMap: Record<string, number> = {};
  documents.forEach(d => {
    if (d.status !== 'ยกเลิก' && Array.isArray(d.items)) {
      d.items.forEach((item: any) => {
        if (item.name) {
          const qty = Number(item.quantity) || 1;
          const cleanName = String(item.name).trim();
          if (!itemMap[cleanName]) itemMap[cleanName] = 0;
          itemMap[cleanName] += qty;
        }
      });
    }
  });
  const topItemsData = Object.keys(itemMap).map(key => ({
    name: key,
    count: itemMap[key]
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  // 5. Volume over time
  const monthlyVolumeMap: Record<string, number> = {};
  documents.forEach(d => {
    if (d.created_at) {
      const monthYear = format(parseISO(d.created_at), 'MMM yyyy', { locale: th });
      if (!monthlyVolumeMap[monthYear]) monthlyVolumeMap[monthYear] = 0;
      monthlyVolumeMap[monthYear] += 1;
    }
  });
  const volumeData = Object.keys(monthlyVolumeMap).map(key => ({
    name: key,
    count: monthlyVolumeMap[key]
  }));

  // 6. Top High-Value PRs
  const topPRs = [...documents]
    .filter(d => d.status !== 'ยกเลิก')
    .sort((a, b) => (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">PR Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">ภาพรวมการจัดซื้อและเบิกจ่ายงบประมาณเชิงลึก</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">คำขอ PR ทั้งหมด</CardTitle>
            <FileText className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPRs} <span className="text-base font-normal text-muted-foreground">รายการ</span></div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">ยอดเงินรออนุมัติ (Pending)</CardTitle>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">฿{pendingAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">ยอดสั่งซื้อสะสม (Ordered)</CardTitle>
            <ShoppingCart className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">฿{orderedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base">ยอดจัดซื้อรายเดือน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} tickFormatter={(val) => `฿${(val/1000)}k`} />
                    <RechartsTooltip cursor={{ fill: '#f4f4f5' }} formatter={(val: number) => [`฿${val.toLocaleString()}`, 'ยอดจัดซื้อ']} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PieChart className="w-4 h-4 text-gray-500" /> สัดส่วนการใช้งบแยกตามแผนก</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deptData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                    >
                      {deptData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => [`฿${val.toLocaleString()}`, 'ยอดรวม']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution Donut Chart */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PieChart className="w-4 h-4 text-gray-500" /> สัดส่วนสถานะใบสั่งซื้อ (Status)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => [`${val.toLocaleString()} รายการ`, 'จำนวน']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Most Purchased Items */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-gray-500" /> Top 5 สินค้า/บริการที่สั่งซื้อบ่อยสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {topItemsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItemsData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#666' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#333' }} width={120} />
                    <RechartsTooltip cursor={{ fill: '#f4f4f5' }} formatter={(val: number) => [`${val.toLocaleString()} ชิ้น`, 'จำนวนที่สั่ง']} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูลสินค้า</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PR Volume Trend */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-500" /> แนวโน้มจำนวนใบสั่งซื้อ (ใบ)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#666' }} dy={10} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#666' }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(val: number) => [val, 'จำนวนใบสั่งซื้อ']} />
                    <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 High-Value PRs */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-500" /> Top 5 รายการจัดซื้อมูลค่าสูงสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              {topItemsData.length === 0 && topPRs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">ไม่มีข้อมูล</div>
              ) : topPRs.map((pr, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-medium truncate" title={pr.title}>{pr.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{pr.document_number}</span>
                      <span className="border border-gray-200 text-gray-600 rounded-full text-[9px] h-4 px-2 flex items-center">{pr.metadata?.department || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-800">฿{(Number(pr.total_amount) || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-emerald-600">{pr.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

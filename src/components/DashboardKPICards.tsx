'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, AlertCircle, Activity, HardDrive, Wrench, Shield, Box } from 'lucide-react';

interface DashboardStats {
  total: number;
  active: number;
  repair: number;
  spare: number;
  newAssetsThisWeek: number;
  newTicketsThisWeek: number;
  activeRate: number;
  spareRate: number;
  repairRate: number;
  fromLastMonth: number;
}

export function KPICardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="shadow-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-900">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardKPICards({ stats, isLoading }: { stats: DashboardStats; isLoading: boolean }) {
  if (isLoading) return <KPICardsSkeleton />;

  const cards = [
    {
      label: 'Total Assets',
      value: stats.total,
      subtitle: 'Overall system assets',
      footerLabel: 'New this week',
      footerValue: `+${stats.newAssetsThisWeek || 0}`,
      footerIcon: <TrendingUp size={14} className="ml-1" />,
      footerColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
      iconBg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30',
      icon: <Activity size={24} />,
      labelIcon: <HardDrive size={16} className="text-blue-500" />,
    },
    {
      label: 'Active Assets',
      value: stats.active,
      subtitle: 'Currently deployed',
      footerLabel: 'Active Rate',
      footerValue: `${stats.activeRate || 0}%`,
      footerIcon: null,
      footerColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
      iconBg: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30',
      icon: <Activity size={24} />,
      labelIcon: <Shield size={16} className="text-emerald-500" />,
    },
    {
      label: 'In Repair',
      value: stats.repair,
      subtitle: 'Currently down',
      footerLabel: 'New tickets (7d)',
      footerValue: `+${stats.newTicketsThisWeek || 0}`,
      footerIcon: <AlertCircle size={14} className="ml-1" />,
      footerColor: 'text-red-600 bg-red-50 dark:bg-red-500/10',
      iconBg: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/30',
      icon: <Wrench size={24} />,
      labelIcon: <Wrench size={16} className="text-red-500" />,
    },
    {
      label: 'Spare Units',
      value: stats.spare,
      subtitle: 'Ready to deploy',
      footerLabel: 'Spare Ratio',
      footerValue: `${stats.spareRate || 0}%`,
      footerIcon: null,
      footerColor: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
      iconBg: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30',
      icon: <Box size={24} />,
      labelIcon: <Box size={16} className="text-amber-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <Card key={i} className="shadow-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-300">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  {card.labelIcon} {card.label}
                </p>
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{card.value}</p>
                <p className="text-xs text-slate-400">{card.subtitle}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${card.iconBg} rounded-xl shadow-sm border`}>
                {card.icon}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{card.footerLabel}</span>
              <span className={`flex items-center ${card.footerColor} px-2 py-0.5 rounded-full font-bold`}>
                {card.footerValue} {card.footerIcon}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

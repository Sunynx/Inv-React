'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, Box, QrCode, ScanLine, Wrench, Shield, 
  ArrowRightLeft, Key, CalendarClock, Package, FileBarChart, 
  History, Settings, ChevronRight, Menu, ShoppingCart, ClipboardList, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Playfair_Display } from 'next/font/google';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ThemeToggle from './ThemeToggle';
import Notifications from './Notifications';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'] });

const menuGroups = [
  {
    title: 'General',
    links: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Assets', href: '/assets', icon: Box },
      { name: 'QR Code', href: '/qrcode', icon: QrCode },
      { name: 'Scan Asset', href: '/scan', icon: ScanLine },
    ]
  },
  {
    title: 'Maintenance',
    links: [
      { name: 'Tickets', href: '/tickets', icon: Wrench },
      { name: 'Maintenance (PM)', href: '/maintenance', icon: CalendarClock },
      { name: 'Warranty', href: '/warranty', icon: Shield },
    ]
  },
  {
    title: 'Operations',
    links: [
      { name: 'Transfers', href: '/transfers', icon: ArrowRightLeft },
      { name: 'Checkouts', href: '/checkouts', icon: ClipboardList },
      { name: 'Licenses', href: '/licenses', icon: Key },
      { name: 'Stock', href: '/stock', icon: Package },
    ]
  },
  {
    title: 'Procurement',
    links: [
      { name: 'PR Dashboard', href: '/procurement/dashboard', icon: TrendingUp },
      { name: 'PR List', href: '/procurement', icon: ShoppingCart },
    ]
  },
  {
    title: 'Other',
    links: [
      { name: 'Reports', href: '/reports', icon: FileBarChart },
      { name: 'Audit Log', href: '/audit-log', icon: History },
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
}
];

const SidebarContent = ({ pathname, setOpen }: { pathname: string, setOpen: (open: boolean) => void }) => (
    <div className="flex flex-col h-full bg-[#1e345d] text-white/90">
      {/* Brand Header */}
      <div className="h-24 flex items-center justify-center border-b border-white/10 shrink-0">
        <img src="/rpm-logo.png" alt="RPM Logo" className="h-12 w-auto object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="mb-4">
            <h3 className="px-3 mb-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              {group.title}
            </h3>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive 
                          ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10" 
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                        <span>{link.name}</span>
                      </div>

                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile Area (Footer) */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/10 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs shrink-0">
            IT
          </div>
          <div className="flex-1 min-w-0 flex items-center h-full">
            <p className="text-sm font-medium text-white tracking-wider">IT Admin</p>
          </div>
        </div>
      </div>
    </div>
  );

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);


  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-[#1e345d] border-r border-[#1e345d] min-h-screen flex-col fixed inset-y-0 left-0 z-40 print:hidden">
        <SidebarContent pathname={pathname} setOpen={setOpen} />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1e345d] z-40 flex items-center px-4 justify-between shadow-sm border-b border-white/10">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-lg text-white hover:bg-white/10 transition-colors">
            <Menu size={24} />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-none bg-transparent">
            <SidebarContent pathname={pathname} setOpen={setOpen} />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-1 pr-2">
          <div className="text-white/80 flex items-center">
            <ThemeToggle />
            <Notifications />
          </div>
          <img src="/rpm-logo.png" alt="RPM Logo" className="h-8 w-auto object-contain ml-2" />
        </div>
      </div>
    </>
  );
}

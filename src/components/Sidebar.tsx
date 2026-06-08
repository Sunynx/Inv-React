'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, Box, QrCode, ScanLine, Wrench, Shield, 
  ArrowRightLeft, Key, CalendarClock, Package, FileBarChart, 
  History, Settings, ChevronRight, Menu
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
      { name: 'Licenses', href: '/licenses', icon: Key },
      { name: 'Stock', href: '/stock', icon: Package },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1b365d] text-white/90">
      {/* Brand Header */}
      <div className="h-24 flex items-center px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn("text-4xl tracking-tighter text-white", playfair.className)}>
            rpm
          </div>
          <div className="flex flex-col border-l border-white/30 pl-3 leading-tight tracking-[0.15em] text-[8px] font-medium text-white uppercase opacity-90">
            <span>Royal</span>
            <span>Phuket</span>
            <span>Marina</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="mb-6">
            <h3 className="px-3 mb-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-white/15 text-white shadow-sm" 
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        <span>{link.name}</span>
                      </div>
                      {isActive && <ChevronRight size={14} className="text-white/40 opacity-50" />}
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
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin User</p>
            <p className="text-xs text-white/60 truncate">admin@rpm.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-[#1b365d] border-r border-[#1b365d] min-h-screen flex-col fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1b365d] z-40 flex items-center px-4 justify-between shadow-md border-b border-white/10">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" />}>
            <Menu size={24} />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-none bg-transparent">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-1 pr-2">
          <div className="text-white/80 flex items-center">
            <ThemeToggle />
            <Notifications />
          </div>
          <div className={cn("text-2xl tracking-tighter text-white ml-2", playfair.className)}>
            rpm
          </div>
        </div>
      </div>
    </>
  );
}

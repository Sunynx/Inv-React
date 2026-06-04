'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Box, QrCode, ScanLine, Wrench, Shield, ArrowRightLeft, Key, CalendarClock, Package, FileBarChart, History, Settings } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Assets', href: '/assets', icon: Box },
    { name: 'QR Code', href: '/qrcode', icon: QrCode },
    { name: 'Scan Asset', href: '/scan', icon: ScanLine },
    { name: 'Tickets', href: '/tickets', icon: Wrench },
    { name: 'Warranty', href: '/warranty', icon: Shield },
    { name: 'Transfers', href: '/transfers', icon: ArrowRightLeft },
    { name: 'Licenses', href: '/licenses', icon: Key },
    { name: 'Maintenance (PM)', href: '/maintenance', icon: CalendarClock },
    { name: 'Stock', href: '/stock', icon: Package },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'Audit Log', href: '/audit-log', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col fixed inset-y-0 left-0">
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold">
          QR
        </div>
        <h1 className="text-xl font-bold tracking-wider">AssetQR</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span>{link.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

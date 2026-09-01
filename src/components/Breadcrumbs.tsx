'use client';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const routeNames: Record<string, string> = {
  '': 'Dashboard',
  'assets': 'Assets',
  'qrcode': 'QR Code',
  'scan': 'Scan Asset',
  'tickets': 'Tickets',
  'maintenance': 'Maintenance',
  'warranty': 'Warranty',
  'transfers': 'Transfers',
  'checkouts': 'Checkouts',
  'licenses': 'Licenses',
  'stock': 'Stock',
  'procurement': 'Procurement',
  'dashboard': 'Dashboard',
  'reports': 'Reports',
  'audit-log': 'Audit Log',
  'settings': 'Settings',
  'login': 'Login',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <Home size={14} className="text-slate-400" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">Dashboard</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <a 
        href="/" 
        onClick={(e) => {
          e.preventDefault();
          router.push('/');
          setTimeout(() => { if (window.location.pathname !== '/') window.location.href = '/'; }, 400);
        }}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <Home size={14} />
      </a>
      {segments.map((segment, idx) => {
        const href = '/' + segments.slice(0, idx + 1).join('/');
        const isLast = idx === segments.length - 1;
        const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />
            {isLast ? (
              <span className="font-semibold text-slate-700 dark:text-slate-200">{name}</span>
            ) : (
              <a 
                href={href} 
                onClick={(e) => {
                  e.preventDefault();
                  router.push(href);
                  setTimeout(() => { if (window.location.pathname !== href) window.location.href = href; }, 400);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium"
              >
                {name}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}

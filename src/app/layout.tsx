import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Notifications from '@/components/Notifications';
import ThemeToggle from '@/components/ThemeToggle';
import Providers from '@/components/Providers';
import AIAssistant from '@/components/AIAssistant';
import ErrorBoundary from '@/components/ErrorBoundary';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Toaster } from 'react-hot-toast';
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AssetQR - IT Asset Inventory System',
  description: 'Manage IT Assets with ease',
};

export const viewport: import('next').Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-background text-foreground transition-colors duration-300`}>
        <Providers>
          <Toaster position="top-right" />
          <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-64 min-w-0 transition-all duration-300">
              {/* Global Top Header for Desktop */}
              <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <Breadcrumbs />
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <Notifications />
                </div>
              </header>
              <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </div>
          </div>
          <AIAssistant />
        </Providers>
        <Script id="suppress-analytics-error" strategy="beforeInteractive">
          {`
            window.addEventListener('error', function(e) {
              if (e.message && (e.message.includes("reading 'startTime'") || e.message.includes("reportAllChanges"))) {
                e.stopImmediatePropagation();
                e.preventDefault();
              }
            });
          `}
        </Script>
        <Analytics />
      </body>
    </html>
  );
}

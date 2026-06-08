import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Notifications from '@/components/Notifications';
import ThemeToggle from '@/components/ThemeToggle';
import Providers from '@/components/Providers';
import { Toaster } from 'react-hot-toast';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AssetQR - IT Asset Inventory System',
  description: 'Manage IT Assets with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground transition-colors duration-300`}>
        <Providers>
          <Toaster position="top-right" />
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-64">
              {/* Global Top Header for Desktop */}
              <header className="hidden md:flex h-16 items-center justify-end px-8 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Notifications />
                </div>
              </header>
              <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

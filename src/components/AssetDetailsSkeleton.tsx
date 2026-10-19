import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function AssetDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col animate-in fade-in duration-200">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ArrowLeft size={16} />
          <span>กลับไปหน้ารวมอุปกรณ์</span>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col">
        {/* Title Bar */}
        <div className="p-6 pb-5 border-b border-border bg-muted/10 rounded-t-xl mt-4 mx-4 sm:mx-6 lg:mx-8 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 mx-4 sm:mx-6 lg:mx-8 mb-8 space-y-8 flex-1 bg-card rounded-b-xl border border-t-0 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
            <div className="space-y-4">
              <Skeleton className="h-4 w-24 rounded" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-3/4 rounded-md" />
              </div>
            </div>

            <div className="space-y-4">
              <Skeleton className="h-4 w-24 rounded" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-3/4 rounded-md" />
              </div>
            </div>

            <div className="space-y-4">
              <Skeleton className="h-4 w-24 rounded" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-1/2 rounded-md" />
              </div>
            </div>

            <div className="space-y-4">
              <Skeleton className="h-4 w-24 rounded" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

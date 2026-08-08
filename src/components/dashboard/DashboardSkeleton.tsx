import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="pb-36 md:pb-28 animate-fade-in">
      {/* Priority Actions Header Skeleton */}
      <div className="px-4 pt-4 pb-3 md:px-6 md:pt-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>

        {/* Priority Order Cards Skeleton */}
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1.5" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-6 w-20 mb-1.5" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <Skeleton className="h-4 w-40 mb-1.5" />
                <Skeleton className="h-3 w-28 mb-2" />
                <Skeleton className="h-3 w-full mb-3" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Section Skeleton */}
      <div className="px-4 py-3 md:px-6 border-t border-border mt-2">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Search Skeleton */}
        <div className="mb-3 flex gap-2">
          <Skeleton className="flex-1 h-10 rounded-xl" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>

        {/* Transaction List Skeleton */}
        <div className="flex flex-col gap-2 pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 mb-1.5" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Stats Skeleton */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-[280px] bg-card border-t border-border px-4 py-3 z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <Skeleton className="h-3 w-16 mb-1.5" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-14 h-8 rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-9 w-full rounded-lg mt-2" />
      </footer>
    </div>
  );
}

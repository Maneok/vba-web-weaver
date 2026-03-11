import { cn } from "@/lib/utils";

function ShimmerBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md skeleton-shimmer", className)}
      {...props}
    />
  );
}

/** Skeleton matching KPICard layout */
export function SkeletonKPI() {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <ShimmerBlock className="w-9 h-9 rounded-xl" />
        <ShimmerBlock className="h-3 w-24 rounded" />
      </div>
      <div className="flex items-end justify-between">
        <ShimmerBlock className="h-8 w-16 rounded" />
        <ShimmerBlock className="h-7 w-16 rounded" />
      </div>
    </div>
  );
}

/** Skeleton for area/line chart panels */
export function SkeletonChart() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <ShimmerBlock className="h-4 w-48 rounded" />
        <ShimmerBlock className="h-7 w-24 rounded" />
      </div>
      <div className="h-64 relative overflow-hidden rounded-xl">
        <ShimmerBlock className="absolute inset-0" />
        {/* Mimic chart bars */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-4 pb-4">
          {[40, 65, 50, 80, 55, 70, 45, 75, 60, 85, 50, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t skeleton-shimmer"
              style={{ height: `${h}%`, opacity: 0.4 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for table rows */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <ShimmerBlock className="h-4 w-36 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <ShimmerBlock className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-3 w-3/4 rounded" />
            <ShimmerBlock className="h-2.5 w-1/2 rounded" />
          </div>
          <ShimmerBlock className="h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for donut/pie chart panels */
export function SkeletonDonut() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <ShimmerBlock className="h-4 w-40 rounded mb-4" />
      <ShimmerBlock className="w-48 h-48 mx-auto rounded-full" />
      <div className="flex justify-center gap-4 mt-3">
        <ShimmerBlock className="h-3 w-16 rounded" />
        <ShimmerBlock className="h-3 w-16 rounded" />
        <ShimmerBlock className="h-3 w-16 rounded" />
      </div>
    </div>
  );
}

/** Skeleton for text blocks */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock
          key={i}
          className="h-3 rounded"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

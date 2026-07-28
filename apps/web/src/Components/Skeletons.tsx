
export const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-muted/40 ${className}`} />
);

export const PopularSkeleton = () => (
  <div className="grid gap-5 2xl:grid-cols-2" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_26px_-14px_rgb(15_23_42/0.2)] dark:border-border dark:shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3 dark:border-border/70">
            <SkeletonBox className="h-5 w-40" />
            <SkeletonBox className="h-8 w-8 rounded-full" />
          </div>
          <div className="grid gap-4 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4 dark:rounded-xl">
                <SkeletonBox className="h-3 w-28" />
                <div className="flex items-start gap-3">
                  <SkeletonBox className="h-16 w-16 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBox className="h-5 w-36" />
                    <SkeletonBox className="h-6 w-28 rounded-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SkeletonBox className="h-16 rounded-xl" />
                  <SkeletonBox className="h-16 rounded-xl" />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-transparent bg-muted/65 p-3 dark:rounded-xl dark:border-border/70 dark:bg-background/60 xl:col-span-3">
              <SkeletonBox className="h-3 w-32 mb-3" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2 shadow-[0_1px_1px_rgb(15_23_42/0.04)] dark:rounded-xl dark:border-border/70 dark:bg-card/60 dark:shadow-none">
                  <div className="flex items-center gap-3">
                    <SkeletonBox className="h-10 w-10 rounded-lg" />
                    <div className="space-y-1.5">
                      <SkeletonBox className="h-3.5 w-28" />
                      <SkeletonBox className="h-3 w-20" />
                    </div>
                  </div>
                  <SkeletonBox className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
  </div>
);

export const ProvincesSkeleton = () => (
  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3 dark:border-border/70">
            <SkeletonBox className="h-5 w-36" />
            <div className="flex gap-2">
              <SkeletonBox className="h-6 w-20 rounded-full" />
              <SkeletonBox className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-muted/55 dark:border-border/70 dark:bg-background/50">
            <div className="flex justify-between bg-muted/70 px-3 py-2 dark:bg-background/90">
              <SkeletonBox className="h-3 w-12" />
              <SkeletonBox className="h-3 w-14" />
              <SkeletonBox className="h-3 w-14" />
            </div>
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between border-t border-border bg-card px-3 py-2 dark:border-border/60 dark:bg-transparent">
                <div className="flex items-center gap-2">
                  <SkeletonBox className="h-7 w-7 rounded-full" />
                  <SkeletonBox className="h-3.5 w-24" />
                </div>
                <div className="flex gap-6">
                  <SkeletonBox className="h-3.5 w-8" />
                  <SkeletonBox className="h-3.5 w-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
  </div>
);

export const PartiesSkeleton = () => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-hidden="true">
      <div className="overflow-hidden rounded-xl border border-border bg-muted/55 dark:border-border/70 dark:bg-background/50">
        <div className="flex justify-between bg-muted/70 px-3 py-2 dark:bg-background/90">
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-14" />
          <SkeletonBox className="h-3 w-14" />
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
          <div key={j} className="flex items-center justify-between border-t border-border bg-card px-3 py-2.5 dark:border-border/60 dark:bg-transparent">
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-7 w-7 rounded-full" />
              <SkeletonBox className="h-3.5 w-32" />
            </div>
            <div className="flex gap-6">
              <SkeletonBox className="h-3.5 w-8" />
              <SkeletonBox className="h-3.5 w-8" />
            </div>
          </div>
        ))}
      </div>
  </div>
);

export const ConstituencySkeleton = () => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-hidden="true">
      <div className="mb-4 space-y-2 border-b border-border pb-3 dark:border-border/70">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-3 w-64" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/55 dark:border-border/70 dark:bg-background/50">
        <div className="flex justify-between bg-muted/70 px-3 py-2 dark:bg-background/90">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-8" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((j) => (
          <div key={j} className="flex items-center justify-between border-t border-border bg-card px-3 py-2.5 dark:border-border/60 dark:bg-transparent">
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-8 w-8 rounded-full" />
              <SkeletonBox className="h-3.5 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-7 w-7 rounded-full" />
              <SkeletonBox className="h-3.5 w-24" />
            </div>
            <SkeletonBox className="h-3.5 w-14" />
            <SkeletonBox className="h-3.5 w-10" />
          </div>
        ))}
      </div>
  </div>
);

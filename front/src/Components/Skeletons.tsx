
export const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-muted/40 ${className}`} />
);

export const SkeletonText = ({ className = "", lines = 1 }: { className?: string; lines?: number }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-3.5 animate-pulse rounded-md bg-muted/40"
        style={{ width: i === lines - 1 && lines > 1 ? "60%" : "100%" }}
      />
    ))}
  </div>
);

export const SkeletonHeader = () => (
  <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex-1 space-y-3">
        <SkeletonBox className="h-3 w-32" />
        <SkeletonBox className="h-7 w-64" />
        <SkeletonBox className="h-3.5 w-80" />
      </div>
      <SkeletonBox className="h-16 w-40 rounded-xl" />
    </div>
    <div className="mt-4">
      <SkeletonBox className="h-10 w-full rounded-xl" />
    </div>
  </header>
);

export const PopularSkeleton = () => (
  <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <SkeletonHeader />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/75 p-4">
          <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
            <SkeletonBox className="h-5 w-40" />
            <SkeletonBox className="h-8 w-8 rounded-full" />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-primary/20 bg-card/90 p-4 space-y-3">
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
            <div className="rounded-xl border border-border/70 bg-background/60 p-3 lg:col-span-3 space-y-2">
              <SkeletonBox className="h-3 w-32 mb-3" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-3 py-2">
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
  </div>
);

export const ProvincesSkeleton = () => (
  <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <SkeletonHeader />
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/75 p-4">
          <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
            <SkeletonBox className="h-5 w-36" />
            <div className="flex gap-2">
              <SkeletonBox className="h-6 w-20 rounded-full" />
              <SkeletonBox className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/50 overflow-hidden">
            <div className="bg-background/90 px-3 py-2 flex justify-between">
              <SkeletonBox className="h-3 w-12" />
              <SkeletonBox className="h-3 w-14" />
              <SkeletonBox className="h-3 w-14" />
            </div>
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between border-t border-border/60 px-3 py-2">
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
  </div>
);

export const PartiesSkeleton = () => (
  <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <SkeletonHeader />
    <div className="rounded-2xl border border-border bg-card/75 p-4">
      <div className="rounded-xl border border-border/70 bg-background/50 overflow-hidden">
        <div className="bg-background/90 px-3 py-2 flex justify-between">
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-14" />
          <SkeletonBox className="h-3 w-14" />
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
          <div key={j} className="flex items-center justify-between border-t border-border/60 px-3 py-2.5">
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
  </div>
);

export const ConstituencySkeleton = () => (
  <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 space-y-3">
          <SkeletonBox className="h-3 w-32" />
          <SkeletonBox className="h-7 w-52" />
          <SkeletonBox className="h-3.5 w-72" />
        </div>
        <SkeletonBox className="h-16 w-40 rounded-xl" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SkeletonBox className="h-10 rounded-xl" />
        <SkeletonBox className="h-10 rounded-xl" />
        <SkeletonBox className="h-10 rounded-xl" />
      </div>
    </header>
    <div className="rounded-2xl border border-border bg-card/75 p-4">
      <div className="mb-4 border-b border-border/70 pb-3 space-y-2">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-3 w-64" />
      </div>
      <div className="rounded-xl border border-border/70 bg-background/50 overflow-hidden">
        <div className="bg-background/90 px-3 py-2 flex justify-between">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-8" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((j) => (
          <div key={j} className="flex items-center justify-between border-t border-border/60 px-3 py-2.5">
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
  </div>
);

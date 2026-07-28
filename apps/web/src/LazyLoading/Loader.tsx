
const Loader = () => {
  return (
    <main className="min-h-[calc(100svh-4.5rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/60 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_18px_46px_-32px_rgb(15_23_42/0.3)] sm:p-6 dark:rounded-xl dark:border-border dark:bg-card dark:bg-none dark:shadow-sm">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-brand/45 to-transparent dark:hidden" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="h-3 w-32 animate-pulse rounded-md bg-muted/40" />
              <div className="h-7 w-64 animate-pulse rounded-xl bg-muted/40" />
              <div className="h-3.5 w-80 animate-pulse rounded-md bg-muted/40" />
            </div>
            <div className="h-16 w-40 animate-pulse rounded-xl bg-muted/40" />
          </div>
          <div className="mt-4">
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
          </div>
        </header>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </main>
  );
};

export default Loader;


const Loader = () => {
  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
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
          <div key={i} className="h-48 animate-pulse rounded-2xl border border-border bg-card/75" />
        ))}
      </div>
    </main>
  );
};

export default Loader;


import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <main className="min-h-[calc(100svh-4.5rem)] bg-background text-foreground">
    <div className="mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-[1600px] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card px-5 py-14 text-center shadow-sm sm:px-10">
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-[clamp(6rem,28vw,12rem)] font-black leading-none tracking-tighter text-muted/35">
          404
        </p>

        <div className="relative flex flex-col items-center gap-4">
          <div className="rounded-full border border-border bg-card px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
            Page not found
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Nothing here
          </h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/popular"
              className="rounded-lg border border-foreground bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-85"
            >
              Popular Candidates
            </Link>
            <Link
              to="/provinces"
              className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Provinces
            </Link>
            <Link
              to="/parties"
              className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Parties
            </Link>
            <Link
              to="/constituency"
              className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Constituency
            </Link>
          </div>
        </div>
      </div>
    </div>
  </main>
);

export default NotFoundPage;

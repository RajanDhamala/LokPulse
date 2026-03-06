import { Link } from "react-router-dom";
import AppMenu from "@/Components/AppMenu";

const NotFoundPage = () => (
  <main className="dark min-h-screen bg-background text-foreground">
    <AppMenu />
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="relative mx-auto max-w-md text-center">
        {/* large 404 number */}
        <p className="select-none text-[10rem] font-black leading-none tracking-tighter text-muted/20">
          404
        </p>

        {/* overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="rounded-full border border-border bg-card/90 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
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
              className="rounded-xl border border-primary bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              Popular Candidates
            </Link>
            <Link
              to="/provinces"
              className="rounded-xl border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Provinces
            </Link>
            <Link
              to="/parties"
              className="rounded-xl border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Parties
            </Link>
            <Link
              to="/constituency"
              className="rounded-xl border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
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

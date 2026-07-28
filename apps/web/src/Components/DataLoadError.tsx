import { RefreshCw, ServerOff } from "lucide-react";

interface DataLoadErrorProps {
  title: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

const DataLoadError = ({
  title,
  onRetry,
  isRetrying = false,
  compact = false,
}: DataLoadErrorProps) => (
  <section
    role="alert"
    className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-sm ${
      compact ? "p-4" : "p-5 sm:p-6"
    }`}
  >
    <span
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand via-brand/35 to-transparent"
    />
    <div className={`flex items-start ${compact ? "gap-3" : "gap-4"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <ServerOff className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand dark:text-muted-foreground">
          Temporary service interruption
        </p>
        <h2 className={`mt-1 font-semibold text-foreground ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          The results server may be restarting or temporarily offline. Please try again in a
          moment, or visit again shortly.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Trying again…" : "Try again"}
          </button>
        ) : null}
      </div>
    </div>
  </section>
);

export default DataLoadError;

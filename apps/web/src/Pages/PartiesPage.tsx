import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import { FINAL_RESULTS_PUBLISHED_LABEL } from "@/lib/time";
import { Clock3, SearchX } from "lucide-react";
import DataLoadError from "@/Components/DataLoadError";
import { PartiesSkeleton } from "@/Components/Skeletons";

interface PartyResult {
  partyName: string;
  partyImage: string | null;
  elected: number;
  electedText: string;
  leading: number;
  leadingText: string;
}

interface PartyStatusResponse {
  title: string;
  extractedAt: string;
  lastScraped: string | null;
  cacheUpdatedAt?: string | null;
  count: number;
  parties: PartyResult[];
}

const PARTY_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";

const PartiesPage = () => {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, isFetching, refetch } = useQuery<PartyStatusResponse>({
    queryKey: ["party-status"],
    queryFn: () => api.get("/elections/party-status", { showErrorToast: false }),
    staleTime: Infinity
  });

  const normalizedQuery = search.trim().toLowerCase();
  const filteredParties = useMemo(() => {
    if (!data?.parties?.length) return [];
    if (!normalizedQuery) return data.parties;
    return data.parties.filter((party) => {
      const searchable = [party.partyName, party.electedText, party.leadingText, String(party.elected), String(party.leading)]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [data?.parties, normalizedQuery]);

  const maxElected = useMemo(
    () => Math.max(1, ...(data?.parties?.map((party) => party.elected) ?? [1])),
    [data?.parties]
  );
  const partyRanks = useMemo(
    () => new Map(data?.parties?.map((party, index) => [party.partyName, index + 1]) ?? []),
    [data?.parties]
  );

  return (
    <main className="min-h-[calc(100svh-4.5rem)] min-w-0 overflow-x-clip">
      <div className="mx-auto min-w-0 w-full max-w-[1600px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/60 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_18px_46px_-32px_rgb(15_23_42/0.3)] sm:p-6 dark:rounded-xl dark:border-border dark:bg-card dark:bg-none dark:shadow-sm">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-brand/45 to-transparent dark:hidden" />
          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand dark:text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand dark:hidden" />
                Election Dashboard
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight md:text-3xl">{data?.title || "पार्टीगत नतिजा"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Whole Nepal party-wise elected and leading counts.</p>
            </div>
            <div className="w-full rounded-xl border border-border bg-secondary/70 px-3 py-2 text-left shadow-sm dark:bg-muted/60 sm:w-auto sm:text-right">
              <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Final archive
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {FINAL_RESULTS_PUBLISHED_LABEL}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search party or counts..."
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 dark:bg-background dark:shadow-none"
            />
            <div className="flex items-center rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/40 sm:whitespace-nowrap">
              Showing {filteredParties.length} of {data?.count || 0} parties
            </div>
          </div>
        </header>

        {isLoading ? <PartiesSkeleton /> : null}

        {isError ? (
          <DataLoadError
            title="Party results are temporarily unavailable"
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : null}

        {!isLoading && !isError && filteredParties.length ? (
          <section className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="grid gap-2 sm:hidden">
              {filteredParties.map((party) => (
                <article key={`${party.partyName}-mobile`} className="min-w-0 rounded-lg border border-border bg-muted/55 p-3 dark:bg-muted/25">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
                      {partyRanks.get(party.partyName)}
                    </span>
                    <img
                      src={party.partyImage || PARTY_FALLBACK}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">{party.partyName}</h2>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${Math.max(2, (party.elected / maxElected) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0 rounded-md border border-border bg-card p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                      <dt className="text-muted-foreground">Elected</dt>
                      <dd className="mt-1 text-lg font-semibold">{party.electedText || party.elected}</dd>
                    </div>
                    <div className="min-w-0 rounded-md border border-border bg-card p-2 text-right shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                      <dt className="text-muted-foreground">Leading</dt>
                      <dd className="mt-1 text-lg font-semibold">{party.leadingText || party.leading}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border bg-muted/55 dark:bg-muted/20 sm:block">
              <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.13em] text-muted-foreground">
                  <tr>
                    <th className="w-14 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2">Party</th>
                    <th className="w-32 px-3 py-2 text-right">Elected</th>
                    <th className="w-32 px-3 py-2 text-right">Leading</th>
                  </tr>
                </thead>
                <tbody className="bg-card dark:bg-transparent">
                  {filteredParties.map((party) => (
                    <tr key={party.partyName} className="border-t border-border/60">
                      <td className="px-3 py-3 text-center font-mono text-xs text-muted-foreground">
                        {partyRanks.get(party.partyName)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={party.partyImage || PARTY_FALLBACK}
                            alt={party.partyName}
                            loading="lazy"
                            decoding="async"
                            className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{party.partyName}</span>
                            <div className="mt-1.5 h-1 max-w-sm overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-foreground"
                                style={{ width: `${Math.max(2, (party.elected / maxElected) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{party.electedText || party.elected}</td>
                      <td className="px-3 py-2 text-right font-semibold text-primary">{party.leadingText || party.leading}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!isLoading && !isError && !filteredParties.length ? (
          <section className="rounded-xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <SearchX className="h-4 w-4" />
              No matching parties
            </p>
            <p className="mt-2 text-sm">No parties matched "{search}". Try another party name or vote count.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default PartiesPage;

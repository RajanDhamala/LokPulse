import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import { FINAL_RESULTS_PUBLISHED_LABEL } from "@/lib/time";
import { AlertTriangle, Clock3, SearchX } from "lucide-react";
import { ProvincesSkeleton } from "@/Components/Skeletons";

interface ProvinceParty {
  partyName: string;
  partyImage: string | null;
  elected: number;
  electedText: string;
  leading: number;
  leadingText: string;
}

interface ProvinceData {
  provinceName: string;
  districtCount: number;
  districtLabel: string;
  constituencyCount: number;
  constituencyLabel: string;
  parties: ProvinceParty[];
}

interface ProvinceStatusResponse {
  source: string;
  extractedAt: string;
  lastScraped: string | null;
  cacheUpdatedAt?: string | null;
  count: number;
  provinces: ProvinceData[];
}

const PARTY_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";

const ProvincesPage = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery<ProvinceStatusResponse>({
    queryKey: ["province-status"],
    queryFn: () => api.get("/elections/status"),
    staleTime: Infinity
  });

  const normalizedQuery = search.trim().toLowerCase();
  const filteredProvinces = useMemo(() => {
    if (!data?.provinces?.length) return [];
    if (!normalizedQuery) return data.provinces;
    return data.provinces.filter((province) => {
      const searchable = [
        province.provinceName,
        province.districtLabel,
        province.constituencyLabel,
        ...province.parties.flatMap((party) => [party.partyName, party.electedText, party.leadingText])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [data?.provinces, normalizedQuery]);

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
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight md:text-3xl">Province Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">Final province-wise elected counts by party.</p>
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
              placeholder="Search province, party, or counts..."
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 dark:bg-background dark:shadow-none"
            />
            <div className="flex items-center rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/40 sm:whitespace-nowrap">
              Showing {filteredProvinces.length} of {data?.count || 0} provinces
            </div>
          </div>
        </header>

        {isLoading ? <ProvincesSkeleton /> : null}

        {isError ? (
          <section className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Unable to load province results
            </p>
            <p className="mt-2 text-sm">
              {String((error as { message?: string })?.message || "").includes("Result not found in cache")
                ? "Result not found. Contact the developer."
                : String((error as { message?: string })?.message || "Unknown error")}
            </p>
          </section>
        ) : null}

        {!isLoading && !isError && filteredProvinces.length ? (
          <section className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredProvinces.map((province) => (
              <article
                key={province.provinceName}
                className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <h2 className="text-lg font-semibold">{province.provinceName}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-muted-foreground">
                      {province.districtLabel}
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-muted-foreground">
                      {province.constituencyLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 sm:hidden">
                  {province.parties.map((party) => (
                    <div
                      key={`${province.provinceName}-${party.partyName}-mobile`}
                      className="rounded-lg border border-border bg-muted/55 p-3 dark:bg-muted/25"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <img
                          src={party.partyImage || PARTY_FALLBACK}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
                        />
                        <span className="min-w-0 truncate text-sm font-medium">{party.partyName}</span>
                      </div>
                      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
                        <div className="min-w-0 rounded-md border border-border bg-card p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                          <dt className="text-muted-foreground">Elected</dt>
                          <dd className="mt-1 text-base font-semibold text-foreground">{party.electedText || party.elected}</dd>
                        </div>
                        <div className="min-w-0 rounded-md border border-border bg-card p-2 text-right shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                          <dt className="text-muted-foreground">Leading</dt>
                          <dd className="mt-1 text-base font-semibold text-foreground">{party.leadingText || party.leading}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border border-border bg-muted/55 dark:bg-muted/20 sm:block">
                  <table className="w-full min-w-[420px] table-fixed text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-[0.13em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Party</th>
                        <th className="w-24 px-3 py-2 text-right">Elected</th>
                        <th className="w-24 px-3 py-2 text-right">Leading</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card dark:bg-transparent">
                      {province.parties.map((party) => (
                        <tr key={`${province.provinceName}-${party.partyName}`} className="border-t border-border/60">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={party.partyImage || PARTY_FALLBACK}
                                alt={party.partyName}
                                loading="lazy"
                                decoding="async"
                                className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                              />
                              <span>{party.partyName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-foreground">{party.electedText || party.elected}</td>
                          <td className="px-3 py-2 text-right font-semibold text-primary">{party.leadingText || party.leading}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!isLoading && !isError && !filteredProvinces.length ? (
          <section className="rounded-xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <SearchX className="h-4 w-4" />
              No matching provinces
            </p>
            <p className="mt-2 text-sm">No provinces matched "{search}". Try another province or party keyword.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default ProvincesPage;

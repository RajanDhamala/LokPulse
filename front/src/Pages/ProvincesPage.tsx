import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import AppMenu from "@/Components/AppMenu";
import { formatRelativeTime } from "@/lib/time";
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
    refetchInterval: 60_000
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
    <main className="dark min-h-screen bg-background text-foreground">
      <AppMenu />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Election Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Province Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">Live province-wise elected and leading counts by party.</p>
            </div>
            <div className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-right">
              <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-primary/90">
                <Clock3 className="h-3.5 w-3.5" />
                Data freshness
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Updated {formatRelativeTime(data?.cacheUpdatedAt || data?.lastScraped)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search province, party, or counts..."
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
            />
            <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              Showing {filteredProvinces.length} of {data?.count || 0} provinces
            </div>
          </div>
        </header>

        {isLoading ? <ProvincesSkeleton /> : null}

        {isError ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
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
          <section className="grid gap-4 md:grid-cols-2">
            {filteredProvinces.map((province) => (
              <article
                key={province.provinceName}
                className="rounded-2xl border border-border bg-card/75 p-4 shadow-[0_15px_40px_-28px_rgba(0,0,0,0.85)]"
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

                <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-background/90 text-xs uppercase tracking-[0.13em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Party</th>
                        <th className="px-3 py-2 text-right">Elected</th>
                        <th className="px-3 py-2 text-right">Leading</th>
                      </tr>
                    </thead>
                    <tbody>
                      {province.parties.map((party) => (
                        <tr key={`${province.provinceName}-${party.partyName}`} className="border-t border-border/60">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={party.partyImage || PARTY_FALLBACK}
                                alt={party.partyName}
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
          <section className="rounded-2xl border border-border bg-card/80 p-6 text-muted-foreground">
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

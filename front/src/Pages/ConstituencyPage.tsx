import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import AppMenu from "@/Components/AppMenu";
import { formatRelativeTime } from "@/lib/time";
import { AlertTriangle, CheckCircle2, Clock3, Info, SearchX } from "lucide-react";
import { ConstituencySkeleton } from "@/Components/Skeletons";

interface DistrictFilter {
  districtSlug: string;
  districtName: string;
  constituencies: number[];
}

interface ProvinceFilter {
  provinceId: number;
  provinceName: string;
  districts: DistrictFilter[];
}

interface FiltersResponse {
  provinces: ProvinceFilter[];
}

interface CandidateResult {
  candidateName: string;
  partyName: string;
  partyAvatarUrl: string | null;
  partyImage: string | null;
  candidateAvatarUrl: string | null;
  candidateImage: string | null;
  totalVotes: number;
  totalVotesText: string;
  marginText: string;
  position: number;
  status: string | null;
}

interface ConstituencyResultResponse {
  provinceId: number;
  provinceName: string;
  districtName: string;
  districtSlug: string;
  constituencyNo: number;
  constituencyTitle: string;
  constituencyUrl: string;
  sourceSummary: string;
  scrapedAt?: string;
  cacheUpdatedAt?: string;
  isCompleted?: boolean;
  candidates: CandidateResult[];
}

const AVATAR_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/user-placeholder.svg";
const PARTY_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";
const parseVoteNumber = (value?: string, fallback = 0) => {
  if (!value) return fallback;
  const numeric = value.replace(/[^\d]/g, "");
  return numeric ? Number(numeric) : fallback;
};

const ConstituencyPage = () => {
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtSlug, setDistrictSlug] = useState("");
  const [constituencyNo, setConstituencyNo] = useState<number | null>(null);

  const filtersQuery = useQuery<FiltersResponse>({
    queryKey: ["election-filters"],
    queryFn: () => api.get("/elections/filters"),
    staleTime: 5 * 60_000
  });

  const selectedProvince = useMemo(
    () => filtersQuery.data?.provinces?.find((item) => item.provinceId === provinceId) || null,
    [filtersQuery.data?.provinces, provinceId]
  );

  const selectedDistrict = useMemo(
    () => selectedProvince?.districts?.find((item) => item.districtSlug === districtSlug) || null,
    [selectedProvince, districtSlug]
  );

  const constituencyQuery = useQuery<ConstituencyResultResponse>({
    queryKey: ["constituency-result", provinceId, districtSlug, constituencyNo],
    queryFn: () =>
      api.get(
        `/elections/constituency?provinceId=${provinceId}&district=${districtSlug}&constituencyNo=${constituencyNo}&lang=eng`
      ),
    enabled: Boolean(provinceId && districtSlug && constituencyNo)
  });

  const sortedCandidates = useMemo(() => {
    if (!constituencyQuery.data?.candidates?.length) return [];
    return [...constituencyQuery.data.candidates].sort(
      (a, b) => parseVoteNumber(b.totalVotesText, b.totalVotes) - parseVoteNumber(a.totalVotesText, a.totalVotes)
    );
  }, [constituencyQuery.data?.candidates]);

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <AppMenu />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Election Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Constituency Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose Province / District / Constituency to load cached candidate results.
              </p>
            </div>
            <div className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-right">
              <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-primary/90">
                <Clock3 className="h-3.5 w-3.5" />
                Data freshness
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Updated {formatRelativeTime(constituencyQuery.data?.cacheUpdatedAt || constituencyQuery.data?.scrapedAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              className="rounded-xl border border-border bg-background/80 px-3 py-2 text-sm"
              value={provinceId ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value) || null;
                setProvinceId(value);
                setDistrictSlug("");
                setConstituencyNo(null);
              }}
            >
              <option value="">Select Province</option>
              {filtersQuery.data?.provinces?.map((province) => (
                <option key={province.provinceId} value={province.provinceId}>
                  {province.provinceName}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-border bg-background/80 px-3 py-2 text-sm"
              value={districtSlug}
              onChange={(event) => {
                setDistrictSlug(event.target.value);
                setConstituencyNo(null);
              }}
              disabled={!selectedProvince}
            >
              <option value="">Select District</option>
              {selectedProvince?.districts?.map((district) => (
                <option key={district.districtSlug} value={district.districtSlug}>
                  {district.districtName}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-border bg-background/80 px-3 py-2 text-sm"
              value={constituencyNo ?? ""}
              onChange={(event) => setConstituencyNo(Number(event.target.value) || null)}
              disabled={!selectedDistrict}
            >
              <option value="">Select Constituency</option>
              {selectedDistrict?.constituencies?.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        </header>

        {filtersQuery.isLoading ? <ConstituencySkeleton /> : null}

        {filtersQuery.isError ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Unable to load constituency filters
            </p>
            <p className="mt-2 text-sm">
              {String((filtersQuery.error as { message?: string })?.message || "").includes("Result not found in cache")
                ? "Result not found. Contact the developer."
                : String((filtersQuery.error as { message?: string })?.message || "Unknown error")}
            </p>
          </section>
        ) : null}

        {constituencyQuery.isLoading ? <ConstituencySkeleton /> : null}

        {constituencyQuery.isError ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Unable to load constituency result
            </p>
            <p className="mt-2 text-sm">
              {String((constituencyQuery.error as { message?: string })?.message || "").includes("Result not found in cache")
                ? "Result not found. Contact the developer."
                : String((constituencyQuery.error as { message?: string })?.message || "Unknown error")}
            </p>
          </section>
        ) : null}

        {!filtersQuery.isLoading && !filtersQuery.isError && (!provinceId || !districtSlug || !constituencyNo) ? (
          <section className="rounded-2xl border border-border bg-card/80 p-6 text-muted-foreground">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4" />
              Select filters to view results
            </p>
            <p className="mt-2 text-sm">
              Start by selecting a Province, then District, then Constituency. Results will appear here once all filters are selected.
            </p>
          </section>
        ) : null}

        {constituencyQuery.data ? (
          <section className={`rounded-2xl border p-4 ${
            constituencyQuery.data.isCompleted
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card/80 to-card/75 shadow-[0_15px_40px_-28px_rgba(16,185,129,0.4)]"
              : "border-border bg-card/75 shadow-[0_15px_40px_-28px_rgba(0,0,0,0.85)]"
          }`}>
            <div className="mb-4 border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{constituencyQuery.data.constituencyTitle}</h2>
                {constituencyQuery.data.isCompleted && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                    <CheckCircle2 className="h-4 w-4" />
                    Result Finalized
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{constituencyQuery.data.sourceSummary}</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-background/90 text-xs uppercase tracking-[0.13em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Party</th>
                    <th className="px-3 py-2 text-right">Total Votes</th>
                    <th className="px-3 py-2 text-right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCandidates.map((candidate, index) => {
                    const isWinner = constituencyQuery.data!.isCompleted && index === 0;
                    return (
                    <tr
                      key={`${candidate.candidateName}-${candidate.position}`}
                      className={`border-t ${
                        isWinner
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-border/60"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={candidate.candidateAvatarUrl || candidate.candidateImage || AVATAR_FALLBACK}
                            alt={candidate.candidateName}
                            className={`h-8 w-8 rounded-full object-cover ring-1 ${isWinner ? "ring-2 ring-emerald-500/60" : "ring-border"}`}
                          />
                          <span className={isWinner ? "font-bold text-emerald-400" : ""}>
                            {candidate.candidateName}
                          </span>
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Won
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={candidate.partyAvatarUrl || candidate.partyImage || PARTY_FALLBACK}
                            alt={candidate.partyName}
                            className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                          />
                          {candidate.partyName}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${isWinner ? "text-emerald-400" : ""}`}>{candidate.totalVotesText || candidate.totalVotes}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{candidate.marginText}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!constituencyQuery.isLoading && !constituencyQuery.isError && provinceId && districtSlug && constituencyNo && !constituencyQuery.data ? (
          <section className="rounded-2xl border border-border bg-card/80 p-6 text-muted-foreground">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <SearchX className="h-4 w-4" />
              No cached result for selection
            </p>
            <p className="mt-2 text-sm">No result found in cache for this constituency. Contact the developer/admin to refresh data.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default ConstituencyPage;

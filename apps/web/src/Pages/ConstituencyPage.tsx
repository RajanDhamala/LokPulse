import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import { FINAL_RESULTS_PUBLISHED_LABEL } from "@/lib/time";
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
    staleTime: Infinity
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
    enabled: Boolean(provinceId && districtSlug && constituencyNo),
    staleTime: Infinity
  });

  const sortedCandidates = useMemo(() => {
    if (!constituencyQuery.data?.candidates?.length) return [];
    return [...constituencyQuery.data.candidates].sort(
      (a, b) => parseVoteNumber(b.totalVotesText, b.totalVotes) - parseVoteNumber(a.totalVotesText, a.totalVotes)
    );
  }, [constituencyQuery.data?.candidates]);

  return (
    <main className="min-h-[calc(100svh-4.5rem)]">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/60 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_18px_46px_-32px_rgb(15_23_42/0.3)] sm:p-6 dark:rounded-xl dark:border-border dark:bg-card dark:bg-none dark:shadow-sm">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-brand/45 to-transparent dark:hidden" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand dark:text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand dark:hidden" />
                Election Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Constituency Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose Province / District / Constituency to load cached candidate results.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/70 px-3 py-2 text-right shadow-sm dark:bg-muted/60">
              <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Final archive
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {FINAL_RESULTS_PUBLISHED_LABEL}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Province
              <select
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 dark:bg-background dark:shadow-none"
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
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              District
              <select
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:shadow-none"
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
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-1">
              Constituency
              <select
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:shadow-none"
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
            </label>
          </div>
        </header>

        {filtersQuery.isLoading ? <ConstituencySkeleton /> : null}

        {filtersQuery.isError ? (
          <section className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
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
          <section className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
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
          <section className="rounded-xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
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
          <section className={`rounded-xl border border-border bg-card p-4 ${
            constituencyQuery.data.isCompleted
              ? "shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_26px_-14px_rgb(15_23_42/0.2)] dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-emerald-500/10 dark:via-card/80 dark:to-card/75 dark:shadow-[0_15px_40px_-28px_rgba(16,185,129,0.4)]"
              : "shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_26px_-14px_rgb(15_23_42/0.2)] dark:shadow-sm"
          }`}>
            <div className="mb-4 border-b border-border pb-3 dark:border-border/70">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{constituencyQuery.data.constituencyTitle}</h2>
                {constituencyQuery.data.isCompleted && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Result Finalized
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{constituencyQuery.data.sourceSummary}</p>
            </div>

            <div className="grid gap-2 md:hidden">
              {sortedCandidates.map((candidate, index) => {
                const isWinner = constituencyQuery.data!.isCompleted && index === 0;
                return (
                  <article
                    key={`${candidate.candidateName}-${candidate.position}-mobile`}
                    className={`rounded-lg border p-3 ${
                      isWinner ? "border-emerald-400/60 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-500/10" : "border-border bg-muted/55 dark:bg-muted/25"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={candidate.candidateAvatarUrl || candidate.candidateImage || AVATAR_FALLBACK}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={`h-11 w-11 shrink-0 rounded-full object-cover ring-1 ${isWinner ? "ring-2 ring-emerald-500/60" : "ring-border"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className={`break-words text-sm font-semibold ${isWinner ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                            {candidate.candidateName}
                          </h3>
                          {isWinner ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                              Won
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <img
                            src={candidate.partyAvatarUrl || candidate.partyImage || PARTY_FALLBACK}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-5 w-5 rounded-full object-cover ring-1 ring-border"
                          />
                          <span className="truncate">{candidate.partyName}</span>
                        </div>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-card p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                        <dt className="text-muted-foreground">Total votes</dt>
                        <dd className="mt-1 text-base font-semibold">{candidate.totalVotesText || candidate.totalVotes}</dd>
                      </div>
                      <div className="rounded-md border border-border bg-card p-2 text-right shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-transparent dark:bg-background dark:shadow-none">
                        <dt className="text-muted-foreground">Gap</dt>
                        <dd className="mt-1 text-base font-semibold">{candidate.marginText || "—"}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border bg-muted/55 dark:bg-muted/20 md:block">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.13em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Party</th>
                    <th className="w-36 px-3 py-2 text-right">Total Votes</th>
                    <th className="w-32 px-3 py-2 text-right">Gap</th>
                  </tr>
                </thead>
                <tbody className="bg-card dark:bg-transparent">
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
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={candidate.candidateAvatarUrl || candidate.candidateImage || AVATAR_FALLBACK}
                            alt={candidate.candidateName}
                            loading="lazy"
                            decoding="async"
                            className={`h-8 w-8 rounded-full object-cover ring-1 ${isWinner ? "ring-2 ring-emerald-500/60" : "ring-border"}`}
                          />
                          <span className={`truncate ${isWinner ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}`}>
                            {candidate.candidateName}
                          </span>
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Won
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={candidate.partyAvatarUrl || candidate.partyImage || PARTY_FALLBACK}
                            alt={candidate.partyName}
                            loading="lazy"
                            decoding="async"
                            className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                          />
                          <span className="truncate">{candidate.partyName}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${isWinner ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{candidate.totalVotesText || candidate.totalVotes}</td>
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
          <section className="rounded-xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
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

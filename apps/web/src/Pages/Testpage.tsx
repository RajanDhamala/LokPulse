
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import { CheckCircle2, Clock3, SearchX, Star } from "lucide-react";
import DataLoadError from "@/Components/DataLoadError";
import { FINAL_RESULTS_PUBLISHED_LABEL } from "@/lib/time";
import { PopularSkeleton } from "@/Components/Skeletons";

interface Candidate {
  type: "leader" | "side";
  name: string;
  profileUrl?: string;
  avatar?: string;
  votes?: string;
  voteChange?: string;
  partyUrl?: string;
  partyImg?: string;
  partyName?: string;
}

interface DistrictCandidates {
  districtName: string;
  districtUrl?: string;
  isCompleted?: boolean;
  leaderCandidate: Candidate;
  sideCandidates: Candidate[];
}

interface PopularCandidatesResponse {
  count: number;
  lastScraped?: string | null;
  cacheUpdatedAt?: string | null;
  isCompleted?: boolean;
  candidates: DistrictCandidates[];
}

const IMAGE_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/user-placeholder.svg";
const PARTY_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";
const FAVORITE_DISTRICTS_KEY = "favorite-districts";

const formatVoteChange = (value?: string) => {
  if (!value) return "";
  return value.startsWith("+") ? value : `+${value}`;
};

const hasMeaningfulValue = (value?: string) => Boolean(value?.trim());

const normalizeDistrictLeaderVoteChange = (district: DistrictCandidates): DistrictCandidates => {
  if (hasMeaningfulValue(district.leaderCandidate.voteChange)) {
    return district;
  }

  const sideVoteChange = district.sideCandidates.find((candidate) => hasMeaningfulValue(candidate.voteChange))?.voteChange?.trim();
  if (!sideVoteChange) {
    return district;
  }

  return {
    ...district,
    leaderCandidate: {
      ...district.leaderCandidate,
      voteChange: sideVoteChange,
    },
  };
};

const buildFilteredDistricts = ({
  districts,
  query,
  favoriteSet,
}: {
  districts: DistrictCandidates[];
  query: string;
  favoriteSet: Set<string>;
}) => {
  const matchedDistricts = !query
    ? districts
    : districts.filter((district) => {
      const searchable = [
        district.districtName,
        district.leaderCandidate?.name,
        district.leaderCandidate?.partyName,
        ...(district.sideCandidates || []).flatMap((candidate) => [candidate.name, candidate.partyName]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

  return matchedDistricts
    .map((district, index) => ({
      district,
      index,
      favoriteScore: favoriteSet.has(district.districtName) ? 1 : 0,
    }))
    .sort((a, b) => b.favoriteScore - a.favoriteScore || a.index - b.index)
    .map((item) => item.district);
};

const LeaderCard = ({ candidate, isCompleted }: { candidate: Candidate; isCompleted?: boolean }) => (
  <div className={`relative min-w-0 overflow-hidden rounded-lg border p-3 shadow-[0_1px_2px_rgb(15_23_42/0.05)] sm:p-4 dark:rounded-xl dark:shadow-sm ${isCompleted
    ? "border-emerald-200/70 border-l-[3px] border-l-emerald-500 bg-gradient-to-br from-emerald-50/70 via-card to-card dark:border-emerald-500/40 dark:border-l-emerald-500/40 dark:bg-gradient-to-b dark:from-emerald-500/20 dark:via-card/90 dark:to-card/90"
    : "border-border/80 bg-card dark:border-primary/20 dark:bg-gradient-to-b dark:from-primary/15 dark:via-card/90 dark:to-card/90"
    }`}>
    <div className={`pointer-events-none absolute right-[-42px] top-[-42px] h-28 w-28 rounded-full opacity-0 blur-2xl dark:opacity-100 ${isCompleted ? "bg-emerald-500/20" : "bg-primary/15"
      }`} />
    <p className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] ${isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-primary/80"
      }`}>
      {isCompleted ? "✓ Winner" : "Leading candidate"}
    </p>
    <div className="flex min-w-0 items-start gap-3">
      <img
        src={candidate.avatar || IMAGE_FALLBACK}
        alt={candidate.name}
        loading="lazy"
        decoding="async"
        className={`h-16 w-16 shrink-0 rounded-xl object-cover ring-2 ${isCompleted ? "ring-emerald-500/50" : "ring-primary/30"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold tracking-tight text-foreground">{candidate.name || "Unknown candidate"}</p>
        <div className="mt-1 flex w-fit max-w-full items-center gap-2 rounded-full border border-border/80 bg-card px-2 py-1 text-xs text-muted-foreground dark:bg-background/70">
          <img
            src={candidate.partyImg || PARTY_FALLBACK}
            alt={candidate.partyName || "Party"}
            loading="lazy"
            decoding="async"
            className="h-4 w-4 shrink-0 rounded-full object-cover"
          />
          <span className="truncate">{candidate.partyName || "Independent / N/A"}</span>
        </div>
      </div>
    </div>

    <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
      <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/45 p-2.5 dark:rounded-xl dark:border-border/70 dark:bg-background/60">
        <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Total votes</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{candidate.votes || "0"}</p>
      </div>
      <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/45 p-2.5 dark:rounded-xl dark:border-border/70 dark:bg-background/60">
        <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Vote change</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatVoteChange(candidate.voteChange) || "N/A"}</p>
      </div>
    </div>

  </div>
);

const CandidateRow = ({ candidate }: { candidate: Candidate }) => (
  <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-[0_1px_1px_rgb(15_23_42/0.04)] dark:rounded-xl dark:border-border/70 dark:bg-card/60 dark:shadow-none">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <img
        src={candidate.avatar || IMAGE_FALLBACK}
        alt={candidate.name}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{candidate.name || "Unknown candidate"}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src={candidate.partyImg || PARTY_FALLBACK}
            alt={candidate.partyName || "Party"}
            loading="lazy"
            decoding="async"
            className="h-4 w-4 rounded-full object-cover"
          />
          <span className="truncate">{candidate.partyName || "Independent / N/A"}</span>
        </div>
      </div>
    </div>
    <div className="shrink-0 text-right">
      <p className="text-sm font-semibold tabular-nums text-foreground">{candidate.votes || "0"}</p>
    </div>
  </div>
);

const TestPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteDistricts, setFavoriteDistricts] = useState<string[]>([]);
  const [processedDistricts, setProcessedDistricts] = useState<DistrictCandidates[]>([]);
  const [hasProcessedData, setHasProcessedData] = useState(false);
  const [isFiltering, startFilteringTransition] = useTransition();
  const { data, isLoading, isError, isFetching, refetch } = useQuery<PopularCandidatesResponse>({
    queryKey: ["popular-candidates"],
    queryFn: () => api.get("/elections/eval", { showErrorToast: false }),
    staleTime: Infinity,
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(FAVORITE_DISTRICTS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteDistricts(parsed.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      setFavoriteDistricts([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const favoriteSet = useMemo(() => new Set(favoriteDistricts), [favoriteDistricts]);
  const toggleFavoriteDistrict = (districtName: string) => {
    setFavoriteDistricts((prev) => {
      const next = prev.includes(districtName)
        ? prev.filter((item) => item !== districtName)
        : [...prev, districtName];
      window.localStorage.setItem(FAVORITE_DISTRICTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const deferredNormalizedQuery = useDeferredValue(normalizedQuery);
  const normalizedDistricts = useMemo(() => {
    if (!data?.candidates?.length) return [];
    return data.candidates.map(normalizeDistrictLeaderVoteChange);
  }, [data?.candidates]);

  useEffect(() => {
    if (!data?.candidates) {
      setProcessedDistricts([]);
      setHasProcessedData(false);
      return;
    }

    setHasProcessedData(false);
    startFilteringTransition(() => {
      const nextDistricts = buildFilteredDistricts({
        districts: normalizedDistricts,
        query: deferredNormalizedQuery,
        favoriteSet,
      });
      setProcessedDistricts(nextDistricts);
      setHasProcessedData(true);
    });
  }, [data?.candidates, normalizedDistricts, deferredNormalizedQuery, favoriteSet]);

  const shouldShowProcessingSkeleton =
    isLoading || (Boolean(data?.candidates) && !hasProcessedData && !processedDistricts.length);

  return (
    <main className="min-h-[calc(100svh-4.5rem)] min-w-0 overflow-x-clip">
      <div className="mx-auto min-w-0 w-full max-w-[1600px] space-y-5 px-4 py-5 sm:space-y-7 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/60 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_18px_46px_-32px_rgb(15_23_42/0.3)] sm:p-6 dark:rounded-xl dark:border-border dark:bg-card dark:bg-none dark:shadow-sm">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-brand/45 to-transparent dark:hidden" />
          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand dark:text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand dark:hidden" />
                Election Dashboard
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight md:text-3xl">Popular Candidates by District</h1>
              {data?.isCompleted && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Election Completed
                </span>
              )}
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
          <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by candidate, party, or district..."
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 dark:bg-background dark:shadow-none"
            />
            <p className="flex items-center rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/40 sm:whitespace-nowrap">
              Showing {processedDistricts.length} of {data?.count || 0} districts
            </p>
          </div>
        </header>

        {shouldShowProcessingSkeleton ? <PopularSkeleton /> : null}

        {isError ? (
          <DataLoadError
            title="Popular candidate results are temporarily unavailable"
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : null}

        {!shouldShowProcessingSkeleton && !isError && processedDistricts.length ? (
          <section className="grid min-w-0 gap-5 2xl:grid-cols-2" aria-busy={isFiltering}>
            {processedDistricts.map((district) => (
              <article
                key={`${district.districtName}-${district.districtUrl || "no-url"}`}
                className={`min-w-0 h-full rounded-xl border border-border/80 bg-card p-3 sm:p-4 ${district.isCompleted
                  ? "shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_26px_-14px_rgb(15_23_42/0.2)] dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-emerald-500/10 dark:via-card/80 dark:to-card/75 dark:shadow-[0_15px_40px_-28px_rgba(16,185,129,0.4)]"
                  : "shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_26px_-14px_rgb(15_23_42/0.2)] dark:shadow-sm"
                  }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3 dark:border-border/70">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-semibold">{district.districtName}</h2>
                    {district.isCompleted && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Elected
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteDistrict(district.districtName)}
                      aria-label={favoriteSet.has(district.districtName) ? "Remove favorite district" : "Add favorite district"}
                      title={favoriteSet.has(district.districtName) ? "Favorited district" : "Mark district as favorite"}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition sm:h-9 sm:w-9 ${favoriteSet.has(district.districtName)
                        ? "border-amber-500/50 bg-amber-400/15 text-amber-700 hover:bg-amber-400/20 dark:text-amber-300"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      <Star
                        className={`h-4 w-4 ${favoriteSet.has(district.districtName) ? "fill-current" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 xl:grid-cols-5">
                  <section className="min-w-0 xl:col-span-2">
                    <LeaderCard candidate={district.leaderCandidate} isCompleted={district.isCompleted} />
                  </section>

                  <section className="min-w-0 rounded-lg border border-transparent bg-muted/65 p-3 dark:rounded-xl dark:border-border/70 dark:bg-background/60 xl:col-span-3">
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Top side candidates
                    </p>
                    <div className="space-y-2">
                      {district.sideCandidates.map((candidate, index) => (
                        <CandidateRow key={`${candidate.profileUrl || candidate.name}-${index}`} candidate={candidate} />
                      ))}
                    </div>
                  </section>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!shouldShowProcessingSkeleton && !isError && !processedDistricts.length ? (
          <section className="rounded-xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <SearchX className="h-4 w-4" />
              No matching districts
            </p>
            <p className="mt-2 break-words text-sm">
              No districts matched "<span className="break-all">{searchInput}</span>". Try another district, candidate, or party keyword.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default TestPage;

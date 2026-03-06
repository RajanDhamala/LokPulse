
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import { AlertTriangle, Clock3, SearchX, Star } from "lucide-react";
import AppMenu from "@/Components/AppMenu";
import { formatRelativeTime } from "@/lib/time";
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
  leaderCandidate: Candidate;
  sideCandidates: Candidate[];
}

interface PopularCandidatesResponse {
  count: number;
  lastScraped?: string | null;
  cacheUpdatedAt?: string | null;
  candidates: DistrictCandidates[];
}

const IMAGE_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/user-placeholder.svg";
const PARTY_FALLBACK = "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";
const FAVORITE_DISTRICTS_KEY = "favorite-districts";

const formatVoteChange = (value?: string) => {
  if (!value) return "";
  return value.startsWith("+") ? value : `+${value}`;
};

const LeaderCard = ({ candidate }: { candidate: Candidate }) => (
  <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/15 via-card/90 to-card/90 p-4 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.95)]">
    <div className="pointer-events-none absolute right-[-42px] top-[-42px] h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">Leading candidate</p>
    <div className="flex items-start gap-3">
      <img
        src={candidate.avatar || IMAGE_FALLBACK}
        alt={candidate.name}
        className="h-16 w-16 rounded-xl object-cover ring-2 ring-primary/30"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold tracking-tight text-foreground">{candidate.name || "Unknown candidate"}</p>
        <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-2 py-1 text-xs text-muted-foreground">
          <img src={candidate.partyImg || PARTY_FALLBACK} alt={candidate.partyName || "Party"} className="h-4 w-4 rounded-full object-cover" />
          <span className="truncate">{candidate.partyName || "Independent / N/A"}</span>
        </div>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
        <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Total votes</p>
        <p className="mt-1 text-xl font-black text-foreground">{candidate.votes || "0"}</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
        <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Vote change</p>
        <p className="mt-1 text-xl font-black text-emerald-400">{formatVoteChange(candidate.voteChange) || "N/A"}</p>
      </div>
    </div>

  </div>
);

const CandidateRow = ({ candidate }: { candidate: Candidate }) => (
  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-3 py-2">
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={candidate.avatar || IMAGE_FALLBACK}
        alt={candidate.name}
        className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{candidate.name || "Unknown candidate"}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src={candidate.partyImg || PARTY_FALLBACK}
            alt={candidate.partyName || "Party"}
            className="h-4 w-4 rounded-full object-cover"
          />
          <span className="truncate">{candidate.partyName || "Independent / N/A"}</span>
        </div>
      </div>
    </div>
    <div className="text-right">
      <p className="text-sm font-bold text-foreground">{candidate.votes || "0"}</p>
      {candidate.voteChange ? <p className="text-[11px] text-emerald-400">{formatVoteChange(candidate.voteChange)}</p> : null}
    </div>
  </div>
);

const TestPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteDistricts, setFavoriteDistricts] = useState<string[]>([]);
  const { data, isLoading, isError, error } = useQuery<PopularCandidatesResponse>({
    queryKey: ["popular-candidates"],
    queryFn: () => api.get("/elections/eval"),
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
  const filteredDistricts = useMemo(() => {
    if (!data?.candidates?.length) return [];
    const candidates = !normalizedQuery
      ? data.candidates
      : data.candidates.filter((district) => {
        const searchable = [
          district.districtName,
          district.leaderCandidate?.name,
          district.leaderCandidate?.partyName,
          ...(district.sideCandidates || []).flatMap((candidate) => [candidate.name, candidate.partyName]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });

    return candidates
      .map((district, index) => ({
        district,
        index,
        favoriteScore: favoriteSet.has(district.districtName) ? 1 : 0,
      }))
      .sort((a, b) => b.favoriteScore - a.favoriteScore || a.index - b.index)
      .map((item) => item.district);
  }, [data?.candidates, normalizedQuery, favoriteSet]);

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <AppMenu />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <header className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Election Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Popular Candidates by District</h1>

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
          <div className="mt-4 space-y-2">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by candidate, party, or district..."
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-0 transition placeholder:text-muted-foreground focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Showing {filteredDistricts.length} of {data?.count || 0} districts
            </p>
          </div>
        </header>

        {isLoading ? <PopularSkeleton /> : null}

        {isError ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Unable to load popular candidates
            </p>
            <p className="mt-2 text-sm">
              {String((error as { message?: string })?.message || "").includes("Result not found in cache")
                ? "Result not found. Contact the developer."
                : String((error as { message?: string })?.message || "Unknown error")}
            </p>
          </section>
        ) : null}

        {!isLoading && !isError && filteredDistricts.length ? (
          <section className="space-y-4">
            {filteredDistricts.map((district) => (
              <article
                key={`${district.districtName}-${district.districtUrl || "no-url"}`}
                className="rounded-2xl border border-border bg-card/75 p-4 shadow-[0_15px_40px_-28px_rgba(0,0,0,0.85)]"
              >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <h2 className="text-lg font-semibold">{district.districtName}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteDistrict(district.districtName)}
                      aria-label={favoriteSet.has(district.districtName) ? "Remove favorite district" : "Add favorite district"}
                      title={favoriteSet.has(district.districtName) ? "Favorited district" : "Mark district as favorite"}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${favoriteSet.has(district.districtName)
                          ? "border-amber-400/50 bg-amber-400/15 text-amber-300 hover:bg-amber-400/20"
                          : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      <Star
                        className={`h-4 w-4 ${favoriteSet.has(district.districtName) ? "fill-current" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <section className="lg:col-span-2">
                    <LeaderCard candidate={district.leaderCandidate} />
                  </section>

                  <section className="rounded-xl border border-border/70 bg-background/60 p-3 lg:col-span-3">
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

        {!isLoading && !isError && !filteredDistricts.length ? (
          <section className="rounded-2xl border border-border bg-card/80 p-6 text-muted-foreground">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <SearchX className="h-4 w-4" />
              No matching districts
            </p>
            <p className="mt-2 text-sm">No districts matched "{searchInput}". Try another district, candidate, or party keyword.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default TestPage;

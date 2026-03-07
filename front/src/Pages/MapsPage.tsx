import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/Utils/AxiosWrapper";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  LocateFixed,
  Minus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import AppMenu from "@/Components/AppMenu";

/* ──────────────────────────── Types ──────────────────────────── */

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface Projection {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface Point {
  x: number;
  y: number;
}

interface DragState {
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  moved: boolean;
  isPanning: boolean;
  pointerId: number;
}

// API types — map summary (bulk, lightweight)
interface MapCandidateSummary {
  candidateName: string;
  partyName: string;
  partyImage: string | null;
  candidateImage: string | null;
  totalVotes: number;
}

interface MapConstituency {
  provinceId: number;
  districtSlug: string;
  districtName: string;
  constituencyNo: number;
  isCompleted: boolean;
  candidates: MapCandidateSummary[];
}

interface MapSummaryResponse {
  count: number;
  constituencies: MapConstituency[];
}

// API types — full constituency detail
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

interface ConstituencyDetailResponse {
  provinceId: number;
  provinceName: string;
  districtName: string;
  districtSlug: string;
  constituencyNo: number;
  constituencyTitle: string;
  sourceSummary: string;
  scrapedAt?: string;
  cacheUpdatedAt?: string;
  isCompleted?: boolean;
  candidates: CandidateResult[];
}

// Rendered feature (internal)
interface RenderedConstituency {
  key: string;
  districtName: string;
  districtSlug: string;
  provinceId: number;
  constituencyNo: number;
  path: string;
  centroid: Point | null;
  fillColor: string;
  summary: MapConstituency | undefined;
  status: ConstituencyStatus;
}

type ConstituencyStatus = "completed" | "counting" | "not-started" | "no-data";

interface TooltipData {
  x: number;
  y: number;
  districtName: string;
  constituencyNo: number;
  provinceId: number;
  leadingParty: string | null;
  leadingVotes: number;
  status: ConstituencyStatus;
}

interface SelectedMeta {
  provinceId: number;
  districtSlug: string;
  constituencyNo: number;
  districtName: string;
}

/* ──────────────────────────── Constants ──────────────────────── */

const MAP_W = 1100;
const MAP_H = 700;
const MAP_PAD = 24;

const DISTRICT_GEOJSON_URL =
  "https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts.geojson";
const CONSTITUENCY_GEOJSON_URL =
  "https://election-2082.vercel.app/geojson/nepal-constituencies.geojson";

const PROVINCE_NAMES: Record<number, string> = {
  1: "Koshi",
  2: "Madhesh",
  3: "Bagmati",
  4: "Gandaki",
  5: "Lumbini",
  6: "Karnali",
  7: "Sudurpashchim",
};

const FALLBACK_COLOR = "#334155";
const NO_DATA_COLOR = "#475569";

// GeoJSON → DB district slug alias map (14 spelling mismatches)
const DISTRICT_ALIAS: Record<string, string> = {
  "ilam": "illam",
  "chitawan": "chitwan",
  "dhanusha": "dhanusa",
  "dolakha": "dolkha",
  "kabhrepalanchok": "kavrepalanchowk",
  "kapilbastu": "kapilvastu",
  "makawanpur": "makwanpur",
  "nawalparasi-e": "nawalparasieast",
  "nawalparasi-w": "nawalparasiwest",
  "rautahat": "rauthat",
  "rukum-e": "rukumeast",
  "rukum-w": "rukumwest",
  "sindhupalchok": "sindhupalchowk",
  "tanahu": "tanahun",
};

const resolveSlug = (geoKey: string): string => DISTRICT_ALIAS[geoKey] ?? geoKey;

const AVATAR_FALLBACK =
  "https://jcss-generalelection2082.ekantipur.com/assets/images/user-placeholder.svg";
const PARTY_FALLBACK =
  "https://jcss-generalelection2082.ekantipur.com/assets/images/default-party.jpeg";

// Known party colours (partial-match on lowercase name)
// RSP = blue, UML = red, Congress = green per user spec
const PARTY_COLOR_RULES: [string, string][] = [
  ["swatantra", "#2563eb"],
  ["स्वतन्त्र पार्टी", "#2563eb"],
  ["rsp", "#2563eb"],
  ["uml", "#dc2626"],
  ["एमाले", "#dc2626"],
  ["congress", "#16a34a"],
  ["कांग्रेस", "#16a34a"],
  ["maoist", "#b91c1c"],
  ["माओवादी", "#b91c1c"],
  ["prajatantra", "#eab308"],
  ["प्रजातन्त्र", "#eab308"],
  ["samajwadi", "#0d9488"],
  ["समाजवादी", "#0d9488"],
  ["loktantrik", "#7c3aed"],
  ["लोकतान्त्रिक", "#7c3aed"],
  ["janamorcha", "#0891b2"],
  ["जनमोर्चा", "#0891b2"],
  ["nagarik", "#059669"],
  ["नागरिक", "#059669"],
  ["independent", "#78909c"],
  ["स्वतन्त्र", "#78909c"],
];

const FALLBACK_PALETTE = [
  "#0d9488",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#2563eb",
  "#65a30d",
  "#dc2626",
  "#0891b2",
  "#a855f7",
  "#e11d48",
];

/* ──────────────────────────── Utilities ──────────────────────── */

const normalizeKey = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toTitle = (v: string) =>
  v
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

const propStr = (f: GeoFeature, k: string, fb = "") => {
  const v = f.properties?.[k];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fb;
};

const propNum = (f: GeoFeature, k: string, fb = 0) => {
  const v = Number(f.properties?.[k]);
  return Number.isFinite(v) ? v : fb;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
};

// Party colour resolver
const partyColorCache = new Map<string, string>();
const getPartyColor = (name: string): string => {
  if (!name) return FALLBACK_COLOR;
  const cached = partyColorCache.get(name);
  if (cached) return cached;

  const lower = name.toLowerCase();
  for (const [match, color] of PARTY_COLOR_RULES) {
    if (lower.includes(match)) {
      partyColorCache.set(name, color);
      return color;
    }
  }
  const fallback = FALLBACK_PALETTE[hashStr(name) % FALLBACK_PALETTE.length];
  partyColorCache.set(name, fallback);
  return fallback;
};

const getStatus = (s: MapConstituency | undefined): ConstituencyStatus => {
  if (!s) return "no-data";
  if (s.isCompleted) return "completed";
  const total = s.candidates.reduce((sum, c) => sum + c.totalVotes, 0);
  return total === 0 ? "not-started" : "counting";
};

/* ─── Geo helpers ─── */

const isRenderable = (f: GeoFeature) =>
  f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon";

const getPolygons = (f: GeoFeature): MultiPolygon => {
  if (!f.geometry) return [];
  if (f.geometry.type === "Polygon") return [f.geometry.coordinates as Polygon];
  if (f.geometry.type === "MultiPolygon") return f.geometry.coordinates as MultiPolygon;
  return [];
};

const eachCoord = (f: GeoFeature, cb: (lon: number, lat: number) => void) => {
  for (const poly of getPolygons(f))
    for (const ring of poly)
      for (const pt of ring) {
        const lon = Number(pt[0]),
          lat = Number(pt[1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) cb(lon, lat);
      }
};

const computeBounds = (features: GeoFeature[]): Bounds | null => {
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity,
    has = false;
  for (const f of features)
    eachCoord(f, (lon, lat) => {
      has = true;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  return has ? { minLon, maxLon, minLat, maxLat } : null;
};

const mkProjection = (b: Bounds): Projection => {
  const lonSpan = Math.max(b.maxLon - b.minLon, 1e-4);
  const latSpan = Math.max(b.maxLat - b.minLat, 1e-4);
  const scale = Math.min((MAP_W - MAP_PAD * 2) / lonSpan, (MAP_H - MAP_PAD * 2) / latSpan);
  const pw = lonSpan * scale,
    ph = latSpan * scale;
  return {
    scale,
    offsetX: (MAP_W - pw) / 2 - b.minLon * scale,
    offsetY: (MAP_H - ph) / 2 + b.maxLat * scale,
  };
};

const project = (lon: number, lat: number, p: Projection): Point => ({
  x: lon * p.scale + p.offsetX,
  y: p.offsetY - lat * p.scale,
});

const buildPath = (f: GeoFeature, p: Projection) => {
  const cmds: string[] = [];
  for (const poly of getPolygons(f))
    for (const ring of poly) {
      if (!ring.length) continue;
      const lon0 = Number(ring[0][0]),
        lat0 = Number(ring[0][1]);
      if (!Number.isFinite(lon0) || !Number.isFinite(lat0)) continue;
      const p0 = project(lon0, lat0, p);
      cmds.push(`M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`);
      for (let i = 1; i < ring.length; i++) {
        const lon = Number(ring[i][0]),
          lat = Number(ring[i][1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        const pt = project(lon, lat, p);
        cmds.push(`L${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
      }
      cmds.push("Z");
    }
  return cmds.join("");
};

const computeCentroid = (f: GeoFeature, p: Projection): Point | null => {
  let sx = 0,
    sy = 0,
    n = 0;
  eachCoord(f, (lon, lat) => {
    const pt = project(lon, lat, p);
    sx += pt.x;
    sy += pt.y;
    n++;
  });
  return n ? { x: sx / n, y: sy / n } : null;
};

const fetchGeoJson = async (url: string, signal: AbortSignal): Promise<GeoFeatureCollection> => {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  const j = (await r.json()) as GeoFeatureCollection;
  if (!Array.isArray(j.features)) throw new Error(`Invalid GeoJSON from ${url}`);
  return j;
};

const fmtVotes = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/* ──────────────────────────── Component ─────────────────────── */

const MapsPage = () => {
  /* ─── GeoJSON loading ─── */
  const [districtGeo, setDistrictGeo] = useState<GeoFeatureCollection | null>(null);
  const [constGeo, setConstGeo] = useState<GeoFeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setGeoLoading(true);
    setGeoError(null);

    Promise.all([
      fetchGeoJson(DISTRICT_GEOJSON_URL, ctrl.signal),
      fetchGeoJson(CONSTITUENCY_GEOJSON_URL, ctrl.signal),
    ])
      .then(([d, c]) => {
        setDistrictGeo(d);
        setConstGeo(c);
        setGeoLoading(false);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setGeoError(e instanceof Error ? e.message : "Unable to load map data");
        setGeoLoading(false);
      });

    return () => ctrl.abort();
  }, []);

  /* ─── API queries ─── */
  const summaryQuery = useQuery<MapSummaryResponse>({
    queryKey: ["map-summary"],
    queryFn: () => api.get("/elections/map-summary") as Promise<MapSummaryResponse>,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });

  const [selected, setSelected] = useState<SelectedMeta | null>(null);

  const detailQuery = useQuery<ConstituencyDetailResponse>({
    queryKey: [
      "constituency-detail",
      selected?.provinceId,
      selected?.districtSlug,
      selected?.constituencyNo,
    ],
    queryFn: () =>
      api.get(
        `/elections/constituency?provinceId=${selected!.provinceId}&district=${selected!.districtSlug}&constituencyNo=${selected!.constituencyNo}`
      ) as Promise<ConstituencyDetailResponse>,
    enabled: !!selected,
    staleTime: 60_000,
  });

  /* ─── Interaction state ─── */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAvatars, setShowAvatars] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const queuedPanRef = useRef<Point | null>(null);

  useEffect(() => {
    return () => {
      if (panFrameRef.current) cancelAnimationFrame(panFrameRef.current);
    };
  }, []);

  /* ─── Computed data ─── */
  const constFeatures = useMemo(
    () => (constGeo?.features ?? []).filter(isRenderable),
    [constGeo]
  );

  const districtFeatures = useMemo(
    () => (districtGeo?.features ?? []).filter(isRenderable),
    [districtGeo]
  );

  const summaryLookup = useMemo(() => {
    const m = new Map<string, MapConstituency>();
    for (const c of summaryQuery.data?.constituencies ?? []) {
      // DB slugs are canonical — index both raw and normalized forms
      const slug = normalizeKey(c.districtSlug);
      m.set(`${c.provinceId}-${slug}-${c.constituencyNo}`, c);
    }
    return m;
  }, [summaryQuery.data]);

  const bounds = useMemo(() => computeBounds(constFeatures), [constFeatures]);
  const proj = useMemo(() => (bounds ? mkProjection(bounds) : null), [bounds]);

  const rendered = useMemo<RenderedConstituency[]>(() => {
    if (!proj) return [];
    return constFeatures.map((f, i) => {
      const dn = toTitle(propStr(f, "DISTRICT", ""));
      const geoSlug = normalizeKey(dn);
      const ds = resolveSlug(geoSlug);
      const pid = Math.round(propNum(f, "STATE_C", 0));
      const cno = Math.round(propNum(f, "F_CONST", i + 1));
      const key = `${pid}-${ds}-${cno}`;
      const summary = summaryLookup.get(key);
      const leading = summary?.candidates?.[0];
      const status = getStatus(summary);
      const fillColor =
        status === "no-data"
          ? NO_DATA_COLOR
          : leading
            ? getPartyColor(leading.partyName)
            : FALLBACK_COLOR;

      return {
        key,
        districtName: dn,
        districtSlug: ds,
        provinceId: pid,
        constituencyNo: cno,
        path: buildPath(f, proj),
        centroid: computeCentroid(f, proj),
        fillColor,
        summary,
        status,
      };
    });
  }, [proj, constFeatures, summaryLookup]);

  const districtPaths = useMemo(() => {
    if (!proj) return [];
    return districtFeatures.map((f) => ({
      path: buildPath(f, proj),
      name: toTitle(propStr(f, "DISTRICT", "")),
    }));
  }, [proj, districtFeatures]);

  // Party legend — aggregated from rendered data
  const partyLegend = useMemo(() => {
    const counts = new Map<
      string,
      { color: string; image: string | null; count: number; elected: number }
    >();
    for (const rc of rendered) {
      const leading = rc.summary?.candidates?.[0];
      if (!leading) continue;
      const name = leading.partyName;
      const existing = counts.get(name);
      if (existing) {
        existing.count++;
        if (rc.status === "completed") existing.elected++;
      } else {
        counts.set(name, {
          color: rc.fillColor,
          image: leading.partyImage,
          count: 1,
          elected: rc.status === "completed" ? 1 : 0,
        });
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [rendered]);

  // Stats
  const stats = useMemo(() => {
    let completed = 0,
      counting = 0,
      notStarted = 0,
      noData = 0;
    for (const r of rendered) {
      if (r.status === "completed") completed++;
      else if (r.status === "counting") counting++;
      else if (r.status === "not-started") notStarted++;
      else noData++;
    }
    return { completed, counting, notStarted, noData, total: rendered.length };
  }, [rendered]);

  /* ─── Event handlers ─── */
  const clampPan = useCallback(
    (p: Point, z: number): Point => {
      const maxPanX = MAP_W * (z - 1);
      const maxPanY = MAP_H * (z - 1);
      return {
        x: clamp(p.x, -maxPanX, maxPanX * 0.1),
        y: clamp(p.y, -maxPanY, maxPanY * 0.1),
      };
    },
    []
  );

  const schedulePan = useCallback((next: Point, z?: number) => {
    const clamped = clampPan(next, z ?? 1);
    queuedPanRef.current = clamped;
    if (panFrameRef.current) return;
    panFrameRef.current = requestAnimationFrame(() => {
      if (queuedPanRef.current) setPan(queuedPanRef.current);
      panFrameRef.current = null;
    });
  }, [clampPan]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        moved: false,
        isPanning: false,
        pointerId: e.pointerId,
      };
    },
    [pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sc = MAP_W / Math.max(rect.width, 1);
      const dx = (e.clientX - dragRef.current.startX) * sc;
      const dy = (e.clientY - dragRef.current.startY) * sc;
      if (!dragRef.current.isPanning && Math.abs(dx) + Math.abs(dy) > 8) {
        dragRef.current.isPanning = true;
        dragRef.current.moved = true;
        setIsDragging(true);
        e.currentTarget.setPointerCapture(dragRef.current.pointerId);
      }
      if (!dragRef.current.isPanning) return;
      schedulePan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy }, zoom);
    },
    [schedulePan, zoom]
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.isPanning && e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
    setIsDragging(false);
  }, []);

  /* Scroll zoom removed — zoom only via buttons */

  const handleFeatureHover = useCallback(
    (rc: RenderedConstituency, e: ReactMouseEvent<SVGPathElement>) => {
      const svgRect =
        e.currentTarget.ownerSVGElement?.getBoundingClientRect() ??
        e.currentTarget.getBoundingClientRect();
      setHoveredKey(rc.key);
      setTooltip({
        x: clamp(e.clientX - svgRect.left + 14, 8, svgRect.width - 240),
        y: clamp(e.clientY - svgRect.top + 14, 8, svgRect.height - 120),
        districtName: rc.districtName,
        constituencyNo: rc.constituencyNo,
        provinceId: rc.provinceId,
        leadingParty: rc.summary?.candidates?.[0]?.partyName ?? null,
        leadingVotes: rc.summary?.candidates?.[0]?.totalVotes ?? 0,
        status: rc.status,
      });
    },
    []
  );

  const handleFeatureLeave = useCallback(() => {
    setHoveredKey(null);
    setTooltip(null);
  }, []);

  const handleFeatureClick = useCallback(
    (rc: RenderedConstituency) => {
      if (dragRef.current?.moved) return;
      setSelected({
        provinceId: rc.provinceId,
        districtSlug: rc.districtSlug,
        constituencyNo: rc.constituencyNo,
        districtName: rc.districtName,
      });
    },
    []
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /* ─── Detail panel helpers ─── */
  const sortedDetailCandidates = useMemo(() => {
    if (!detailQuery.data?.candidates?.length) return [];
    return [...detailQuery.data.candidates]
      .sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0))
      .slice(0, 3);
  }, [detailQuery.data]);

  const maxDetailVotes = useMemo(
    () => Math.max(1, ...sortedDetailCandidates.map((c) => c.totalVotes || 0)),
    [sortedDetailCandidates]
  );

  const detailStatus: ConstituencyStatus = useMemo(() => {
    if (!detailQuery.data) return "no-data";
    if (detailQuery.data.isCompleted) return "completed";
    const total = (detailQuery.data.candidates ?? []).reduce(
      (s, c) => s + (c.totalVotes || 0),
      0
    );
    return total === 0 ? "not-started" : "counting";
  }, [detailQuery.data]);

  /* ─── Render ─── */
  const selectedKey = selected
    ? `${selected.provinceId}-${normalizeKey(selected.districtSlug)}-${selected.constituencyNo}`
    : null;

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <AppMenu />

      <section className="mx-auto w-full max-w-[1600px] space-y-4 px-2 py-3 sm:px-3 sm:py-4 md:px-6 lg:px-8">
        {/* ── Header ── */}
        <header className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Nepal General Election 2082
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Live Constituency Map
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                Each area is colored by the <strong>leading party</strong>. Hover for
                quick info, click for detailed results.
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {stats.completed} Completed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stats.counting} Counting
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 font-semibold text-slate-400">
                <Minus className="h-3 w-3" />
                {stats.notStarted + stats.noData} Pending
              </span>
            </div>
          </div>
        </header>

        {/* ── Loading / Error states ── */}
        {geoLoading && (
          <section className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map layers…
          </section>
        )}

        {geoError && (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {geoError}
          </section>
        )}

        {/* ── Map + Sidebar ── */}
        {!geoLoading && !geoError && (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px]">
            {/* ── Map Panel ── */}
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-sm">
                <svg
                  className={`w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                  viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                  style={{ touchAction: "none", aspectRatio: "11 / 9", minHeight: "60vh" }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#0f172a" />

                  {/* Reusable circular clip for party avatars */}
                  <defs>
                    <clipPath id="avatar-circle" clipPathUnits="objectBoundingBox">
                      <circle cx="0.5" cy="0.5" r="0.5" />
                    </clipPath>
                  </defs>

                  <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    {/* Constituency fills */}
                    {rendered.map((rc) => {
                      const isHovered = hoveredKey === rc.key;
                      const isSelected = selectedKey === rc.key;
                      return (
                        <path
                          key={rc.key}
                          d={rc.path}
                          fill={rc.fillColor}
                          fillOpacity={
                            isSelected ? 0.95 : isHovered ? 0.88 : rc.status === "no-data" ? 0.35 : 0.7
                          }
                          stroke={isSelected ? "#f8fafc" : isHovered ? "#e2e8f0" : "#475569"}
                          strokeWidth={isSelected ? 1.6 : isHovered ? 1.2 : 0.5}
                          fillRule="evenodd"
                          style={{ transition: "fill-opacity 120ms, stroke-width 120ms" }}
                          onMouseEnter={(e) => handleFeatureHover(rc, e)}
                          onMouseMove={(e) => handleFeatureHover(rc, e)}
                          onMouseLeave={handleFeatureLeave}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeatureClick(rc);
                          }}
                        />
                      );
                    })}

                    {/* District border overlay */}
                    {districtPaths.map((dp) => (
                      <path
                        key={`d-${dp.name}`}
                        d={dp.path}
                        fill="none"
                        stroke="rgba(255,255,255,0.30)"
                        strokeWidth={Math.max(0.6 / zoom, 0.15)}
                        strokeLinejoin="round"
                        pointerEvents="none"
                      />
                    ))}

                    {/* Party avatars at centroids */}
                    {showAvatars &&
                      zoom >= 1.8 &&
                      rendered.map((rc) => {
                        const img = rc.summary?.candidates?.[0]?.partyImage;
                        if (!rc.centroid || !img) return null;
                        const sz = Math.max(6, 10 / zoom);
                        return (
                          <image
                            key={`av-${rc.key}`}
                            href={img}
                            x={rc.centroid.x - sz / 2}
                            y={rc.centroid.y - sz / 2}
                            width={sz}
                            height={sz}
                            clipPath="url(#avatar-circle)"
                            pointerEvents="none"
                            opacity={0.9}
                          />
                        );
                      })}
                  </g>
                </svg>

                {/* Zoom controls */}
                <div className="absolute right-3 top-3 flex flex-col gap-1.5">
                  {(
                    [
                      [ZoomIn, () => {
                        setZoom((p) => {
                          const next = clamp(p * 1.2, 0.8, 10);
                          setPan((cur) => clampPan(cur, next));
                          return next;
                        });
                      }, "Zoom in"],
                      [ZoomOut, () => {
                        setZoom((p) => {
                          const next = clamp(p * 0.8, 0.8, 10);
                          setPan((cur) => clampPan(cur, next));
                          return next;
                        });
                      }, "Zoom out"],
                      [RotateCcw, resetView, "Reset"],
                    ] as const
                  ).map(([Icon, handler, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={handler}
                      className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-200 backdrop-blur transition hover:bg-slate-700"
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>

                {/* Status bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur">
                    <span className="inline-flex items-center gap-1">
                      <LocateFixed className="h-3 w-3" /> {rendered.length} constituencies
                    </span>
                    <span>Zoom {zoom.toFixed(1)}×</span>
                    {summaryQuery.isLoading && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading data…
                      </span>
                    )}
                  </div>

                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur transition hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showAvatars}
                      onChange={(e) => setShowAvatars(e.target.checked)}
                      className="h-3 w-3 accent-primary"
                    />
                    Party logos
                  </label>
                </div>

                {/* Tooltip */}
                {tooltip && (
                  <div
                    className="pointer-events-none absolute z-30 w-60 rounded-xl border border-slate-600/80 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur"
                    style={{ left: tooltip.x, top: tooltip.y }}
                  >
                    <p className="font-semibold text-slate-100">
                      {tooltip.districtName} — Constituency {tooltip.constituencyNo}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {PROVINCE_NAMES[tooltip.provinceId] ?? "Unknown"} (Province{" "}
                      {tooltip.provinceId})
                    </p>

                    {tooltip.leadingParty && (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getPartyColor(tooltip.leadingParty) }}
                        />
                        <span className="truncate font-medium text-slate-200">
                          {tooltip.leadingParty}
                        </span>
                        <span className="ml-auto font-semibold text-slate-100">
                          {fmtVotes(tooltip.leadingVotes)}
                        </span>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center gap-1.5">
                      {tooltip.status === "completed" && (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Completed</span>
                        </>
                      )}
                      {tooltip.status === "counting" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                          <span className="text-amber-400">Counting in progress</span>
                        </>
                      )}
                      {tooltip.status === "not-started" && (
                        <span className="text-slate-500">Counting not started</span>
                      )}
                      {tooltip.status === "no-data" && (
                        <span className="text-slate-500">No data yet</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Instruction strip — hidden on very small screens */}
              <div className="hidden items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-2 text-xs text-muted-foreground sm:flex">
                <p>
                  <strong>+/−</strong> to zoom · <strong>Drag</strong> to pan ·{" "}
                  <strong>Hover</strong> for info · <strong>Click</strong> for full results
                </p>
              </div>
              <p className="text-center text-[10px] text-muted-foreground sm:hidden">
                Pinch to zoom · Drag to pan · Tap for details
              </p>
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-3">
              {/* Detail Panel (shown when a constituency is selected) */}
              {selected && (
                <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    <ChevronLeft className="h-3 w-3" /> Back to legend
                  </button>

                  <h2 className="text-lg font-semibold text-foreground">
                    {selected.districtName} — {selected.constituencyNo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {PROVINCE_NAMES[selected.provinceId] ?? ""} (Province {selected.provinceId})
                  </p>

                  {/* Status badge */}
                  <div className="mt-3">
                    {detailQuery.isLoading && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading results…
                      </span>
                    )}

                    {detailQuery.isError && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                        Failed to load
                      </span>
                    )}

                    {detailQuery.data && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                          detailStatus === "completed"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : detailStatus === "counting"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {detailStatus === "completed" && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {detailStatus === "counting" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {detailStatus === "completed"
                          ? "Result Declared"
                          : detailStatus === "counting"
                            ? "Counting in Progress"
                            : "Not Started"}
                      </span>
                    )}
                  </div>

                  {/* Top 3 candidates */}
                  {sortedDetailCandidates.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        Top Candidates
                      </p>
                      {sortedDetailCandidates.map((c, i) => {
                        const barW = maxDetailVotes
                          ? ((c.totalVotes || 0) / maxDetailVotes) * 100
                          : 0;
                        const partyCol = getPartyColor(c.partyName);
                        return (
                          <div
                            key={`${c.candidateName}-${i}`}
                            className="rounded-xl border border-border/60 bg-background/60 p-3"
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Position badge */}
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  i === 0
                                    ? "bg-amber-500/20 text-amber-400"
                                    : i === 1
                                      ? "bg-slate-500/20 text-slate-300"
                                      : "bg-slate-700/30 text-slate-400"
                                }`}
                              >
                                {i + 1}
                              </span>

                              {/* Candidate + Party avatars stacked */}
                              <div className="relative shrink-0">
                                <img
                                  src={c.candidateImage || c.candidateAvatarUrl || AVATAR_FALLBACK}
                                  alt=""
                                  className="h-9 w-9 rounded-full border-2 border-background bg-slate-800 object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = AVATAR_FALLBACK;
                                  }}
                                />
                                <img
                                  src={c.partyImage || c.partyAvatarUrl || PARTY_FALLBACK}
                                  alt=""
                                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background bg-slate-800 object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = PARTY_FALLBACK;
                                  }}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {c.candidateName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {c.partyName}
                                </p>
                              </div>

                              <span className="shrink-0 text-right text-sm font-bold text-foreground">
                                {c.totalVotes?.toLocaleString() ?? "0"}
                              </span>
                            </div>

                            {/* Vote bar */}
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${barW}%`,
                                  backgroundColor: partyCol,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {detailQuery.data &&
                    sortedDetailCandidates.length === 0 && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No candidate data available yet.
                      </p>
                    )}
                </section>
              )}

              {/* Party Legend (shown when nothing is selected) */}
              {!selected && (
                <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    Leading Parties
                  </p>

                  {summaryQuery.isLoading && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  )}

                  {partyLegend.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {partyLegend.map(([name, info]) => (
                        <div
                          key={name}
                          className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/50 px-3 py-2"
                        >
                          <img
                            src={info.image || PARTY_FALLBACK}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full border border-border/40 bg-slate-800 object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PARTY_FALLBACK;
                            }}
                          />
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: info.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {name}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                            {info.count}
                            <span className="ml-0.5 text-[10px] font-normal">seats</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!summaryQuery.isLoading && partyLegend.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No election data available yet. Results will appear as counting progresses.
                    </p>
                  )}
                </section>
              )}

              {/* Map info */}
              <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Status Legend
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-foreground">Result declared</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-foreground">Counting in progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-foreground">Not started / No data</span>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                  <p>
                    District layer:{" "}
                    <span className="font-semibold text-foreground">
                      {districtFeatures.length}
                    </span>{" "}
                    features
                  </p>
                  <p>
                    Constituency layer:{" "}
                    <span className="font-semibold text-foreground">
                      {constFeatures.length}
                    </span>{" "}
                    features
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
};

export default MapsPage;

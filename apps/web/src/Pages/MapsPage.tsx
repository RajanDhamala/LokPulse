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
  Clock3,
  Loader2,
  LocateFixed,
  Minus,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { FINAL_RESULTS_PUBLISHED_LABEL } from "@/lib/time";

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
  longitudeScale: number;
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
  scaleX: number;
  scaleY: number;
  moved: boolean;
  isPanning: boolean;
  pointerId: number;
}

interface TooltipPointer {
  clientX: number;
  clientY: number;
  svg: SVGSVGElement;
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
interface ConstituencyGeometry {
  key: string;
  districtName: string;
  districtSlug: string;
  provinceId: number;
  constituencyNo: number;
  path: string;
  centroid: Point | null;
}

interface RenderedConstituency extends ConstituencyGeometry {
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

interface BoundarySegment {
  a: Position;
  b: Position;
  aKey: string;
  bKey: string;
  count: number;
}

/* ──────────────────────────── Constants ──────────────────────── */

const MAP_W = 1100;
const MAP_H = 700;
const MAP_PAD = 24;
const MAP_ASPECT_RATIO = `${MAP_W} / ${MAP_H}`;
const BASE_PAN_ALLOWANCE_X = MAP_W * 0.12;
const BASE_PAN_ALLOWANCE_Y = MAP_H * 0.12;
const CONSTITUENCY_PATH_TOLERANCE = 0.2;
const OUTLINE_PATH_TOLERANCE = 0.3;

// Local snapshot of the 165-seat boundary dataset. District borders are derived
// from this same geometry so the current 77 districts align with constituencies.
const CONSTITUENCY_GEOJSON_URL = "/geojson/nepal-constituencies.geojson";
const NATIONAL_OUTLINE_GEOJSON_URL = "/geojson/nepal-national-outline.geojson";
const DISTRICT_COUNT = 77;

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
  const middleLatitude = (b.minLat + b.maxLat) / 2;
  const longitudeScale = Math.cos((middleLatitude * Math.PI) / 180);
  const lonSpan = Math.max((b.maxLon - b.minLon) * longitudeScale, 1e-4);
  const latSpan = Math.max(b.maxLat - b.minLat, 1e-4);
  const scale = Math.min((MAP_W - MAP_PAD * 2) / lonSpan, (MAP_H - MAP_PAD * 2) / latSpan);
  const pw = lonSpan * scale,
    ph = latSpan * scale;
  return {
    scale,
    offsetX: (MAP_W - pw) / 2 - b.minLon * longitudeScale * scale,
    offsetY: (MAP_H - ph) / 2 + b.maxLat * scale,
    longitudeScale,
  };
};

const project = (lon: number, lat: number, p: Projection): Point => ({
  x: lon * p.longitudeScale * p.scale + p.offsetX,
  y: p.offsetY - lat * p.scale,
});

const pointSegmentDistanceSquared = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }
  const amount = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1
  );
  const nearestX = start.x + amount * dx;
  const nearestY = start.y + amount * dy;
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
};

const simplifyLine = (points: Point[], tolerance = 0.25): Point[] => {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  const toleranceSquared = tolerance * tolerance;

  while (stack.length) {
    const [start, end] = stack.pop()!;
    let furthestIndex = -1;
    let furthestDistance = toleranceSquared;
    for (let index = start + 1; index < end; index += 1) {
      const distance = pointSegmentDistanceSquared(points[index], points[start], points[end]);
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthestIndex = index;
      }
    }
    if (furthestIndex >= 0) {
      keep[furthestIndex] = 1;
      stack.push([start, furthestIndex], [furthestIndex, end]);
    }
  }

  return points.filter((_, index) => keep[index]);
};

const simplifyRing = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 4) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const isExplicitlyClosed = first.x === last.x && first.y === last.y;
  const open = isExplicitlyClosed ? points.slice(0, -1) : points;
  if (open.length <= 3) return open;

  // Ramer-Douglas-Peucker needs distinct endpoints. Split a closed ring at the
  // vertex furthest from its first point, simplify both arcs, then join them.
  let splitIndex = 1;
  let splitDistance = -1;
  for (let index = 1; index < open.length; index += 1) {
    const distance = (open[index].x - first.x) ** 2 + (open[index].y - first.y) ** 2;
    if (distance > splitDistance) {
      splitDistance = distance;
      splitIndex = index;
    }
  }

  const firstArc = simplifyLine(open.slice(0, splitIndex + 1), tolerance);
  const secondArc = simplifyLine([...open.slice(splitIndex), first], tolerance);
  const simplified = [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)];
  return simplified.length >= 3 ? simplified : open;
};

const buildPath = (
  f: GeoFeature,
  p: Projection,
  tolerance = CONSTITUENCY_PATH_TOLERANCE
) => {
  const cmds: string[] = [];
  for (const poly of getPolygons(f))
    for (const ring of poly) {
      const projected: Point[] = [];
      for (const coordinate of ring) {
        const lon = Number(coordinate[0]);
        const lat = Number(coordinate[1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          projected.push(project(lon, lat, p));
        }
      }

      const points = simplifyRing(projected, tolerance);
      if (points.length < 3) continue;
      cmds.push(`M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);
      for (let index = 1; index < points.length; index += 1) {
        cmds.push(`L${points[index].x.toFixed(2)} ${points[index].y.toFixed(2)}`);
      }
      cmds.push("Z");
    }
  return cmds.join("");
};

const coordinateKey = (point: Position) =>
  `${Number(point[0]).toFixed(6)},${Number(point[1]).toFixed(6)}`;

const addRingSegments = (segments: Map<string, BoundarySegment>, ring: Ring) => {
  for (let index = 1; index < ring.length; index += 1) {
    const a: Position = [Number(ring[index - 1][0]), Number(ring[index - 1][1])];
    const b: Position = [Number(ring[index][0]), Number(ring[index][1])];
    if (![...a, ...b].every(Number.isFinite)) continue;
    const aKey = coordinateKey(a);
    const bKey = coordinateKey(b);
    const segmentKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    const existing = segments.get(segmentKey);
    if (existing) existing.count += 1;
    else segments.set(segmentKey, { a, b, aKey, bKey, count: 1 });
  }
};

const traceBoundaryLines = (segments: Map<string, BoundarySegment>): Position[][] => {
  const boundary = [...segments.values()].filter((segment) => segment.count === 1);
  const adjacency = new Map<string, number[]>();
  const coordinates = new Map<string, Position>();
  boundary.forEach((segment, index) => {
    const atA = adjacency.get(segment.aKey) ?? [];
    const atB = adjacency.get(segment.bKey) ?? [];
    atA.push(index);
    atB.push(index);
    adjacency.set(segment.aKey, atA);
    adjacency.set(segment.bKey, atB);
    coordinates.set(segment.aKey, segment.a);
    coordinates.set(segment.bKey, segment.b);
  });

  const visited = new Uint8Array(boundary.length);
  const lines: Position[][] = [];
  for (let seed = 0; seed < boundary.length; seed += 1) {
    if (visited[seed]) continue;
    const first = boundary[seed];
    let currentKey = (adjacency.get(first.aKey)?.length ?? 0) === 1 ? first.aKey : first.bKey;
    const startKey = currentKey;
    const line: Position[] = [coordinates.get(currentKey)!];

    while (true) {
      const nextIndex = (adjacency.get(currentKey) ?? []).find((index) => !visited[index]);
      if (nextIndex === undefined) break;
      visited[nextIndex] = 1;
      const segment = boundary[nextIndex];
      currentKey = segment.aKey === currentKey ? segment.bKey : segment.aKey;
      line.push(coordinates.get(currentKey)!);
      if (currentKey === startKey) break;
    }
    lines.push(line);
  }

  return lines;
};

const lineToPath = (
  line: Position[],
  projection: Projection,
  tolerance = 0.25,
  closePath = false
) => {
  const projected = simplifyLine(
    line.map(([lon, lat]) => project(lon, lat, projection)),
    tolerance
  );
  if (projected.length < 2) return "";
  const commands = [`M${projected[0].x.toFixed(2)} ${projected[0].y.toFixed(2)}`];
  for (let index = 1; index < projected.length; index += 1) {
    commands.push(`L${projected[index].x.toFixed(2)} ${projected[index].y.toFixed(2)}`);
  }
  if (closePath) commands.push("Z");
  return commands.join("");
};

const buildDistrictBoundaryPaths = (features: GeoFeature[], projection: Projection) => {
  const districtSegments = new Map<string, Map<string, BoundarySegment>>();

  for (const feature of features) {
    const districtName = toTitle(propStr(feature, "DISTRICT", ""));
    if (!districtName) continue;
    const segments = districtSegments.get(districtName) ?? new Map<string, BoundarySegment>();
    districtSegments.set(districtName, segments);

    for (const polygon of getPolygons(feature)) {
      for (const ring of polygon) addRingSegments(segments, ring);
    }
  }

  return [...districtSegments.entries()].map(([name, segments]) => {
    const path = traceBoundaryLines(segments)
      .map((line) => lineToPath(line, projection))
      .join("");
    return { name, path };
  });
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

const geoJsonCache = new Map<string, GeoFeatureCollection>();

const fetchGeoJson = async (url: string, signal: AbortSignal): Promise<GeoFeatureCollection> => {
  const cached = geoJsonCache.get(url);
  if (cached) return cached;

  const r = await fetch(url, { signal, cache: "force-cache" });
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  const j = (await r.json()) as GeoFeatureCollection;
  if (!Array.isArray(j.features)) throw new Error(`Invalid GeoJSON from ${url}`);
  geoJsonCache.set(url, j);
  return j;
};

const fmtVotes = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/* ──────────────────────────── Component ─────────────────────── */

const MapsPage = () => {
  /* ─── GeoJSON loading ─── */
  const [constGeo, setConstGeo] = useState<GeoFeatureCollection | null>(null);
  const [countryGeo, setCountryGeo] = useState<GeoFeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setGeoLoading(true);
    setGeoError(null);

    Promise.all([
      fetchGeoJson(CONSTITUENCY_GEOJSON_URL, ctrl.signal),
      fetchGeoJson(NATIONAL_OUTLINE_GEOJSON_URL, ctrl.signal),
    ])
      .then(([constituencies, country]) => {
        setConstGeo(constituencies);
        setCountryGeo(country);
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
    staleTime: Infinity,
    gcTime: 60 * 60_000,
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
    staleTime: Infinity,
  });

  /* ─── Interaction state ─── */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAvatars, setShowAvatars] = useState(false);
  const [showMapNote, setShowMapNote] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const mapLayerRef = useRef<SVGGElement | null>(null);
  const panRef = useRef<Point>(pan);
  const panFrameRef = useRef<number | null>(null);
  const queuedPanRef = useRef<Point | null>(null);
  const queuedZoomRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const tooltipMoveFrameRef = useRef<number | null>(null);
  const queuedTooltipPointerRef = useRef<TooltipPointer | null>(null);

  useEffect(() => {
    return () => {
      if (panFrameRef.current) cancelAnimationFrame(panFrameRef.current);
      if (tooltipMoveFrameRef.current) cancelAnimationFrame(tooltipMoveFrameRef.current);
    };
  }, []);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    if (!selected || window.matchMedia("(min-width: 1280px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  /* ─── Computed data ─── */
  const constFeatures = useMemo(
    () => (constGeo?.features ?? []).filter(isRenderable),
    [constGeo]
  );
  const countryFeatures = useMemo(
    () => (countryGeo?.features ?? []).filter(isRenderable),
    [countryGeo]
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

  const bounds = useMemo(
    () => computeBounds([...countryFeatures, ...constFeatures]),
    [countryFeatures, constFeatures]
  );
  const proj = useMemo(() => (bounds ? mkProjection(bounds) : null), [bounds]);

  // Geometry is independent from the API summary. Keeping it in a separate memo
  // avoids rebuilding thousands of SVG commands when result data arrives.
  const constituencyGeometry = useMemo<ConstituencyGeometry[]>(() => {
    if (!proj) return [];
    return constFeatures.map((f, i) => {
      const dn = toTitle(propStr(f, "DISTRICT", ""));
      const geoSlug = normalizeKey(dn);
      const ds = resolveSlug(geoSlug);
      const pid = Math.round(propNum(f, "STATE_C", 0));
      const cno = Math.round(propNum(f, "F_CONST", i + 1));
      const key = `${pid}-${ds}-${cno}`;

      return {
        key,
        districtName: dn,
        districtSlug: ds,
        provinceId: pid,
        constituencyNo: cno,
        path: buildPath(f, proj),
        centroid: computeCentroid(f, proj),
      };
    });
  }, [proj, constFeatures]);

  const rendered = useMemo<RenderedConstituency[]>(() => {
    return constituencyGeometry.map((geometry) => {
      const summary = summaryLookup.get(geometry.key);
      const leading = summary?.candidates?.[0];
      const status = getStatus(summary);
      const fillColor =
        status === "no-data"
          ? NO_DATA_COLOR
          : leading
            ? getPartyColor(leading.partyName)
            : FALLBACK_COLOR;

      return {
        ...geometry,
        fillColor,
        summary,
        status,
      };
    });
  }, [constituencyGeometry, summaryLookup]);

  const districtPaths = useMemo(() => {
    if (!proj) return [];
    return buildDistrictBoundaryPaths(constFeatures, proj);
  }, [proj, constFeatures]);

  const countryOutlinePath = useMemo(() => {
    if (!proj) return "";
    return countryFeatures
      .map((feature) => buildPath(feature, proj, OUTLINE_PATH_TOLERANCE))
      .join("");
  }, [proj, countryFeatures]);

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
      const maxPanX = MAP_W * Math.max(z - 1, 0) + BASE_PAN_ALLOWANCE_X;
      const maxPanY = MAP_H * Math.max(z - 1, 0) + BASE_PAN_ALLOWANCE_Y;
      return {
        x: clamp(p.x, -maxPanX, maxPanX),
        y: clamp(p.y, -maxPanY, maxPanY),
      };
    },
    []
  );

  const schedulePan = useCallback((next: Point, z?: number) => {
    const nextZoom = z ?? 1;
    const clamped = clampPan(next, nextZoom);
    queuedPanRef.current = clamped;
    queuedZoomRef.current = nextZoom;
    if (panFrameRef.current) return;
    panFrameRef.current = requestAnimationFrame(() => {
      const queuedPan = queuedPanRef.current;
      const queuedZoom = queuedZoomRef.current;
      if (queuedPan && queuedZoom !== null) {
        panRef.current = queuedPan;
        mapLayerRef.current?.setAttribute(
          "transform",
          `translate(${queuedPan.x} ${queuedPan.y}) scale(${queuedZoom})`
        );
      }
      panFrameRef.current = null;
    });
  }, [clampPan]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        scaleX: MAP_W / Math.max(rect.width, 1),
        scaleY: MAP_H / Math.max(rect.height, 1),
        moved: false,
        isPanning: false,
        pointerId: e.pointerId,
      };
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) * dragRef.current.scaleX;
      const dy = (e.clientY - dragRef.current.startY) * dragRef.current.scaleY;
      if (!dragRef.current.isPanning && Math.abs(dx) + Math.abs(dy) > 8) {
        dragRef.current.isPanning = true;
        dragRef.current.moved = true;
        setIsDragging(true);
        if (tooltipMoveFrameRef.current) {
          cancelAnimationFrame(tooltipMoveFrameRef.current);
          tooltipMoveFrameRef.current = null;
        }
        queuedTooltipPointerRef.current = null;
        setTooltip(null);
        e.currentTarget.setPointerCapture(dragRef.current.pointerId);
      }
      if (!dragRef.current.isPanning) return;
      schedulePan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy }, zoom);
    },
    [schedulePan, zoom]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const wasPanning = dragRef.current?.isPanning ?? false;
      if (wasPanning && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (wasPanning) {
        if (panFrameRef.current) {
          cancelAnimationFrame(panFrameRef.current);
          panFrameRef.current = null;
        }
        const finalPan = queuedPanRef.current ?? panRef.current;
        const finalZoom = queuedZoomRef.current ?? zoom;
        panRef.current = finalPan;
        mapLayerRef.current?.setAttribute(
          "transform",
          `translate(${finalPan.x} ${finalPan.y}) scale(${finalZoom})`
        );
        setPan(finalPan);
        queuedPanRef.current = null;
        queuedZoomRef.current = null;
      }

      setTimeout(() => {
        dragRef.current = null;
      }, 0);
      setIsDragging(false);
    },
    [zoom]
  );

  /* Scroll zoom removed — zoom only via buttons */

  const getTooltipPosition = useCallback((clientX: number, clientY: number, svgRect: DOMRect): Point => {
    return {
      x: clamp(clientX - svgRect.left + 14, 8, svgRect.width - 240),
      y: clamp(clientY - svgRect.top + 14, 8, svgRect.height - 120),
    };
  }, []);

  const moveTooltip = useCallback(
    (e: ReactMouseEvent<SVGPathElement>) => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg || dragRef.current?.isPanning) return;
      queuedTooltipPointerRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        svg,
      };
      if (tooltipMoveFrameRef.current) return;
      tooltipMoveFrameRef.current = requestAnimationFrame(() => {
        const pointer = queuedTooltipPointerRef.current;
        if (pointer && tooltipRef.current) {
          const position = getTooltipPosition(
            pointer.clientX,
            pointer.clientY,
            pointer.svg.getBoundingClientRect()
          );
          tooltipRef.current.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
        }
        tooltipMoveFrameRef.current = null;
      });
    },
    [getTooltipPosition]
  );

  const handleFeatureEnter = useCallback(
    (rc: RenderedConstituency, e: ReactMouseEvent<SVGPathElement>) => {
      if (dragRef.current?.isPanning) return;
      const svgRect =
        e.currentTarget.ownerSVGElement?.getBoundingClientRect() ??
        e.currentTarget.getBoundingClientRect();
      const position = getTooltipPosition(e.clientX, e.clientY, svgRect);
      setTooltip({
        ...position,
        districtName: rc.districtName,
        constituencyNo: rc.constituencyNo,
        provinceId: rc.provinceId,
        leadingParty: rc.summary?.candidates?.[0]?.partyName ?? null,
        leadingVotes: rc.summary?.candidates?.[0]?.totalVotes ?? 0,
        status: rc.status,
      });
    },
    [getTooltipPosition]
  );

  const handleFeatureLeave = useCallback(() => {
    if (tooltipMoveFrameRef.current) {
      cancelAnimationFrame(tooltipMoveFrameRef.current);
      tooltipMoveFrameRef.current = null;
    }
    queuedTooltipPointerRef.current = null;
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
    const origin = { x: 0, y: 0 };
    panRef.current = origin;
    setPan(origin);
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

  const constituencyShapes = useMemo(
    () =>
      rendered.map((rc) => {
        const isSelected = selectedKey === rc.key;
        return (
          <path
            key={rc.key}
            className="map-constituency"
            data-selected={isSelected ? "true" : undefined}
            d={rc.path}
            fill={rc.fillColor}
            fillOpacity={isSelected ? 0.95 : rc.status === "no-data" ? 0.35 : 0.7}
            stroke={isSelected ? "#f8fafc" : "#475569"}
            strokeWidth={isSelected ? 1.6 : 0.5}
            fillRule="evenodd"
            onMouseEnter={(event) => handleFeatureEnter(rc, event)}
            onMouseMove={moveTooltip}
            onMouseLeave={handleFeatureLeave}
            onClick={(event) => {
              event.stopPropagation();
              handleFeatureClick(rc);
            }}
          />
        );
      }),
    [
      rendered,
      selectedKey,
      handleFeatureEnter,
      moveTooltip,
      handleFeatureLeave,
      handleFeatureClick,
    ]
  );

  const districtShapes = useMemo(
    () =>
      districtPaths.map((district) => (
        <path
          key={`d-${district.name}`}
          d={district.path}
          fill="none"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={0.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )),
    [districtPaths]
  );

  const countryBaseShape = useMemo(
    () =>
      countryOutlinePath ? (
        <path d={countryOutlinePath} fill="#475569" fillOpacity={0.78} pointerEvents="none" />
      ) : null,
    [countryOutlinePath]
  );

  const countryBorderShape = useMemo(
    () =>
      countryOutlinePath ? (
        <path
          d={countryOutlinePath}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1.1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null,
    [countryOutlinePath]
  );

  const partyLogoShapes = useMemo(() => {
    if (!showAvatars || zoom < 2.5) return null;
    return rendered.map((rc) => {
      const img = rc.summary?.candidates?.[0]?.partyImage;
      if (!rc.centroid || !img) return null;
      const size = Math.max(6, 10 / zoom);
      return (
        <image
          key={`av-${rc.key}`}
          href={img}
          x={rc.centroid.x - size / 2}
          y={rc.centroid.y - size / 2}
          width={size}
          height={size}
          clipPath="url(#avatar-circle)"
          pointerEvents="none"
          opacity={0.9}
        />
      );
    });
  }, [rendered, showAvatars, zoom]);

  return (
    <main className="min-h-[calc(100svh-4.5rem)] min-w-0 overflow-x-clip bg-background text-foreground">
      <section className="mx-auto min-w-0 w-full max-w-[1600px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ── Header ── */}
        <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-secondary/60 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_18px_46px_-32px_rgb(15_23_42/0.3)] sm:p-6 dark:rounded-xl dark:border-border dark:bg-card dark:bg-none dark:shadow-sm">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-brand/45 to-transparent dark:hidden" />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-brand dark:text-muted-foreground sm:text-xs">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand dark:hidden" />
                Nepal General Election 2082
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Final Constituency Map
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                Each area is colored by the <strong>winning party</strong>. Hover for
                quick info, click for detailed results.
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-semibold text-primary">
                <Clock3 className="h-3 w-3" />
                {FINAL_RESULTS_PUBLISHED_LABEL}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {stats.completed} Completed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stats.counting} Counting
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 font-semibold text-slate-600 dark:text-slate-400">
                <Minus className="h-3 w-3" />
                {stats.notStarted + stats.noData} Pending
              </span>
            </div>
          </div>
        </header>

        {/* ── Loading / Error states ── */}
        {geoLoading && (
          <section className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map layers…
          </section>
        )}

        {geoError && (
          <section className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {geoError}
          </section>
        )}

        {/* ── Map + Sidebar ── */}
        {!geoLoading && !geoError && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* ── Map Panel ── */}
            <div className="min-w-0 space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 shadow-sm">
                <svg
                  className={`h-[270px] w-full select-none sm:h-auto sm:min-h-[320px] ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                  viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                  style={{
                    touchAction: "pan-y",
                    aspectRatio: MAP_ASPECT_RATIO,
                  }}
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
                    <style>{`
                      .map-constituency {
                        transition: fill-opacity 120ms, stroke-width 120ms;
                      }
                      .map-constituency:hover:not([data-selected="true"]) {
                        fill-opacity: 0.88;
                        stroke: #e2e8f0;
                        stroke-width: 1.2;
                      }
                    `}</style>
                  </defs>

                  <g
                    ref={mapLayerRef}
                    transform={`translate(${isDragging ? panRef.current.x : pan.x} ${
                      isDragging ? panRef.current.y : pan.y
                    }) scale(${zoom})`}
                    style={{ willChange: "transform" }}
                  >
                    {/* Complete Nepal silhouette fills protected/uninhabited gaps */}
                    {countryBaseShape}

                    {/* Constituency fills */}
                    {constituencyShapes}

                    {/* District border overlay */}
                    {districtShapes}

                    {/* National border stays visible above the result fills */}
                    {countryBorderShape}

                    {/* Party avatars at centroids */}
                    {partyLogoShapes}
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
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-slate-200 backdrop-blur transition hover:bg-slate-700 sm:h-10 sm:w-10"
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>

                {/* Status bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="hidden items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur sm:flex">
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

                  <label className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur transition hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showAvatars}
                      onChange={(e) => setShowAvatars(e.target.checked)}
                      className="h-3.5 w-3.5 accent-white"
                    />
                    Party logos
                  </label>
                </div>

                {/* Tooltip */}
                {tooltip && (
                  <div
                    ref={tooltipRef}
                    className="pointer-events-none absolute z-30 w-60 rounded-xl border border-slate-600/80 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur"
                    style={{
                      left: 0,
                      top: 0,
                      transform: `translate3d(${tooltip.x}px, ${tooltip.y}px, 0)`,
                      willChange: "transform",
                    }}
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
              <div className="hidden items-center justify-between rounded-lg border border-border bg-muted/55 px-4 py-2 text-xs text-muted-foreground dark:bg-muted/30 sm:flex">
                <p>
                  <strong>+/−</strong> to zoom · <strong>Drag</strong> to pan ·{" "}
                  <strong>Hover</strong> for info · <strong>Click</strong> for full results
                </p>
              </div>
              <p className="text-center text-[10px] text-muted-foreground sm:hidden">
                Use +/− to zoom · Drag sideways to pan · Tap for details
              </p>
              {showMapNote && (
                <div className="relative rounded-lg border border-border bg-muted/55 px-3 py-2 pr-10 text-[10px] leading-relaxed text-muted-foreground dark:bg-muted/30 sm:text-xs">
                  <p>
                    <strong className="text-foreground">Map note:</strong> The border is illustrative,
                    not a legal reference. Neutral spaces show land without a separate constituency
                    polygon, commonly protected, special, or uninhabited areas. Boundary: {" "}
                    <a
                      href="https://localboundries.oknp.org/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:opacity-70"
                    >
                      Open Knowledge Nepal
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMapNote(false)}
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Hide map note"
                    title="Hide map note"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-3">
              {/* Detail Panel (shown when a constituency is selected) */}
              {selected && (
                <section ref={detailPanelRef} className="scroll-mt-20 rounded-xl border border-border bg-card p-4 shadow-sm">
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
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
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
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : detailStatus === "counting"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400"
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
                            className="rounded-lg border border-border bg-muted/55 p-3 dark:bg-muted/25"
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Position badge */}
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  i === 0
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                    : i === 1
                                      ? "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                                      : "bg-slate-500/20 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {i + 1}
                              </span>

                              {/* Candidate + Party avatars stacked */}
                              <div className="relative shrink-0">
                                <img
                                  src={c.candidateImage || c.candidateAvatarUrl || AVATAR_FALLBACK}
                                  alt=""
                                  className="h-9 w-9 rounded-full border-2 border-background bg-muted object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = AVATAR_FALLBACK;
                                  }}
                                />
                                <img
                                  src={c.partyImage || c.partyAvatarUrl || PARTY_FALLBACK}
                                  alt=""
                                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background bg-muted object-cover"
                                  loading="lazy"
                                  decoding="async"
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
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
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
                <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    Winning Parties
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
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/55 px-3 py-2 dark:bg-muted/25"
                        >
                          <img
                            src={info.image || PARTY_FALLBACK}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full border border-border bg-muted object-cover"
                            loading="lazy"
                            decoding="async"
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
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Status Legend
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-foreground">Result declared</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                    <span className="text-foreground">Counting in progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-foreground">Not started / No data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-sm bg-slate-600 ring-1 ring-slate-400/60" />
                    <span className="text-foreground">No separate constituency polygon</span>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                  <p>
                    District borders:{" "}
                    <span className="font-semibold text-foreground">
                      {districtPaths.length || DISTRICT_COUNT}
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

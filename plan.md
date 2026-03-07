# Election Data Visualization Project Plan (Nepal Election)

## 1) Project Objective

Build a fast, reliable election data visualization platform for Nepal’s ongoing election, using:

- **Frontend:** React (SSR-capable)
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **Scraping/Parsing:** Axios + Cheerio
- **UI:** shadcn/ui components, **dark mode only**

Primary data source:
- https://election.ekantipur.com/popular-candidates?lng=eng

---

## 2) Scope (MVP)

### In Scope
1. Scrape static election pages
2. Save raw HTML snapshots
3. Parse and normalize candidate data
4. Store normalized data in MongoDB
5. Build API endpoints for frontend consumption
6. Show dashboard in dark mode
7. Basic refresh/sync mechanism

### Out of Scope (for now)
1. Full design system and theme toggle
2. Advanced analytics/forecasting
3. Real-time websockets
4. Multi-source reconciliation

---

## 3) Architecture Overview

### Data Flow
1. Fetch source HTML from election website
2. Save snapshot to file for reproducibility/debugging
3. Parse snapshot via Cheerio
4. Normalize into consistent schema
5. Upsert into MongoDB
6. Serve from Express API
7. Render on React SSR dashboard + periodic refresh

### Why snapshot-first?
- Parsing is easier to debug
- Site structure changes can be diffed
- Reduces repeated network dependency during parser iteration

---

## 4) Backend Plan

## 4.1 Controllers

### A) Scrape Controller
- **Purpose:** Fetch and store raw HTML
- **Route (example):** `GET /api/election/scrape/popular-candidates`
- **Output:** scrape status, timestamp, source URL, snapshot path

### B) Parse Controller
- **Purpose:** Read saved snapshot and extract structured data
- **Route (example):** `GET /api/election/parse/popular-candidates`
- **Output:** parsed candidates + parser stats

### C) Sync Controller
- **Purpose:** Parse + persist to MongoDB
- **Route (example):** `POST /api/election/sync/popular-candidates`
- **Output:** inserted/updated counts + timestamp

### D) Read APIs
- `GET /api/election/popular-candidates`
- `GET /api/election/constituencies/:slug`
- `GET /api/election/candidates/:id`

---

## 4.2 Parsing Strategy (Important)

Use defensive parsing because source HTML can change:

1. Prefer stable wrapper blocks around each constituency card
2. Parse leader block separately from side-candidate list
3. Extract text with `.text().trim()`
4. Normalize URLs to absolute URLs when needed
5. Convert vote strings to numbers (`"1,478"` -> `1478`)
6. Parse vote change with sign where possible
7. Store missing fields as `null` (not undefined)
8. Validate each parsed record before persistence

---

## 4.3 Data Validation Rules

Each candidate record should include:

- `constituencyName` (required)
- `candidateType` = `"leader"` or `"side"` (required)
- `candidateName` (required)
- `votes` (number, required)
- `candidateProfileUrl` (nullable)
- `candidateImageUrl` (nullable)
- `partyName` (nullable)
- `partyUrl` (nullable)
- `partyImageUrl` (nullable)
- `voteChange` (nullable number)
- `sourceUrl` (required)
- `scrapedAt` (required date)

If required values are missing, skip record and log warning.

---

## 4.4 MongoDB Schema (MVP)

Collection: `popular_candidates`

Fields:
- `_id`
- `constituencyName: String`
- `constituencySlug: String`
- `constituencyUrl: String`
- `candidateType: String` (`leader` | `side`)
- `candidateName: String`
- `candidateProfileUrl: String | null`
- `candidateImageUrl: String | null`
- `partyName: String | null`
- `partyUrl: String | null`
- `partyImageUrl: String | null`
- `votes: Number`
- `voteChange: Number | null`
- `sourceUrl: String`
- `scrapedAt: Date`
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ constituencySlug: 1 }`
- `{ candidateName: 1 }`
- `{ scrapedAt: -1 }`
- Optional compound: `{ constituencySlug: 1, candidateName: 1, scrapedAt: -1 }`

---

## 5) Frontend Plan (React + SSR + shadcn)

## 5.1 Theme Decision
- Dark mode only
- No theme switcher
- Keep styling minimal to prioritize feature delivery

## 5.2 Pages

### Dashboard (`/`)
- Popular candidate cards
- Vote and vote-change highlights
- Last updated timestamp
- Basic filters (constituency/candidate search)

### Constituency Page (`/constituency/:slug`)
- Constituency summary
- Leader + competitors list
- Vote comparison chart

### Candidate View (modal or page)
- Candidate profile summary
- Party details
- Latest vote data

## 5.3 UI Components
Use shadcn components:
- `Card`, `Badge`, `Table`, `Tabs`, `Input`, `Skeleton`, `Tooltip`, `Separator`

---

## 6) SSR/Data Fetching Plan

1. Render dashboard data server-side for fast first paint
2. Add short revalidation/polling (e.g., 60–120 seconds)
3. Keep frontend reading from your backend API only (single source of truth)

---

## 7) Scheduler and Automation

1. Add scheduled scraping every 5–15 minutes (config-driven)
2. For each run:
   - scrape
   - parse
   - validate
   - upsert
3. Log:
   - success/failure
   - parse counts
   - skipped records
   - duration

---

## 8) Error Handling and Reliability

1. Add request timeout and user-agent in fetch requests
2. Handle network and parse failures gracefully
3. Save failed HTML snapshots for debugging
4. Add fallback selectors for parser resilience
5. Never crash whole sync due to one malformed candidate block

---

## 9) Security and Operational Notes

1. Validate all query params in read APIs
2. Sanitize and normalize external URLs
3. Keep CORS restricted to frontend domain(s)
4. Use environment variables for configuration
5. Add lightweight rate limiting for public endpoints

---

## 10) Milestones

### Milestone 1: Parser Correctness (Immediate)
- Implement robust parse controller
- Return clean JSON with validated fields

### Milestone 2: Persistence
- Save parsed data into MongoDB
- Implement read APIs

### Milestone 3: Dashboard UI
- Dark-mode dashboard with shadcn
- SSR + periodic refresh

### Milestone 4: Automation
- Scheduled sync
- Monitoring and parser stability improvements

---

## 11) Definition of Done (MVP)

MVP is done when:

1. Data can be scraped from source page reliably
2. Parser returns correct structured records
3. Records are persisted in MongoDB
4. Frontend dashboard displays latest data in dark mode
5. Sync runs repeatedly with logs and without manual intervention

---

## 12) Immediate Next Actions

1. Finalize parser in `ElectionController` with robust selectors
2. Add numeric normalization utility for votes and deltas
3. Return parsed records from API (not only console logs)
4. Add MongoDB model and upsert service
5. Connect frontend dashboard to backend endpoint
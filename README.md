# LokPulse

A real-time election results dashboard for tracking vote counts, leading candidates, and party standings across all provinces, districts, and constituencies of Nepal.

Users can browse popular candidates, compare party performance, drill into individual constituency races, and bookmark their favourite candidates — all updated periodically as results come in.

![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express_5-000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

---

## Features

- **Live Vote Counts** — View up-to-date vote tallies for every constituency as results are published.
- **Popular Candidates** — See the most-watched races with leading and trailing candidates at a glance.
- **Province Overview** — Party-wise seat counts (elected + leading) broken down by all 7 provinces.
- **Party Standings** — Nationwide party leaderboard with elected and leading seat totals.
- **Constituency Drill-Down** — Cascading Province → District → Constituency filters to find any race instantly.
- **Favourites** — Bookmark candidates you want to track; persisted in local storage.
- **Search** — Filter candidates and districts by name across every page.
- **Dark Theme** — Designed for comfortable viewing during long result nights.
- **Skeleton Loading** — Content-shaped loading states instead of spinners for a polished feel.
- **Periodic Data Updates** — Backend data is refreshed periodically via local scripts that respect source rate limits.

---

## Architecture

```
┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│   Frontend   │──GET──▶│   Backend    │◀──────▶│ MongoDB Atlas│
│  React SPA   │        │  Express API │        │              │
└─────────────┘        └──────────────┘        └──────┬───────┘
                                                       │
                                               ┌──────┴───────┐
                                               │   Scripts     │
                                               │ (local only)  │
                                               └──────────────┘
```

| Layer | Description |
|-------|-------------|
| **Frontend** (`front/`) | React 19 + Vite 7 SPA with TailwindCSS v4, TanStack Query for data fetching, React Router v7 for navigation. |
| **Backend** (`back/`) | Read-only Express 5 REST API. No write endpoints are exposed — only GET requests are served. Secured with Helmet, CORS allowlist, and rate limiting. |
| **Scripts** (`scripts/`) | Standalone Node.js project that fetches and parses election pages, then writes results directly to MongoDB. Runs locally or on a schedule — never exposed to the internet. |

---

## API Endpoints

All endpoints are **GET-only** and served under `/elections`.

| Endpoint | Description |
|----------|-------------|
| `GET /elections/eval` | Popular candidates grouped by district |
| `GET /elections/status` | Province-wise party seat counts |
| `GET /elections/party-status` | Nationwide party standings |
| `GET /elections/filters` | Province → District → Constituency filter tree |
| `GET /elections/constituency` | Single constituency result (query: `provinceId`, `district`, `constituencyNo`) |
| `GET /health` | Health check |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (or local MongoDB)

### Backend

```bash
cd back
cp .env.example .env        # fill in MONGODB_URL, ALLOWED_ORIGINS
npm install
npm run dev                  # starts on :8000
```

### Frontend

```bash
cd front
cp .env.example .env        # set VITE_BASE_URL to your backend URL
npm install
npm run dev                  # starts on :5173
```

### Data Scripts

Scripts are a separate project that populate the database. They are not part of the deployed app.

```bash
cd scripts
cp .env.example .env        # same MONGODB_URL as backend
npm install

npm run scrape:home          # provinces, parties, location index
npm run scrape:popular       # popular candidates
npm run scrape:constituencies # all constituency results (rate-limited)
npm run scrape:full          # run everything in sequence
```

To update a single constituency manually:

```bash
npm run db:update -- constituency --district Kathmandu --constituency 1
```

---

## Deployment

The backend includes a production **Dockerfile** (Node 20 Alpine, multi-stage build).

```bash
cd back
docker build -t election-api .
docker run -p 8000:8000 \
  -e MONGODB_URL="mongodb+srv://..." \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  -e RATE_LIMIT_PER_MINUTE=100 \
  election-api
```

On platforms like **Render**, set environment variables in the dashboard — they are injected into the container at runtime automatically.

The frontend builds to static files (`npm run build`) and can be served from any CDN or static host (Vercel, Netlify, Nginx, etc.).

---

## CI

GitHub Actions runs on every push/PR to `main` that touches `front/`:

- **Typecheck** — `tsc --noEmit`
- **Build** — `vite build`
- **Lint** — `eslint`

---

## Project Structure

```
├── front/                 # React SPA
│   ├── src/Pages/         # Route pages (Popular, Provinces, Parties, Constituency, 404)
│   ├── src/Components/    # Shared components (AppMenu, Skeletons)
│   └── nginx.conf         # Production Nginx config
├── back/                  # Express API (read-only)
│   ├── src/Controllers/   # Request handlers
│   ├── src/Schemas/       # Mongoose models
│   ├── src/Routes/        # Route definitions
│   └── Dockerfile         # Production container
├── scripts/               # Data pipeline (local only)
│   ├── schemas/           # Mongoose models (shared definitions)
│   ├── lib/               # Parsers, fetcher, DB connection
│   └── *.js               # Individual scrape/update scripts
└── .github/workflows/     # CI pipeline
```

---

## License

This project is intended for educational and non-commercial use.

The data displayed is collected from publicly available sources such as news portals and official election reporting websites. 
All rights to the data belong to their respective owners.

# LokPulse

LokPulse is a Nepal Election 2082 results explorer designed for the pace of national vote-count coverage. It brings candidate totals, province summaries, party standings, constituency details, and geographic results into one fast, readable interface.

The public application is read-only. Election data is collected separately, stored in MongoDB, and served through a small Express API so the frontend can focus on browsing and comparing results.

![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express_5-000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

## What LokPulse provides

- Popular candidate races with leading and competing candidates.
- Results grouped across all seven provinces.
- Nationwide party standings.
- Province, district, and constituency filters.
- Detailed candidate totals for each constituency.
- A geographic summary of constituency results.
- Candidate and district search.
- Favourite districts stored locally in the browser.
- Responsive light and dark themes.

## Architecture

```text
Data scripts ──write──▶ MongoDB ◀──read── Express API ◀──GET── React SPA
```

| Layer | Location | Purpose |
| --- | --- | --- |
| Web | `apps/web` | React 19, Vite, Tailwind CSS, TanStack Query, and React Router. |
| API | `apps/api` | Read-only Express 5 API with Mongoose, Helmet, CORS, and rate limiting. |
| Data pipeline | Private local `scripts` workspace | Collects and refreshes election records outside the deployed application. Its source is not published. |

### Final-results cache

During active counting or development, summary endpoints read the latest values from MongoDB. After an election is complete, the API can keep the stable summaries in process memory:

```env
ELECTION_RESULTS_FINAL=true
```

In final-results mode, the first request loads each summary from MongoDB and later requests reuse that sanitized value for the lifetime of the API process. Popular candidates, province status, party status, location filters, and the winner-only map summary use this bounded cache. Constituency detail remains database-backed because it has many possible query keys.

The cache is rebuilt from MongoDB after every restart. No election results are hardcoded, written to a generated cache file. A separate shared cache such as Redis is unnecessary for this small, fixed set of summaries.

## Using LokPulse

The repository contains the web and API application code used for deployment.

## Private data operations

The `scripts/` directory is kept in the local project but excluded from Git. The layout is shown here only to document how the maintained system is organized:

```text
scripts/                       # Private, local-only, and ignored by Git
├── lib/                       # Database and fetch helpers
├── schemas/                   # Data-pipeline Mongoose models
├── scrapeHomepage.js          # Province, party, and location snapshots
├── scrapePopularCandidates.js # Popular candidate snapshot
├── crawlConstituencies.js     # Constituency result collection
├── fullRefresh.js             # Complete refresh sequence
├── autoRefresh.js             # Scheduled refresh loop
└── updateRecord.js            # Targeted record maintenance
```

Maintainer-only commands used from the private local workspace:

```bash
cd scripts
npm install

npm run scrape:homepage
npm run scrape:popular
npm run scrape:constituencies
npm run scrape:full
```

## Continuous integration

The `LokPulse CI` workflow runs on pull requests and pushes to `main`.

- Web: frozen pnpm install, ESLint, TypeScript, and Vite production build.
- API: frozen pnpm install and tests.
- Container: build the API image for every workflow run and publish `latest` plus the commit SHA to GitHub Container Registry after a push to `main`.

## Project structure

```text
.
├── apps
│   ├── api
│   │   ├── src/Controllers
│   │   ├── src/Routes
│   │   ├── src/Schemas
│   │   └── Dockerfile
│   └── web
│       ├── public
│       └── src
├── scripts                 # Private local pipeline; ignored by Git
│   ├── lib
│   ├── schemas
│   ├── scrapeHomepage.js
│   ├── scrapePopularCandidates.js
│   ├── crawlConstituencies.js
│   └── fullRefresh.js
└── .github/workflows
```

## Data note

LokPulse presents election information collected from publicly available reporting sources. It is an independent results explorer and should not be treated as an official election authority.

## License

This project is intended for educational and non-commercial use. Rights to source election data remain with their respective publishers.

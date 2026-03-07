# How Constituency Data Works

## Overview

The election platform scrapes data from `election.ekantipur.com` and serves it from MongoDB. There are **three layers** of data that build on each other:

1. **Location Index** — knows every constituency URL in Nepal
2. **Constituency Results** — candidate-level vote data for each constituency
3. **Filters API** — serves the location index grouped by province → district → constituency

---

## Step 1: Building the Location Index

**Script:** `scripts/scrapeHomepage.js`  
**Source:** `https://election.ekantipur.com/?lng=eng`  
**Collection:** `locationindexes`

The homepage contains JavaScript variables embedded in the HTML that define the complete election geography:

```
pradeshdistricts['1'] += '<option value="taplejung">तापलेजुंग</option>';
dists['taplejung'] = {"name":"Taplejung","pid":1,"pname":"कोशी प्रदेश"};
regions['taplejung'] = 1;
```

The parser extracts three things from these JS variables:

| Variable | What it gives us |
|---|---|
| `pradeshdistricts['N']` | Maps each district slug to a province ID |
| `dists['slug']` | District metadata: name, province ID, province name |
| `regions['slug']` | Number of constituencies in that district |

From this, the script generates one `LocationIndex` document per constituency:

```json
{
  "provinceId": 1,
  "provinceName": "कोशी प्रदेश",
  "districtSlug": "taplejung",
  "districtName": "Taplejung",
  "constituencyNo": 1,
  "constituencyUrl": "https://election.ekantipur.com/pradesh-1/district-taplejung/constituency-1?lng=eng"
}
```

If a district has `regions['kathmandu'] = 10`, it creates 10 documents (constituency 1 through 10).

**Total:** ~165 constituencies across all 77 districts and 7 provinces.

---

## Step 2: Crawling Constituency Results

**Script:** `scripts/crawlConstituencies.js`  
**Source:** Individual constituency pages (URLs from LocationIndex)  
**Collection:** `constituencyresults`

The crawler reads the `LocationIndex` and fetches each constituency page. For each page it parses the candidate table:

```
<table>
  <tr>
    <td><a href="/profile/..."><img src="avatar.jpg"/><span>Candidate Name</span></a></td>
    <td><a href="/party/..."><img src="party.jpg"/><span class="party-name">Party</span></a></td>
    <td><div class="votecount won"><p>१२,३४५</p><span>+५६७</span></div></td>
  </tr>
</table>
```

Each row becomes a candidate record:

```json
{
  "candidateName": "Candidate Name",
  "candidateAvatarUrl": "https://election.ekantipur.com/avatar.jpg",
  "partyName": "Party",
  "partyImage": "https://election.ekantipur.com/party.jpg",
  "totalVotes": 12345,
  "totalVotesText": "१२,३४५",
  "marginText": "+५६७",
  "position": 1,
  "status": "won"
}
```

**Vote parsing:** Devanagari digits (०-९) are converted to 0-9, commas stripped, then cast to Number.

**Staleness check:** The crawler skips constituencies that were scraped within the last N hours (default 12). Use `--force` to override.

**Rate limiting:** A configurable delay (default 1.5s) is added between requests to avoid hammering the source site.

The result is stored per constituency with a compound unique index on `(provinceId, districtSlug, constituencyNo)`.

---

## Step 3: API Endpoints (Read-Only)

### `GET /elections/constituency?provinceId=3&district=kathmandu&constituencyNo=1`

Looks up a single constituency result from cache:

```js
ConstituencyResult.findOne({ provinceId, districtSlug, constituencyNo })
```

The response is sanitized to only expose safe, needed fields (no internal IDs, no raw HTML).

### `GET /elections/filters`

Reads the entire `LocationIndex` collection and groups it into a nested structure:

```json
{
  "provinces": [
    {
      "provinceId": 1,
      "provinceName": "कोशी प्रदेश",
      "districts": [
        {
          "districtSlug": "taplejung",
          "districtName": "Taplejung",
          "constituencies": [1]
        },
        {
          "districtSlug": "jhapa",
          "districtName": "Jhapa",
          "constituencies": [1, 2, 3, 4]
        }
      ]
    }
  ]
}
```

The frontend uses this to build cascading dropdowns: Province → District → Constituency.

### `GET /elections/status`

Province-level party results from `ProvinceSnapshot`. Shows elected/leading counts per party per province.

### `GET /elections/party-status`

National party-wise results from `PartySnapshot`. Aggregated elected/leading counts.

### `GET /elections/eval`

Popular candidates from `PopularSnapshot`. Shows top candidates per district with leader + side candidates.

---

## Data Flow Diagram

```
election.ekantipur.com
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │ scrapeHome-  │────▶│ ProvinceSnapshot  │──▶ GET /elections/status
  │ page.js      │     │ PartySnapshot     │──▶ GET /elections/party-status
  │              │────▶│ LocationIndex     │──▶ GET /elections/filters
  │              │     │ SourceCache       │
  └──────────────┘     └──────────────────┘
                                │
  ┌──────────────┐              │ (uses URLs from LocationIndex)
  │ crawlConsti- │◀─────────────┘
  │ tuencies.js  │     ┌──────────────────┐
  │              │────▶│ ConstituencyResult│──▶ GET /elections/constituency
  └──────────────┘     └──────────────────┘

  ┌──────────────┐     ┌──────────────────┐
  │ scrapePopular│────▶│ PopularSnapshot   │──▶ GET /elections/eval
  │ Candidates.js│     └──────────────────┘
  └──────────────┘
```

---

## Running Locally

```bash
# From the scripts/ directory:
cd scripts && npm install

# Copy .env.example to .env and set your MongoDB URL
cp .env.example .env

# Scrape homepage (provinces, parties, builds location index)
npm run scrape:homepage

# Scrape popular candidates
npm run scrape:popular

# Crawl constituency pages (default: 20 stale ones)
npm run scrape:constituencies
npm run scrape:constituencies -- --limit 50 --stale 6

# Full refresh (all 3 in sequence)
npm run scrape:full

# Manual update without re-scraping
npm run db:update -- constituency --province 3 --district kathmandu --constituency 1 --dry-run
npm run db:update -- constituency --province 3 --district kathmandu --constituency 1 --candidate "Name" --set totalVotes=15000
```
---
# autoRefresh.js — What It Does

Continuous daemon that loops:

1. Homepage → popular candidates → constituency crawl → sleep → repeat.

Use Ctrl+C to stop the process immediately at any point.
---

## Key Flags

| Flag           | Default | Example                                                |
|----------------|---------|--------------------------------------------------------|
| `--interval`   | 5m      | `--interval 2m`, `--interval 30s`, `--interval 1h`   |
| `--delay`      | 1500ms  | `--delay 3000` (ms between each HTTP request)        |
| `--crawl-limit`| 20      | `--crawl-limit 100`                                   |
| `--stale`      | 12h     | `--stale 6` (re-scrape if older than 6h)             |
| `--force`      | off     | bypass freshness, re-scrape everything               |
| `--silent`     | off     | suppress all output except fatal errors              |
| `--verbose`    | off     | log every constituency result                        |
| `--once`       | off     | single cycle then exit (good for cron)               |

---

## Usage Examples

```bash
# Run silently, 3-min cycles, 2s between requests
node autoRefresh.js --interval 3m --delay 2000 --silent

# npm shortcut
npm run scrape:auto

# One-shot for cron
node autoRefresh.js --once --crawl-limit 999 --stale 1

# Aggressive full refresh every 10 min
node autoRefresh.js --interval 10m --delay 1000 --force --crawl-limit 500
# From the scripts/ directory:
cd scripts && npm install

### Data Flow (daemon loop)
```
┌─────────────────────────────────────────┐
│             autoRefresh.js              │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │Homepage │→ │ Popular  │→ │ Crawl  │ │  ← one cycle
│  └─────────┘  └──────────┘  └────────┘ │
│       ↑              sleep(interval)    │
│       └─────────────────────────────────┘
└─────────────────────────────────────────┘
          --delay ms between each HTTP call
```

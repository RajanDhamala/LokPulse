#!/usr/bin/env node
/**
 * Continuous election-data refresh daemon.
 * Loops: homepage → popular candidates → constituency crawl → sleep → repeat.
 *
 * Usage:
 *   node autoRefresh.js                            # 5-min cycle, 1500ms request delay
 *   node autoRefresh.js --interval 2m --delay 2000 # 2-min cycles, 2s between requests
 *   node autoRefresh.js --once                     # single cycle then exit (cron-friendly)
 *   node autoRefresh.js --silent                   # no output except fatal errors
 *
 * Flags:
 *   --interval <duration>   Time between full cycles  (default: 5m)
 *   --delay    <ms>         ms between HTTP requests  (default: SCRAPE_DELAY_MS or 1500)
 *   --crawl-limit <n>       Max constituencies/cycle  (default: CRAWL_LIMIT or 20)
 *   --stale   <hours>       Re-scrape threshold       (default: CRAWL_STALE_HOURS or 12)
 *   --force                 Ignore freshness, always re-scrape
 *   --silent                Suppress all non-error output
 *   --verbose               Extra per-constituency logging
 *   --once                  Run one cycle and exit
 *
 * Duration format: plain ms integer, or a number followed by s/m/h (e.g. 30s, 5m, 1h).
 * Use Ctrl+C to stop the daemon immediately at any point.
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import { fetchPage, sleep } from "./lib/fetcher.js";
import {
  parseProvinceAndPartyFromHomepage,
  parseLocationIndexFromHtml,
  parsePopularCandidatesFromHtml,
  parseConstituencyResultPage,
  checksumText,
} from "./lib/parsers.js";
import SourceCache from "./schemas/SourceCacheSchema.js";
import ProvinceSnapshot from "./schemas/ProvinceSnapshotSchema.js";
import PartySnapshot from "./schemas/PartySnapshotSchema.js";
import LocationIndex from "./schemas/LocationIndexSchema.js";
import PopularSnapshot from "./schemas/PopularSnapshotSchema.js";
import ConstituencyResult from "./schemas/ConstituencyResultSchema.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const parseDuration = (str) => {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  const match = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
  if (!match) throw new Error(`Invalid duration: "${str}". Use e.g. 30s, 5m, 1h, or plain ms.`);
  const value = parseFloat(match[1]);
  const unit = match[2] || "ms";
  const multipliers = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  return Math.round(value * multipliers[unit]);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    interval: parseDuration("5m"),
    delay: Number(process.env.SCRAPE_DELAY_MS) || 1500,
    crawlLimit: Number(process.env.CRAWL_LIMIT) || 20,
    staleHours: Number(process.env.CRAWL_STALE_HOURS) || 12,
    force: false,
    silent: false,
    verbose: false,
    once: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--interval" && args[i + 1]) opts.interval = parseDuration(args[++i]);
    if (args[i] === "--delay" && args[i + 1]) opts.delay = Number(args[++i]);
    if (args[i] === "--crawl-limit" && args[i + 1]) opts.crawlLimit = Number(args[++i]);
    if (args[i] === "--stale" && args[i + 1]) opts.staleHours = Number(args[++i]);
    if (args[i] === "--force") opts.force = true;
    if (args[i] === "--silent") opts.silent = true;
    if (args[i] === "--verbose") opts.verbose = true;
    if (args[i] === "--once") opts.once = true;
  }
  return opts;
};

let silent = false;
const log = (msg, force = false) => {
  if (!silent || force) console.log(msg);
};

// ── DB helpers ───────────────────────────────────────────────────────────────

const upsertLocationIndex = async (docs = []) => {
  if (!docs.length) return 0;
  const ops = docs.map((doc) => ({
    updateOne: {
      filter: {
        provinceId: doc.provinceId,
        districtSlug: doc.districtSlug,
        constituencyNo: doc.constituencyNo,
      },
      update: { $set: doc },
      upsert: true,
    },
  }));
  await LocationIndex.bulkWrite(ops, { ordered: false });
  return docs.length;
};

// ── Single refresh cycle ──────────────────────────────────────────────────────

const runCycle = async (opts, cycleNum) => {
  const cycleStart = Date.now();
  const tag = opts.once ? "[autoRefresh]" : `[cycle ${cycleNum}]`;

  // Step 1 — Homepage
  log(`${tag} ── Homepage ──`);
  const homepageUrl = "https://election.ekantipur.com/?lng=eng";
  const homepageHtml = await fetchPage(homepageUrl);
  const fetchedAt = new Date();

  await SourceCache.findOneAndUpdate(
    { key: "homepage-nep" },
    {
      $set: {
        key: "homepage-nep",
        sourceUrl: homepageUrl,
        html: homepageHtml,
        fetchedAt,
        checksum: checksumText(homepageHtml),
      },
    },
    { upsert: true }
  );

  const parsed = parseProvinceAndPartyFromHomepage(homepageHtml);
  await ProvinceSnapshot.findOneAndUpdate(
    { key: "province-status" },
    {
      $set: {
        key: "province-status",
        lastScraped: fetchedAt,
        count: parsed.provinces.length,
        provinces: parsed.provinces,
      },
    },
    { upsert: true }
  );
  await PartySnapshot.findOneAndUpdate(
    { key: "party-status" },
    {
      $set: {
        key: "party-status",
        title: parsed.partyTitle,
        lastScraped: fetchedAt,
        count: parsed.parties.length,
        parties: parsed.parties,
      },
    },
    { upsert: true }
  );

  const indexDocs = parseLocationIndexFromHtml(homepageHtml, fetchedAt.toISOString());
  const indexCount = await upsertLocationIndex(indexDocs);
  log(
    `${tag} ✓ Homepage — provinces: ${parsed.provinces.length}, parties: ${parsed.parties.length}, indexed: ${indexCount}`
  );

  await sleep(opts.delay);

  // Step 2 — Popular candidates
  log(`${tag} ── Popular Candidates ──`);
  const popularUrl = "https://election.ekantipur.com/popular-candidates?lng=eng";
  const popularHtml = await fetchPage(popularUrl);
  const popularAt = new Date();

  const districts = parsePopularCandidatesFromHtml(popularHtml);

  // Preserve existing isCompleted values so manual flags survive re-scrapes
  const existingPopular = await PopularSnapshot.findOne({ key: "popular-candidates" }).lean();
  if (existingPopular?.candidates?.length) {
    const completedMap = new Map();
    existingPopular.candidates.forEach((d) => {
      if (d.isCompleted || d.isComplted) completedMap.set(d.districtName, true);
    });
    districts.forEach((d) => {
      if (completedMap.has(d.districtName)) d.isCompleted = true;
    });
  }

  await PopularSnapshot.findOneAndUpdate(
    { key: "popular-candidates" },
    {
      $set: {
        key: "popular-candidates",
        lastScraped: popularAt,
        count: districts.length,
        candidates: districts,
      },
    },
    { upsert: true, setDefaultsOnInsert: false }
  );
  const completedCount = districts.filter((d) => d.isCompleted).length;
  log(`${tag} ✓ Popular candidates — ${districts.length} districts, ${completedCount} completed`);

  await sleep(opts.delay);

  // Step 3 — Constituency crawl
  log(`${tag} ── Constituency Crawl (limit: ${opts.crawlLimit}) ──`);
  const locations = await LocationIndex.find()
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  const staleBefore = new Date(Date.now() - opts.staleHours * 3_600_000);
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const loc of locations) {
    if (fetched >= opts.crawlLimit) break;

    const existing = await ConstituencyResult.findOne({
      provinceId: loc.provinceId,
      districtSlug: loc.districtSlug,
      constituencyNo: loc.constituencyNo,
    })
      .select("scrapedAt")
      .lean();

    const isFresh = existing?.scrapedAt && new Date(existing.scrapedAt) >= staleBefore;
    if (!opts.force && isFresh) {
      skipped++;
      continue;
    }

    try {
      const html = await fetchPage(loc.constituencyUrl);
      const result = parseConstituencyResultPage(html, loc.constituencyUrl);
      const scrapedAt = new Date();

      // Preserve existing isCompleted if already true (manual/auto flag survives re-scrapes)
      const existingDoc = await ConstituencyResult.findOne({
        provinceId: loc.provinceId,
        districtSlug: loc.districtSlug,
        constituencyNo: loc.constituencyNo,
      })
        .select("isCompleted")
        .lean();
      const isCompleted = result.isCompleted || !!existingDoc?.isCompleted;

      await ConstituencyResult.findOneAndUpdate(
        {
          provinceId: loc.provinceId,
          districtSlug: loc.districtSlug,
          constituencyNo: loc.constituencyNo,
        },
        {
          $set: {
            provinceId: loc.provinceId,
            provinceName: loc.provinceName,
            districtSlug: loc.districtSlug,
            districtName: loc.districtName,
            constituencyNo: loc.constituencyNo,
            constituencyTitle: result.title || `${loc.districtName}-${loc.constituencyNo}`,
            constituencyUrl: loc.constituencyUrl,
            sourceSummary: result.sourceSummary,
            candidates: result.candidates,
            scrapedAt,
            checksum: result.checksum,
            isCompleted,
          },
        },
        { upsert: true, setDefaultsOnInsert: false }
      );

      fetched++;
      if (opts.verbose) {
        log(`${tag}   ✓ ${loc.districtSlug}-${loc.constituencyNo} (${result.candidates.length} candidates)${isCompleted ? " ✔ completed" : ""}`);
      }
    } catch (err) {
      errors++;
      log(`${tag}   ✗ ${loc.districtSlug}-${loc.constituencyNo}: ${err.message}`);
    }

    await sleep(opts.delay);
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  log(
    `${tag} ✓ Crawl done — fetched: ${fetched}, skipped: ${skipped} (fresh), errors: ${errors} [${elapsed}s]`
  );
};

// ── Main loop ────────────────────────────────────────────────────────────────

const main = async () => {
  const opts = parseArgs();
  silent = opts.silent;

  log(`[autoRefresh] Starting — interval: ${opts.interval}ms, delay: ${opts.delay}ms, crawl-limit: ${opts.crawlLimit}, stale: ${opts.staleHours}h, force: ${opts.force}, once: ${opts.once}`);

  await connectDB();

  let running = true;
  let cycleNum = 1;

  while (running) {
    try {
      await runCycle(opts, cycleNum++);
    } catch (err) {
      console.error(`[autoRefresh] Cycle ${cycleNum - 1} failed: ${err.message}`);
    }

    if (opts.once || !running) break;

    log(`[autoRefresh] Sleeping ${opts.interval}ms before next cycle...`);
    await sleep(opts.interval);
  }

  await disconnectDB();
  log("[autoRefresh] Exited cleanly.");
};

main().catch((err) => {
  console.error("[autoRefresh] FATAL:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Crawl stale constituency pages and update ConstituencyResult collection.
 * Respects rate limits with configurable delay between requests.
 *
 * Usage:
 *   node crawlConstituencies.js                       # defaults
 *   node crawlConstituencies.js --limit 50 --stale 6  # custom
 *   node crawlConstituencies.js --force                # ignore freshness
 *
 * Env overrides:
 *   CRAWL_LIMIT=50   CRAWL_STALE_HOURS=12   SCRAPE_DELAY_MS=1500
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import { fetchPage, sleep } from "./lib/fetcher.js";
import {
  parseConstituencyResultPage,
  parseLocationIndexFromHtml,
} from "./lib/parsers.js";
import LocationIndex from "./schemas/LocationIndexSchema.js";
import ConstituencyResult from "./schemas/ConstituencyResultSchema.js";
import SourceCache from "./schemas/SourceCacheSchema.js";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    limit: Number(process.env.CRAWL_LIMIT) || 20,
    staleHours: Number(process.env.CRAWL_STALE_HOURS) || 12,
    force: false,
    lang: "eng",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) opts.limit = Number(args[++i]);
    if (args[i] === "--stale" && args[i + 1]) opts.staleHours = Number(args[++i]);
    if (args[i] === "--force") opts.force = true;
    if (args[i] === "--lang" && args[i + 1]) opts.lang = args[++i];
  }
  return opts;
};

const upsertLocationIndex = async (docs = []) => {
  if (!docs.length) return 0;
  const bulkOps = docs.map((doc) => ({
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
  await LocationIndex.bulkWrite(bulkOps, { ordered: false });
  return docs.length;
};

const run = async () => {
  const opts = parseArgs();
  await connectDB();

  let locations = await LocationIndex.find()
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  if (!locations.length) {
    console.log("[crawl] Location index empty — rebuilding from cached homepage...");
    const cached = await SourceCache.findOne({ key: "homepage-nep" }).lean();
    if (!cached?.html) {
      console.error("[crawl] No cached homepage found. Run scrapeHomepage.js first.");
      process.exit(1);
    }
    const docs = parseLocationIndexFromHtml(cached.html, cached.fetchedAt?.toISOString());
    await upsertLocationIndex(docs);
    locations = await LocationIndex.find()
      .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
      .lean();
  }

  const staleBefore = new Date(Date.now() - opts.staleHours * 60 * 60 * 1000);
  const processed = [];
  const skipped = [];
  const errors = [];

  console.log(
    `[crawl] Starting — limit: ${opts.limit}, staleHours: ${opts.staleHours}, force: ${opts.force}, total locations: ${locations.length}`
  );

  for (const location of locations) {
    if (processed.length >= opts.limit) break;

    const existing = await ConstituencyResult.findOne({
      provinceId: location.provinceId,
      districtSlug: location.districtSlug,
      constituencyNo: location.constituencyNo,
    })
      .select("scrapedAt")
      .lean();

    const isFresh = existing?.scrapedAt && new Date(existing.scrapedAt) >= staleBefore;
    if (!opts.force && isFresh) {
      skipped.push(`${location.districtSlug}-${location.constituencyNo}`);
      continue;
    }

    const sourceUrl = location.constituencyUrl.replace(
      /lng=(eng|nep)/,
      `lng=${opts.lang}`
    );

    try {
      const html = await fetchPage(sourceUrl);
      const parsed = parseConstituencyResultPage(html, sourceUrl);
      const scrapedAt = new Date();

      // Preserve existing isCompleted if already true (manual flag survives re-scrapes)
      const existingDoc = await ConstituencyResult.findOne({
        provinceId: location.provinceId,
        districtSlug: location.districtSlug,
        constituencyNo: location.constituencyNo,
      })
        .select("isCompleted")
        .lean();
      const isCompleted = parsed.isCompleted || !!existingDoc?.isCompleted;

      await ConstituencyResult.findOneAndUpdate(
        {
          provinceId: location.provinceId,
          districtSlug: location.districtSlug,
          constituencyNo: location.constituencyNo,
        },
        {
          $set: {
            provinceId: location.provinceId,
            provinceName: location.provinceName,
            districtSlug: location.districtSlug,
            districtName: location.districtName,
            constituencyNo: location.constituencyNo,
            constituencyTitle:
              parsed.title || `${location.districtName}-${location.constituencyNo}`,
            constituencyUrl: sourceUrl,
            sourceSummary: parsed.sourceSummary,
            candidates: parsed.candidates,
            scrapedAt,
            checksum: parsed.checksum,
            isCompleted,
          },
        },
        { upsert: true, setDefaultsOnInsert: false }
      );

      processed.push(
        `${location.districtSlug}-${location.constituencyNo} (${parsed.candidates.length} candidates)`
      );
      console.log(
        `  ✓ ${location.districtSlug}-${location.constituencyNo} — ${parsed.candidates.length} candidates${isCompleted ? " ✔ completed" : ""}`
      );
    } catch (error) {
      errors.push(`${location.districtSlug}-${location.constituencyNo}: ${error.message}`);
      console.log(
        `  ✗ ${location.districtSlug}-${location.constituencyNo} — ${error.message}`
      );
    }

    await sleep();
  }

  console.log("\n[crawl] Summary:");
  console.log(`  Fetched : ${processed.length}`);
  console.log(`  Skipped : ${skipped.length} (fresh)`);
  console.log(`  Errors  : ${errors.length}`);
  if (errors.length) console.log(`  Samples : ${errors.slice(0, 5).join("\n            ")}`);

  await disconnectDB();
  console.log("[crawl] Done.");
};

run().catch((err) => {
  console.error("[crawl] FAILED:", err.message);
  process.exit(1);
});

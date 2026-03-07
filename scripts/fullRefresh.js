#!/usr/bin/env node
/**
 * Full refresh — runs all scraping in sequence:
 *   1. Homepage (provinces, parties, location index)
 *   2. Popular candidates
 *   3. Constituency crawl
 *
 * Usage:
 *   node fullRefresh.js
 *   node fullRefresh.js --crawl-limit 50 --stale 6
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

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    crawlLimit: Number(process.env.CRAWL_LIMIT) || 20,
    staleHours: Number(process.env.CRAWL_STALE_HOURS) || 12,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--crawl-limit" && args[i + 1]) opts.crawlLimit = Number(args[++i]);
    if (args[i] === "--stale" && args[i + 1]) opts.staleHours = Number(args[++i]);
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
  const startTime = Date.now();
  await connectDB();

  // ── Step 1: Homepage ──
  console.log("\n═══ Step 1: Homepage ═══");
  const homepageUrl = "https://election.ekantipur.com/?lng=eng";
  console.log("Fetching", homepageUrl);
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
  console.log(`✓ Provinces: ${parsed.provinces.length}, Parties: ${parsed.parties.length}, Constituencies indexed: ${indexCount}`);

  await sleep();

  // ── Step 2: Popular Candidates ──
  console.log("\n═══ Step 2: Popular Candidates ═══");
  const popularUrl = "https://election.ekantipur.com/popular-candidates?lng=eng";
  console.log("Fetching", popularUrl);
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
  console.log(`✓ Popular candidates: ${districts.length} districts`);

  await sleep();

  // ── Step 3: Constituency Crawl ──
  console.log(`\n═══ Step 3: Constituency Crawl (limit: ${opts.crawlLimit}) ═══`);
  const locations = await LocationIndex.find()
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  const staleBefore = new Date(Date.now() - opts.staleHours * 60 * 60 * 1000);
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const location of locations) {
    if (fetched >= opts.crawlLimit) break;

    const existing = await ConstituencyResult.findOne({
      provinceId: location.provinceId,
      districtSlug: location.districtSlug,
      constituencyNo: location.constituencyNo,
    })
      .select("scrapedAt")
      .lean();

    if (existing?.scrapedAt && new Date(existing.scrapedAt) >= staleBefore) {
      skipped++;
      continue;
    }

    try {
      const html = await fetchPage(location.constituencyUrl);
      const result = parseConstituencyResultPage(html, location.constituencyUrl);
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
            constituencyTitle: result.title || `${location.districtName}-${location.constituencyNo}`,
            constituencyUrl: location.constituencyUrl,
            sourceSummary: result.sourceSummary,
            candidates: result.candidates,
            scrapedAt: new Date(),
            checksum: result.checksum,
          },
        },
        { upsert: true, setDefaultsOnInsert: false }
      );
      fetched++;
      console.log(`  ✓ ${location.districtSlug}-${location.constituencyNo}`);
    } catch (err) {
      errors++;
      console.log(`  ✗ ${location.districtSlug}-${location.constituencyNo}: ${err.message}`);
    }

    await sleep();
  }

  console.log(`✓ Crawl: ${fetched} fetched, ${skipped} skipped, ${errors} errors`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═══ Full refresh complete in ${elapsed}s ═══`);

  await disconnectDB();
};

run().catch((err) => {
  console.error("[fullRefresh] FAILED:", err.message);
  process.exit(1);
});

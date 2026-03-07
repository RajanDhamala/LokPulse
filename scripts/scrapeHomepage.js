#!/usr/bin/env node
/**
 * Scrape homepage → update ProvinceSnapshot, PartySnapshot, SourceCache, LocationIndex
 *
 * Usage:  node scrapeHomepage.js
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import { fetchPage } from "./lib/fetcher.js";
import {
  parseProvinceAndPartyFromHomepage,
  parseLocationIndexFromHtml,
  checksumText,
} from "./lib/parsers.js";
import SourceCache from "./schemas/SourceCacheSchema.js";
import ProvinceSnapshot from "./schemas/ProvinceSnapshotSchema.js";
import PartySnapshot from "./schemas/PartySnapshotSchema.js";
import LocationIndex from "./schemas/LocationIndexSchema.js";

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
  await connectDB();

  const url = "https://election.ekantipur.com/?lng=eng";
  console.log("[homepage] Fetching", url);
  const html = await fetchPage(url);
  const fetchedAt = new Date();

  await SourceCache.findOneAndUpdate(
    { key: "homepage-nep" },
    {
      $set: {
        key: "homepage-nep",
        sourceUrl: url,
        html,
        fetchedAt,
        checksum: checksumText(html),
      },
    },
    { upsert: true }
  );
  console.log("[homepage] HTML cached");

  const parsed = parseProvinceAndPartyFromHomepage(html);

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
  console.log(`[homepage] Province snapshot updated (${parsed.provinces.length} provinces)`);

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
  console.log(`[homepage] Party snapshot updated (${parsed.parties.length} parties)`);

  const docs = parseLocationIndexFromHtml(html, fetchedAt.toISOString());
  const upserted = await upsertLocationIndex(docs);
  console.log(`[homepage] Location index updated (${upserted} constituencies)`);

  await disconnectDB();
  console.log("[homepage] Done.");
};

run().catch((err) => {
  console.error("[homepage] FAILED:", err.message);
  process.exit(1);
});

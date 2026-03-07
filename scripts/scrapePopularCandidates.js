#!/usr/bin/env node
/**
 * Scrape popular candidates page → update PopularSnapshot
 *
 * Usage:  node scrapePopularCandidates.js
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import { fetchPage } from "./lib/fetcher.js";
import { parsePopularCandidatesFromHtml } from "./lib/parsers.js";
import PopularSnapshot from "./schemas/PopularSnapshotSchema.js";

const run = async () => {
  await connectDB();

  const url = "https://election.ekantipur.com/popular-candidates?lng=eng";
  console.log("[popular] Fetching", url);
  const html = await fetchPage(url);
  const scrapedAt = new Date();

  const districts = parsePopularCandidatesFromHtml(html);

  // Merge isCompleted: keep true if DOM detected OR previously set (manual/auto)
  const existing = await PopularSnapshot.findOne({ key: "popular-candidates" }).lean();
  if (existing?.candidates?.length) {
    const completedMap = new Map();
    existing.candidates.forEach((d) => {
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
        lastScraped: scrapedAt,
        count: districts.length,
        candidates: districts,
      },
    },
    { upsert: true, setDefaultsOnInsert: false }
  );

  const completedCount = districts.filter((d) => d.isCompleted).length;
  console.log(`[popular] Snapshot updated (${districts.length} districts, ${completedCount} completed)`);
  await disconnectDB();
  console.log("[popular] Done.");
};

run().catch((err) => {
  console.error("[popular] FAILED:", err.message);
  process.exit(1);
});

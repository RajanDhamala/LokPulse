#!/usr/bin/env node
/**
 * Migration: backfill `isCompleted: false` on all existing documents.
 *
 * Safe to run multiple times — only updates docs where `isCompleted` does not exist.
 * Does NOT overwrite documents that already have `isCompleted` set.
 *
 * Usage:
 *   node migrateIsCompleted.js            # dry-run (shows counts, changes nothing)
 *   node migrateIsCompleted.js --apply     # actually write to the database
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import mongoose from "mongoose";

const DRY_RUN = !process.argv.includes("--apply");

const run = async () => {
  await connectDB();
  const db = mongoose.connection.db;

  if (DRY_RUN) {
    console.log("[migrate] DRY-RUN mode — pass --apply to write changes\n");
  }

  // 1. ConstituencyResults — add isCompleted: false where field is missing
  const constituencyCollection = db.collection("constituencyresults");
  const constituencyCount = await constituencyCollection.countDocuments({
    isCompleted: { $exists: false },
  });
  console.log(`[migrate] ConstituencyResults missing isCompleted: ${constituencyCount}`);

  if (!DRY_RUN && constituencyCount > 0) {
    const result = await constituencyCollection.updateMany(
      { isCompleted: { $exists: false } },
      { $set: { isCompleted: false } }
    );
    console.log(`[migrate] ConstituencyResults updated: ${result.modifiedCount}`);
  }

  // 2. PopularSnapshots — add document-level isCompleted and per-district isCompleted
  const popularCollection = db.collection("popularsnapshots");
  const popularDocs = await popularCollection.find({}).toArray();

  // 2a. Document-level isCompleted
  const docLevelCount = await popularCollection.countDocuments({
    isCompleted: { $exists: false },
  });
  console.log(`[migrate] PopularSnapshots missing document-level isCompleted: ${docLevelCount}`);
  if (!DRY_RUN && docLevelCount > 0) {
    const result = await popularCollection.updateMany(
      { isCompleted: { $exists: false } },
      { $set: { isCompleted: false } }
    );
    console.log(`[migrate] PopularSnapshots document-level updated: ${result.modifiedCount}`);
  }

  // 2b. Per-district isCompleted inside candidates[]
  let popularUpdated = 0;
  for (const doc of popularDocs) {
    if (!Array.isArray(doc.candidates) || doc.candidates.length === 0) continue;

    let needsUpdate = false;
    const updatedCandidates = doc.candidates.map((district) => {
      if (district.isCompleted === undefined || district.isCompleted === null) {
        needsUpdate = true;
        return { ...district, isCompleted: false };
      }
      return district;
    });

    if (needsUpdate) {
      console.log(`[migrate] PopularSnapshot "${doc.key}" — ${updatedCandidates.length} district entries need backfill`);
      if (!DRY_RUN) {
        await popularCollection.updateOne(
          { _id: doc._id },
          { $set: { candidates: updatedCandidates } }
        );
        popularUpdated++;
      }
    }
  }
  console.log(`[migrate] PopularSnapshot district entries updated: ${DRY_RUN ? "(dry-run)" : popularUpdated}`);

  console.log("\n[migrate] Done.");
  await disconnectDB();
};

run().catch((err) => {
  console.error("[migrate] FAILED:", err.message);
  process.exit(1);
});

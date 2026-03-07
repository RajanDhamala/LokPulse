#!/usr/bin/env node
/**
 * Mark a constituency election as completed (isCompleted: true).
 * Updates both ConstituencyResult and the matching PopularSnapshot district entry.
 *
 * Usage:
 *   node markCompleted.js --province 3 --district kathmandu --constituency 1
 *   node markCompleted.js --province 3 --district kathmandu --constituency 1 --undo
 *   node markCompleted.js --province 3 --district kathmandu --constituency 1 --dry-run
 *   node markCompleted.js --list                 # show all completed constituencies
 *
 * Flags:
 *   --province <id|name>      Province number or name
 *   --district <slug|name>    District slug or name
 *   --constituency <no>       Constituency number
 *   --undo                    Set isCompleted back to false
 *   --dry-run                 Show what would change without writing
 *   --list                    List all constituencies with isCompleted: true
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import ConstituencyResult from "./schemas/ConstituencyResultSchema.js";
import PopularSnapshot from "./schemas/PopularSnapshotSchema.js";
import LocationIndex from "./schemas/LocationIndexSchema.js";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, undo: false, list: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--province" && args[i + 1]) opts.province = args[++i];
    if (args[i] === "--district" && args[i + 1]) opts.district = args[++i];
    if (args[i] === "--constituency" && args[i + 1]) opts.constituencyNo = Number(args[++i]);
    if (args[i] === "--dry-run") opts.dryRun = true;
    if (args[i] === "--undo") opts.undo = true;
    if (args[i] === "--list") opts.list = true;
  }
  return opts;
};

const resolveLocation = async (opts) => {
  const districtQuery = (opts.district || "").toLowerCase();
  if (!districtQuery) {
    console.log("Error: --district is required.");
    return null;
  }

  const filter = {
    $or: [
      { districtSlug: districtQuery },
      { districtName: new RegExp(`^${districtQuery}$`, "i") },
    ],
  };

  if (opts.province) {
    const provNum = Number(opts.province);
    if (!isNaN(provNum) && provNum > 0) {
      filter.provinceId = provNum;
    } else {
      filter.provinceName = new RegExp(opts.province, "i");
    }
  }

  if (opts.constituencyNo) {
    filter.constituencyNo = opts.constituencyNo;
  }

  const match = await LocationIndex.findOne(filter).lean();
  if (!match) {
    const allDistricts = await LocationIndex.distinct("districtName");
    const suggestions = allDistricts
      .filter((d) => d.toLowerCase().includes(districtQuery))
      .slice(0, 5);
    console.log(`No location found for district "${opts.district}".`);
    if (suggestions.length) console.log(`Did you mean: ${suggestions.join(", ")}?`);
    return null;
  }
  return match;
};

const listCompleted = async () => {
  const completed = await ConstituencyResult.find({ isCompleted: true })
    .select("provinceId provinceName districtSlug districtName constituencyNo constituencyTitle")
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  if (!completed.length) {
    console.log("No constituencies marked as completed yet.");
    return;
  }

  console.log(`\nCompleted constituencies (${completed.length}):\n`);
  completed.forEach((c) => {
    console.log(`  ✓ ${c.constituencyTitle || `${c.districtName}-${c.constituencyNo}`}  (Province ${c.provinceId}, ${c.districtSlug}-${c.constituencyNo})`);
  });
};

const run = async () => {
  const opts = parseArgs();

  if (!opts.list && (!opts.district || !opts.constituencyNo)) {
    console.log("Usage: node markCompleted.js --province <id> --district <slug> --constituency <no>");
    console.log("       node markCompleted.js --list");
    console.log("\nFlags: --undo (revert), --dry-run (preview)");
    process.exit(0);
  }

  await connectDB();

  if (opts.list) {
    await listCompleted();
    await disconnectDB();
    return;
  }

  const location = await resolveLocation(opts);
  if (!location) {
    await disconnectDB();
    process.exit(1);
  }

  const newValue = !opts.undo;
  const label = newValue ? "completed ✓" : "uncompleted ✗";

  // 1. Update ConstituencyResult
  const constFilter = {
    provinceId: location.provinceId,
    districtSlug: location.districtSlug,
    constituencyNo: location.constituencyNo,
  };
  const constDoc = await ConstituencyResult.findOne(constFilter)
    .select("constituencyTitle isCompleted")
    .lean();

  if (constDoc) {
    console.log(`\nConstituencyResult: ${constDoc.constituencyTitle}`);
    console.log(`  isCompleted: ${!!constDoc.isCompleted} → ${newValue}`);
    if (!opts.dryRun) {
      await ConstituencyResult.updateOne(constFilter, { $set: { isCompleted: newValue } });
      console.log(`  ✓ Marked as ${label}`);
    } else {
      console.log("  (dry-run, no changes)");
    }
  } else {
    console.log(`\nConstituencyResult: not found for ${location.districtSlug}-${location.constituencyNo}`);
  }

  // 2. Update matching district in PopularSnapshot candidates array
  const snapshot = await PopularSnapshot.findOne({ key: "popular-candidates" });
  if (snapshot?.candidates?.length) {
    const districtEntry = snapshot.candidates.find(
      (d) =>
        d.districtName &&
        (d.districtName.toLowerCase().includes(location.districtName.toLowerCase()) ||
          location.districtName.toLowerCase().includes(d.districtName.toLowerCase()))
    );

    if (districtEntry) {
      console.log(`\nPopularSnapshot district: ${districtEntry.districtName}`);
      console.log(`  isCompleted: ${!!(districtEntry.isCompleted || districtEntry.isComplted)} → ${newValue}`);
      if (!opts.dryRun) {
        districtEntry.isCompleted = newValue;
        delete districtEntry.isComplted;
        snapshot.markModified("candidates");
        await snapshot.save();
        console.log(`  ✓ Marked as ${label}`);
      } else {
        console.log("  (dry-run, no changes)");
      }
    } else {
      console.log(`\nPopularSnapshot: no district matching "${location.districtName}"`);
    }
  } else {
    console.log("\nPopularSnapshot: no candidates found");
  }

  // 3. Also update document-level isCompleted on PopularSnapshot if ALL districts are completed
  if (!opts.dryRun && snapshot?.candidates?.length) {
    const allCompleted = snapshot.candidates.every((d) => d.isCompleted);
    if (allCompleted !== snapshot.isCompleted) {
      await PopularSnapshot.updateOne(
        { key: "popular-candidates" },
        { $set: { isCompleted: allCompleted } }
      );
      console.log(`\nPopularSnapshot document-level isCompleted → ${allCompleted}`);
    }
  }

  console.log("\nDone.");
  await disconnectDB();
};

run().catch((err) => {
  console.error("[markCompleted] FAILED:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Manual database update utility — make small corrections without re-scraping.
 *
 * Usage examples:
 *
 *   # Dry-run: see candidates (province auto-resolved from district name)
 *   node updateRecord.js constituency --district Sarlahi --constituency 4 --dry-run
 *
 *   # Update a candidate's vote count
 *   node updateRecord.js constituency --district kathmandu --constituency 1 \
 *     --candidate "Ram Bahadur" --set totalVotes=15000
 *
 *   # You can also pass province by name or number
 *   node updateRecord.js constituency --province "Madhesh" --district Sarlahi --constituency 4 --dry-run
 *   node updateRecord.js constituency --province 2 --district sarlahi --constituency 4 --dry-run
 *
 *   # Update party snapshot field
 *   node updateRecord.js party \
 *     --party "Nepali Congress" --set elected=45 leading=12
 *
 *   # Update popular candidate votes
 *   node updateRecord.js popular \
 *     --district "Kathmandu-1" --candidate "Ram Bahadur" --set votes=20000
 *
 *   # Show current data (dry-run)
 *   node updateRecord.js party --dry-run
 *   node updateRecord.js popular --dry-run
 */
import { connectDB, disconnectDB } from "./lib/db.js";
import { fetchPage } from "./lib/fetcher.js";
import { parseConstituencyResultPage } from "./lib/parsers.js";
import ConstituencyResult from "./schemas/ConstituencyResultSchema.js";
import LocationIndex from "./schemas/LocationIndexSchema.js";
import PartySnapshot from "./schemas/PartySnapshotSchema.js";
import PopularSnapshot from "./schemas/PopularSnapshotSchema.js";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = { dryRun: false, setFields: {} };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--province" && args[i + 1]) opts.province = args[++i];
    if (args[i] === "--district" && args[i + 1]) opts.district = args[++i];
    if (args[i] === "--constituency" && args[i + 1]) opts.constituencyNo = Number(args[++i]);
    if (args[i] === "--candidate" && args[i + 1]) opts.candidate = args[++i];
    if (args[i] === "--party" && args[i + 1]) opts.party = args[++i];
    if (args[i] === "--dry-run") opts.dryRun = true;
    if (args[i] === "--set") {
      while (args[i + 1] && !args[i + 1].startsWith("--")) {
        const [key, val] = args[++i].split("=");
        opts.setFields[key] = isNaN(val) ? val : Number(val);
      }
    }
  }

  return { command, ...opts };
};

/**
 * Resolve district + optional province to an actual LocationIndex match.
 * Accepts: --district Sarlahi --constituency 4
 *      or: --province "Madhesh" --district Sarlahi --constituency 4
 *      or: --province 2 --district sarlahi --constituency 4
 */
const resolveConstituency = async (opts) => {
  const districtQuery = (opts.district || "").toLowerCase();
  if (!districtQuery) {
    console.log("--district is required.");
    return null;
  }

  // Build a flexible query: match district by slug or name (case-insensitive)
  const filter = {
    $or: [
      { districtSlug: districtQuery },
      { districtName: new RegExp(`^${districtQuery}$`, "i") },
    ],
  };

  // If province is given, try matching by ID (number) or name (string)
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
    // Show available districts to help the user
    const allDistricts = await LocationIndex.distinct("districtName");
    const suggestions = allDistricts
      .filter((d) => d.toLowerCase().includes(districtQuery))
      .slice(0, 5);
    console.log(`No location found for district "${opts.district}".`);
    if (suggestions.length) {
      console.log(`Did you mean: ${suggestions.join(", ")}?`);
    }
    // Also show available provinces
    const provinces = await LocationIndex.aggregate([
      { $group: { _id: "$provinceId", name: { $first: "$provinceName" } } },
      { $sort: { _id: 1 } },
    ]);
    console.log("\nAvailable provinces:");
    provinces.forEach((p) => console.log(`  ${p._id}. ${p.name}`));
    return null;
  }

  return {
    provinceId: match.provinceId,
    districtSlug: match.districtSlug,
    constituencyNo: opts.constituencyNo || match.constituencyNo,
  };
};

const updateConstituency = async (opts) => {
  const resolved = await resolveConstituency(opts);
  if (!resolved) return;

  const filter = {
    provinceId: resolved.provinceId,
    districtSlug: resolved.districtSlug,
    constituencyNo: resolved.constituencyNo,
  };

  let doc = await ConstituencyResult.findOne(filter);

  // Auto-fetch from source if not cached yet
  if (!doc) {
    const location = await LocationIndex.findOne({
      provinceId: resolved.provinceId,
      districtSlug: resolved.districtSlug,
      constituencyNo: resolved.constituencyNo,
    }).lean();

    if (!location?.constituencyUrl) {
      console.log(`No location URL found for ${resolved.districtSlug}-${resolved.constituencyNo}.`);
      return;
    }

    console.log(`Not cached — fetching from source...`);
    console.log(`  ${location.constituencyUrl}`);

    const html = await fetchPage(location.constituencyUrl);
    const parsed = parseConstituencyResultPage(html, location.constituencyUrl);
    const scrapedAt = new Date();

    doc = await ConstituencyResult.findOneAndUpdate(
      filter,
      {
        $set: {
          provinceId: location.provinceId,
          provinceName: location.provinceName,
          districtSlug: location.districtSlug,
          districtName: location.districtName,
          constituencyNo: location.constituencyNo,
          constituencyTitle: parsed.title || `${location.districtName}-${location.constituencyNo}`,
          constituencyUrl: location.constituencyUrl,
          sourceSummary: parsed.sourceSummary,
          candidates: parsed.candidates,
          scrapedAt,
          checksum: parsed.checksum,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );

    console.log(`✓ Fetched and cached (${parsed.candidates.length} candidates)\n`);
  }

  console.log(`Found: ${doc.constituencyTitle} (${doc.candidates.length} candidates)`);

  if (opts.dryRun) {
    doc.candidates.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.candidateName} — ${c.partyName} — ${c.totalVotes} votes`);
    });
    return;
  }

  if (opts.candidate) {
    const candidate = doc.candidates.find(
      (c) => c.candidateName.toLowerCase().includes(opts.candidate.toLowerCase())
    );
    if (!candidate) {
      console.log(`Candidate "${opts.candidate}" not found in this constituency.`);
      return;
    }
    Object.entries(opts.setFields).forEach(([key, val]) => {
      console.log(`  ${candidate.candidateName}.${key}: ${candidate[key]} → ${val}`);
      candidate[key] = val;
    });
  } else {
    Object.entries(opts.setFields).forEach(([key, val]) => {
      console.log(`  ${key}: ${doc[key]} → ${val}`);
      doc[key] = val;
    });
  }

  await doc.save();
  console.log("✓ Updated.");
};

const updateParty = async (opts) => {
  const snapshot = await PartySnapshot.findOne({ key: "party-status" });
  if (!snapshot) {
    console.log("No party snapshot found.");
    return;
  }

  if (opts.dryRun) {
    snapshot.parties.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.partyName} — elected: ${p.elected}, leading: ${p.leading}`);
    });
    return;
  }

  const party = snapshot.parties.find(
    (p) => p.partyName.toLowerCase().includes(opts.party.toLowerCase())
  );
  if (!party) {
    console.log(`Party "${opts.party}" not found.`);
    return;
  }

  Object.entries(opts.setFields).forEach(([key, val]) => {
    console.log(`  ${party.partyName}.${key}: ${party[key]} → ${val}`);
    party[key] = val;
  });

  snapshot.markModified("parties");
  await snapshot.save();
  console.log("✓ Party updated.");
};

const updatePopular = async (opts) => {
  const snapshot = await PopularSnapshot.findOne({ key: "popular-candidates" });
  if (!snapshot) {
    console.log("No popular snapshot found.");
    return;
  }

  if (opts.dryRun) {
    snapshot.candidates.forEach((d) => {
      console.log(`  ${d.districtName}: ${d.leaderCandidate?.name} (leader)`);
    });
    return;
  }

  const district = snapshot.candidates.find(
    (d) => d.districtName.toLowerCase().includes(opts.district.toLowerCase())
  );
  if (!district) {
    console.log(`District "${opts.district}" not found.`);
    return;
  }

  if (opts.candidate) {
    const allCandidates = [district.leaderCandidate, ...(district.sideCandidates || [])];
    const candidate = allCandidates.find(
      (c) => c?.name?.toLowerCase().includes(opts.candidate.toLowerCase())
    );
    if (!candidate) {
      console.log(`Candidate "${opts.candidate}" not found in district.`);
      return;
    }
    Object.entries(opts.setFields).forEach(([key, val]) => {
      console.log(`  ${candidate.name}.${key}: ${candidate[key]} → ${val}`);
      candidate[key] = val;
    });
  }

  snapshot.markModified("candidates");
  await snapshot.save();
  console.log("✓ Popular snapshot updated.");
};

const run = async () => {
  const opts = parseArgs();
  if (!opts.command) {
    console.log("Usage: node updateRecord.js <constituency|party|popular> [options]");
    console.log("  --dry-run              Show current data without modifying");
    console.log("  --set key=value ...    Set field values");
    process.exit(0);
  }

  await connectDB();

  switch (opts.command) {
    case "constituency":
      await updateConstituency(opts);
      break;
    case "party":
      await updateParty(opts);
      break;
    case "popular":
      await updatePopular(opts);
      break;
    default:
      console.log(`Unknown command: ${opts.command}. Use: constituency, party, or popular`);
  }

  await disconnectDB();
};

run().catch((err) => {
  console.error("[update] FAILED:", err.message);
  process.exit(1);
});

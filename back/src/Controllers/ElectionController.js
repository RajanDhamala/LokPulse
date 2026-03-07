import asyncHandler from "../Utils/AsyncHandler.js";
import ApiError from "../Utils/ApiError.js";
import ApiResponse from "../Utils/ApiResponse.js";
import LocationIndex from "../Schemas/LocationIndexSchema.js";
import ConstituencyResult from "../Schemas/ConstituencyResultSchema.js";
import PopularSnapshot from "../Schemas/PopularSnapshotSchema.js";
import ProvinceSnapshot from "../Schemas/ProvinceSnapshotSchema.js";
import PartySnapshot from "../Schemas/PartySnapshotSchema.js";
import {
  sanitizePopularCandidates,
  sanitizeProvinceParties,
  sanitizePartyStatus,
  sanitizeConstituencyResult,
} from "../lib/sanitizers.js";


const EvaluateCandidates = asyncHandler(async (req, res) => {
  const snapshot = await PopularSnapshot.findOne({ key: "popular-candidates" }).lean();
  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  return res.send(
    new ApiResponse(200, "Popular candidates evaluated", {
      count: snapshot.count || snapshot.candidates.length,
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      isCompleted: !!snapshot.isCompleted,
      candidates: sanitizePopularCandidates(snapshot.candidates || []),
    })
  );
});

const GetProvincesStaus = asyncHandler(async (req, res) => {
  const snapshot = await ProvinceSnapshot.findOne({ key: "province-status" }).lean();
  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }
  return res.send(
    new ApiResponse(200, "Province status loaded from cache", {
      extractedAt: new Date().toISOString(),
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      count: snapshot.count || snapshot.provinces.length,
      provinces: sanitizeProvinceParties(snapshot.provinces || []),
    })
  );
});

const GetPartyStatus = asyncHandler(async (req, res) => {
  const snapshot = await PartySnapshot.findOne({ key: "party-status" }).lean();
  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  return res.send(
    new ApiResponse(200, "Party status loaded from cache", {
      extractedAt: new Date().toISOString(),
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      title: snapshot.title || "पार्टीगत नतिजा",
      count: snapshot.count || snapshot.parties.length,
      parties: sanitizePartyStatus(snapshot.parties || []),
    })
  );
});

const GetMapSummary = asyncHandler(async (req, res) => {
  const constituencies = await ConstituencyResult.aggregate([
    {
      $project: {
        _id: 0,
        provinceId: 1,
        districtSlug: 1,
        districtName: 1,
        constituencyNo: 1,
        isCompleted: { $ifNull: ["$isCompleted", false] },
        candidates: {
          $map: {
            input: { $slice: [{ $sortArray: { input: "$candidates", sortBy: { totalVotes: -1 } } }, 3] },
            as: "c",
            in: {
              candidateName: "$$c.candidateName",
              partyName: "$$c.partyName",
              partyImage: { $ifNull: ["$$c.partyImage", { $ifNull: ["$$c.partyAvatarUrl", null] }] },
              candidateImage: { $ifNull: ["$$c.candidateImage", { $ifNull: ["$$c.candidateAvatarUrl", null] }] },
              totalVotes: { $ifNull: ["$$c.totalVotes", 0] },
            },
          },
        },
      },
    },
  ]);

  return res.send(
    new ApiResponse(200, "Map summary loaded", {
      count: constituencies.length,
      constituencies,
    })
  );
});

const GetLocationFilters = asyncHandler(async (req, res) => {
  const locations = await LocationIndex.find()
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  if (!locations.length) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const provinceMap = new Map();
  locations.forEach((location) => {
    const provinceKey = String(location.provinceId);
    if (!provinceMap.has(provinceKey)) {
      provinceMap.set(provinceKey, {
        provinceId: location.provinceId,
        provinceName: location.provinceName,
        districts: [],
      });
    }

    const province = provinceMap.get(provinceKey);
    let district = province.districts.find(
      (item) => item.districtSlug === location.districtSlug
    );
    if (!district) {
      district = {
        districtSlug: location.districtSlug,
        districtName: location.districtName,
        constituencies: [],
      };
      province.districts.push(district);
    }
    district.constituencies.push(location.constituencyNo);
  });

  const provinces = [...provinceMap.values()];
  return res.send(
    new ApiResponse(200, "Location filters loaded", {
      provinceCount: provinces.length,
      districtCount: locations.reduce((acc, curr, idx, arr) => {
        if (idx === 0) return 1;
        const prev = arr[idx - 1];
        return acc +
          (prev.provinceId !== curr.provinceId || prev.districtSlug !== curr.districtSlug
            ? 1
            : 0);
      }, locations.length ? 0 : 0),
      constituencyCount: locations.length,
      provinces,
    })
  );
});

const GetConstituencyResult = asyncHandler(async (req, res) => {
  const provinceId = Number(req.query.provinceId);
  const districtSlug = (req.query.district || "").replace(/\s+/g, " ").trim().toLowerCase();
  const constituencyNo = Number(req.query.constituencyNo);

  if (!provinceId || !districtSlug || !constituencyNo) {
    throw new ApiError(
      400,
      "provinceId, district, and constituencyNo are required query params."
    );
  }

  const cached = await ConstituencyResult.findOne({
    provinceId,
    districtSlug,
    constituencyNo,
  }).lean();

  if (cached) {
    return res.send(
      new ApiResponse(
        200,
        "Constituency result loaded from cache",
        sanitizeConstituencyResult(cached)
      )
    );
  }
  throw new ApiError(404, "Result not found in cache. Contact the developer.");
});

export {
  EvaluateCandidates,
  GetProvincesStaus,
  GetPartyStatus,
  GetMapSummary,
  GetLocationFilters,
  GetConstituencyResult,
};

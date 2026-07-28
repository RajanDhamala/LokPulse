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

const evaluateCandidates = asyncHandler(async (req, res) => {
  const snapshot = await PopularSnapshot.findOne({ key: "popular-candidates" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const candidates = snapshot.candidates || [];

  return res.send(
    new ApiResponse(200, "Popular candidates evaluated", {
      count: snapshot.count || candidates.length,
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      isCompleted: !!snapshot.isCompleted,
      candidates: sanitizePopularCandidates(candidates),
    })
  );
});

const getProvinceStatus = asyncHandler(async (req, res) => {
  const snapshot = await ProvinceSnapshot.findOne({ key: "province-status" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const provinces = snapshot.provinces || [];

  return res.send(
    new ApiResponse(200, "Province status loaded from cache", {
      extractedAt: new Date().toISOString(),
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      count: snapshot.count || provinces.length,
      provinces: sanitizeProvinceParties(provinces),
    })
  );
});

const getPartyStatus = asyncHandler(async (req, res) => {
  const snapshot = await PartySnapshot.findOne({ key: "party-status" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const parties = snapshot.parties || [];

  return res.send(
    new ApiResponse(200, "Party status loaded from cache", {
      extractedAt: new Date().toISOString(),
      lastScraped: snapshot.lastScraped,
      cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
      title: snapshot.title || "पार्टीगत नतिजा",
      count: snapshot.count || parties.length,
      parties: sanitizePartyStatus(parties),
    })
  );
});

const getMapSummary = asyncHandler(async (req, res) => {
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
            input: {
              $slice: [
                {
                  $sortArray: {
                    input: "$candidates",
                    sortBy: { totalVotes: -1 },
                  },
                },
                3,
              ],
            },
            as: "c",
            in: {
              candidateName: "$$c.candidateName",
              partyName: "$$c.partyName",
              partyImage: {
                $ifNull: [
                  "$$c.partyImage",
                  { $ifNull: ["$$c.partyAvatarUrl", null] },
                ],
              },
              candidateImage: {
                $ifNull: [
                  "$$c.candidateImage",
                  { $ifNull: ["$$c.candidateAvatarUrl", null] },
                ],
              },
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

const getLocationFilters = asyncHandler(async (req, res) => {
  const locations = await LocationIndex.find()
    .sort({ provinceId: 1, districtSlug: 1, constituencyNo: 1 })
    .lean();

  if (!locations.length) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const provinces = [];
  let currentProvince;
  let currentDistrict;
  let districtCount = 0;

  for (const location of locations) {
    if (!currentProvince || currentProvince.provinceId !== location.provinceId) {
      currentProvince = {
        provinceId: location.provinceId,
        provinceName: location.provinceName,
        districts: [],
      };
      provinces.push(currentProvince);
      currentDistrict = undefined;
    }

    if (!currentDistrict || currentDistrict.districtSlug !== location.districtSlug) {
      currentDistrict = {
        districtSlug: location.districtSlug,
        districtName: location.districtName,
        constituencies: [],
      };
      currentProvince.districts.push(currentDistrict);
      districtCount += 1;
    }

    currentDistrict.constituencies.push(location.constituencyNo);
  }

  return res.send(
    new ApiResponse(200, "Location filters loaded", {
      provinceCount: provinces.length,
      districtCount,
      constituencyCount: locations.length,
      provinces,
    })
  );
});

const getConstituencyResult = asyncHandler(async (req, res) => {
  const {
    provinceId: provinceValue,
    district: districtValue,
    constituencyNo: constituencyValue,
  } = req.query;

  const isPositiveInteger = (value) =>
    typeof value === "string" && /^[1-9]\d*$/.test(value);

  if (
    !isPositiveInteger(provinceValue) ||
    !isPositiveInteger(constituencyValue) ||
    typeof districtValue !== "string"
  ) {
    throw new ApiError(
      400,
      "provinceId, district, and constituencyNo must be single, valid query values."
    );
  }

  const provinceId = Number(provinceValue);
  const districtSlug = districtValue.trim().toLowerCase();
  const constituencyNo = Number(constituencyValue);

  if (
    provinceId < 1 ||
    provinceId > 7 ||
    constituencyNo < 1 ||
    constituencyNo > 99 ||
    districtSlug.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(districtSlug)
  ) {
    throw new ApiError(400, "Constituency query values are outside the accepted range.");
  }

  const cached = await ConstituencyResult.findOne({
    provinceId,
    districtSlug,
    constituencyNo,
  }).lean();

  if (!cached) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const result = sanitizeConstituencyResult(cached);

  return res.send(
    new ApiResponse(200, "Constituency result loaded from cache", result)
  );
});

export {
  evaluateCandidates,
  getProvinceStatus,
  getPartyStatus,
  getMapSummary,
  getLocationFilters,
  getConstituencyResult,
};

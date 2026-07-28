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
import { createFinalResultLoader } from "../lib/finalResultCache.js";

const loadPopularCandidates = async () => {
  const snapshot = await PopularSnapshot.findOne({ key: "popular-candidates" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const candidates = snapshot.candidates || [];

  return {
    count: snapshot.count || candidates.length,
    lastScraped: snapshot.lastScraped,
    cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
    isCompleted: !!snapshot.isCompleted,
    candidates: sanitizePopularCandidates(candidates),
  };
};

const loadProvinceStatus = async () => {
  const snapshot = await ProvinceSnapshot.findOne({ key: "province-status" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const provinces = snapshot.provinces || [];

  return {
    extractedAt: new Date().toISOString(),
    lastScraped: snapshot.lastScraped,
    cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
    count: snapshot.count || provinces.length,
    provinces: sanitizeProvinceParties(provinces),
  };
};

const loadPartyStatus = async () => {
  const snapshot = await PartySnapshot.findOne({ key: "party-status" }).lean();

  if (!snapshot) {
    throw new ApiError(404, "Result not found in cache. Contact the developer.");
  }

  const parties = snapshot.parties || [];

  return {
    extractedAt: new Date().toISOString(),
    lastScraped: snapshot.lastScraped,
    cacheUpdatedAt: snapshot.updatedAt || snapshot.lastScraped,
    title: snapshot.title || "पार्टीगत नतिजा",
    count: snapshot.count || parties.length,
    parties: sanitizePartyStatus(parties),
  };
};

const loadMapSummary = async () => {
  const constituencies = await ConstituencyResult.aggregate([
    {
      $set: {
        winner: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: { $ifNull: ["$candidates", []] },
                sortBy: { totalVotes: -1, position: 1 },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        provinceId: 1,
        districtSlug: 1,
        districtName: 1,
        constituencyNo: 1,
        isCompleted: { $ifNull: ["$isCompleted", false] },
        winner: {
          $cond: [
            { $eq: [{ $ifNull: ["$winner", null] }, null] },
            null,
            {
              partyName: "$winner.partyName",
              partyImage: {
                $ifNull: [
                  "$winner.partyImage",
                  { $ifNull: ["$winner.partyAvatarUrl", null] },
                ],
              },
              totalVotes: { $ifNull: ["$winner.totalVotes", 0] },
            },
          ],
        },
      },
    },
    {
      $sort: {
        provinceId: 1,
        districtSlug: 1,
        constituencyNo: 1,
      },
    },
  ]);

  return {
    count: constituencies.length,
    constituencies,
  };
};

const loadLocationFilters = async () => {
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

  return {
    provinceCount: provinces.length,
    districtCount,
    constituencyCount: locations.length,
    provinces,
  };
};

const getPopularCandidatesData = createFinalResultLoader(loadPopularCandidates);
const getProvinceStatusData = createFinalResultLoader(loadProvinceStatus);
const getPartyStatusData = createFinalResultLoader(loadPartyStatus);
const getMapSummaryData = createFinalResultLoader(loadMapSummary);
const getLocationFiltersData = createFinalResultLoader(loadLocationFilters);

const evaluateCandidates = asyncHandler(async (_req, res) => {
  return res.send(
    new ApiResponse(
      200,
      "Popular candidates evaluated",
      await getPopularCandidatesData()
    )
  );
});

const getProvinceStatus = asyncHandler(async (_req, res) => {
  return res.send(
    new ApiResponse(
      200,
      "Province status loaded from cache",
      await getProvinceStatusData()
    )
  );
});

const getPartyStatus = asyncHandler(async (_req, res) => {
  return res.send(
    new ApiResponse(
      200,
      "Party status loaded from cache",
      await getPartyStatusData()
    )
  );
});

const getMapSummary = asyncHandler(async (_req, res) => {
  return res.send(
    new ApiResponse(200, "Map summary loaded", await getMapSummaryData())
  );
});

const getLocationFilters = asyncHandler(async (_req, res) => {
  return res.send(
    new ApiResponse(
      200,
      "Location filters loaded",
      await getLocationFiltersData()
    )
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

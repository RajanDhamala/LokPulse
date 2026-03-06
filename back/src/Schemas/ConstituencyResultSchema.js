import mongoose from "mongoose";

const CandidateResultSchema = new mongoose.Schema(
  {
    candidateName: { type: String, required: true, trim: true },
    candidateProfileUrl: { type: String, default: null, trim: true },
    candidateAvatarUrl: { type: String, default: null, trim: true },
    candidateImage: { type: String, default: null, trim: true },
    partyName: { type: String, required: true, trim: true },
    partyProfileUrl: { type: String, default: null, trim: true },
    partyAvatarUrl: { type: String, default: null, trim: true },
    partyUrl: { type: String, default: null, trim: true },
    partyImage: { type: String, default: null, trim: true },
    totalVotes: { type: Number, default: 0 },
    totalVotesText: { type: String, default: "0", trim: true },
    marginText: { type: String, default: "0", trim: true },
    position: { type: Number, default: 0 },
    status: { type: String, default: null, trim: true }
  },
  { _id: false }
);

const ConstituencyResultSchema = new mongoose.Schema(
  {
    provinceId: { type: Number, required: true, index: true },
    provinceName: { type: String, required: true, trim: true },
    districtSlug: { type: String, required: true, trim: true, index: true },
    districtName: { type: String, required: true, trim: true },
    constituencyNo: { type: Number, required: true, index: true },
    constituencyTitle: { type: String, default: "", trim: true },
    constituencyUrl: { type: String, required: true, trim: true },
    sourceSummary: { type: String, default: "", trim: true },
    candidates: { type: [CandidateResultSchema], default: [] },
    scrapedAt: { type: Date, required: true },
    checksum: { type: String, default: "" }
  },
  { timestamps: true }
);

ConstituencyResultSchema.index(
  { provinceId: 1, districtSlug: 1, constituencyNo: 1 },
  { unique: true }
);

const ConstituencyResult = mongoose.model("ConstituencyResult", ConstituencyResultSchema);
export default ConstituencyResult;

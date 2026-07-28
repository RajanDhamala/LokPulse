import mongoose from "mongoose";

const LocationIndexSchema = new mongoose.Schema(
  {
    provinceId: {
      type: Number,
      required: true,
      index: true
    },
    provinceName: {
      type: String,
      required: true,
      trim: true
    },
    districtSlug: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    districtName: {
      type: String,
      required: true,
      trim: true
    },
    constituencyNo: {
      type: Number,
      required: true
    },
    constituencyUrl: {
      type: String,
      required: true,
      trim: true
    },
    sourceLastScraped: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

LocationIndexSchema.index(
  { provinceId: 1, districtSlug: 1, constituencyNo: 1 },
  { unique: true }
);

const LocationIndex = mongoose.model("LocationIndex", LocationIndexSchema);
export default LocationIndex;

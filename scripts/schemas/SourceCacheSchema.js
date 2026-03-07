import mongoose from "mongoose";

const SourceCacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true
    },
    html: {
      type: String,
      required: true
    },
    fetchedAt: {
      type: Date,
      required: true
    },
    checksum: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

const SourceCache = mongoose.model("SourceCache", SourceCacheSchema);
export default SourceCache;

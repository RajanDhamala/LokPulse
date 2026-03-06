import mongoose from "mongoose";

const PopularSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    lastScraped: { type: Date, required: true },
    count: { type: Number, default: 0 },
    candidates: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const PopularSnapshot = mongoose.model("PopularSnapshot", PopularSnapshotSchema);
export default PopularSnapshot;

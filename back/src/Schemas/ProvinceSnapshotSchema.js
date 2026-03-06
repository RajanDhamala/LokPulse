import mongoose from "mongoose";

const ProvinceSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    lastScraped: { type: Date, required: true },
    count: { type: Number, default: 0 },
    provinces: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const ProvinceSnapshot = mongoose.model("ProvinceSnapshot", ProvinceSnapshotSchema);
export default ProvinceSnapshot;

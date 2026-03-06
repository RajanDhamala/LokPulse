import mongoose from "mongoose";

const PartySnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "पार्टीगत नतिजा" },
    lastScraped: { type: Date, required: true },
    count: { type: Number, default: 0 },
    parties: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const PartySnapshot = mongoose.model("PartySnapshot", PartySnapshotSchema);
export default PartySnapshot;

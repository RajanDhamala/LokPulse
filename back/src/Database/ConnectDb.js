import mongoose from "mongoose"

const connectDB = async () => {
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error("[db] MONGODB_URL environment variable is not set");
    process.exit(1);
  }
  try {
    await mongoose.connect(url);
    console.log("[db] Connected to MongoDB");
  } catch (err) {
    console.error("[db] Connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;

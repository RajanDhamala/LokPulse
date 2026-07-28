import mongoose from "mongoose";

const connectDB = async () => {
  const url = process.env.MONGODB_URL;
  if (!url) {
    throw new Error("MONGODB_URL environment variable is not set");
  }

  try {
    await mongoose.connect(url);
    console.log("[db] Connected to MongoDB");
  } catch (error) {
    throw new Error("MongoDB connection failed", { cause: error });
  }
};

export default connectDB;

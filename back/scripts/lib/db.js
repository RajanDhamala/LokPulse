import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

let connected = false;

export const connectDB = async () => {
  if (connected) return;
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error("MONGODB_URL is not set in .env");
    process.exit(1);
  }
  await mongoose.connect(url);
  connected = true;
  console.log("[db] Connected to MongoDB");
};

export const disconnectDB = async () => {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log("[db] Disconnected from MongoDB");
};

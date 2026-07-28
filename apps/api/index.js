import app from "./app.js";
import connectDB from "./src/Database/ConnectDb.js";
import { getPort } from "./src/Config/Environment.js";

const port = getPort();

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`[server] Running on port ${port}`);
    });
  } catch (error) {
    console.error("[server] Failed to start:", error.message);
    process.exit(1);
  }
};

startServer();

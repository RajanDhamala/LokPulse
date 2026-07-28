import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import electionRouter from "./src/Routes/ElectionRoute.js";
import {
  getCorsOptions,
  getRateLimitPerMinute,
} from "./src/Config/Environment.js";

dotenv.config({ quiet: true });

const app = express();

const electionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: getRateLimitPerMinute(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

app.disable("x-powered-by");
app.set('trust proxy', 1);
app.set("query parser", "simple");

app.use(helmet());
app.use(cors(getCorsOptions()));

app.get("/", (_req, res) => {
  return res.send("Server is up and running");
});

app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

app.use("/elections", electionLimiter, electionRouter);

app.use((_req, res) => {
  return res.status(404).json({ message: "Endpoint not found." });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal Server Error" : error.message;

  return res.status(statusCode).json({ message });
});

export default app;

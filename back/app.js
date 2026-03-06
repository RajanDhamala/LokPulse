import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import ElectionRouter from "./src/Routes/ElectionRoute.js";

dotenv.config();

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

app.use(express.json({ limit: "1kb" }));

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/elections", ElectionRouter);

app.use((err, req, res, next) => {
  const status = err?.statusCode || 500;
  res.status(status).json({
    message: err?.message || "Internal Server Error",
  });
});

export default app;


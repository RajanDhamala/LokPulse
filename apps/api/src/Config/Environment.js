const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export const getCorsOptions = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: allowedOrigins?.length ? allowedOrigins : LOCAL_DEVELOPMENT_ORIGINS,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  };
};

export const getRateLimitPerMinute = () =>
  Number(process.env.RATE_LIMIT_PER_MINUTE) || 60;

export const areElectionResultsFinal = () =>
  process.env.ELECTION_RESULTS_FINAL?.trim().toLowerCase() === "true";

export const getPort = () => Number(process.env.PORT) || 8000;

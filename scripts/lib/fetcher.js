import axios from "axios";

const USER_AGENT =
  "Mozilla/5.0 (compatible; ElectionScraper/1.0; +https://github.com/yourproject)";

const RATE_LIMIT_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS) || 1500;

export const fetchPage = async (url) => {
  const response = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 15000,
  });
  return response.data;
};

export const sleep = (ms = RATE_LIMIT_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

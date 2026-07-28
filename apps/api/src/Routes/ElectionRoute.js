import { Router } from "express";
import {
  evaluateCandidates,
  getProvinceStatus,
  getPartyStatus,
  getMapSummary,
  getLocationFilters,
  getConstituencyResult,
} from "../Controllers/ElectionController.js";

const electionRouter = Router();

electionRouter.get("/", (_req, res) => {
  return res.send("election endpoint is up");
});

electionRouter.get("/eval", evaluateCandidates);
electionRouter.get("/status", getProvinceStatus);
electionRouter.get("/party-status", getPartyStatus);
electionRouter.get("/filters", getLocationFilters);
electionRouter.get("/map-summary", getMapSummary);
electionRouter.get("/constituency", getConstituencyResult);

export default electionRouter;

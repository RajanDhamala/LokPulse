import Router from "express";
import {
  EvaluateCandidates,
  GetProvincesStaus,
  GetPartyStatus,
  GetLocationFilters,
  GetConstituencyResult,
} from "../Controllers/ElectionController.js";

const ElectionRouter = Router();

ElectionRouter.get("/", (req, res) => {
  return res.send("election endpoint is up");
});

ElectionRouter.get("/eval", EvaluateCandidates);
ElectionRouter.get("/status", GetProvincesStaus);
ElectionRouter.get("/party-status", GetPartyStatus);
ElectionRouter.get("/filters", GetLocationFilters);
ElectionRouter.get("/constituency", GetConstituencyResult);

export default ElectionRouter;


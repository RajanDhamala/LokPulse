import { areElectionResultsFinal } from "../Config/Environment.js";

export const createFinalResultLoader = (
  loadFromDatabase,
  isFinal = areElectionResultsFinal
) => {
  let cachedValue;
  let hasCachedValue = false;
  let pendingLoad;

  const loadAndCache = async () => {
    try {
      const value = await loadFromDatabase();
      cachedValue = value;
      hasCachedValue = true;
      return value;
    } finally {
      pendingLoad = undefined;
    }
  };

  return async () => {
    // During development or active counting, always read the latest database value.
    if (!isFinal()) {
      return loadFromDatabase();
    }
    if (hasCachedValue) {
      return cachedValue;
    }

    if (!pendingLoad) {
      pendingLoad = loadAndCache();
    }

    return pendingLoad;
  };
};

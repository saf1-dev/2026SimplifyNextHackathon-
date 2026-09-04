import { VALUATION_CONFIG } from "../config/valuation";
import { ageBucket, ccBucket, coeBucket, mileageBucket } from "./buckets";
import { normalizeModel } from "./comparable-id";
import { similarityScore } from "./similarity";
import type { ComparableSearchResult, MotorcycleListing } from "./types";

type MatchKey = "brand" | "model" | "engineClass" | "ccBucket" | "coeBucket" | "ageBucket" | "mileageBucket" | "conditionGroup";

const levels: MatchKey[][] = [
  ["brand", "model", "engineClass", "ccBucket", "coeBucket", "ageBucket", "mileageBucket", "conditionGroup"],
  ["brand", "model", "engineClass", "ccBucket", "coeBucket", "ageBucket", "mileageBucket"],
  ["brand", "model", "engineClass", "ccBucket", "coeBucket", "ageBucket"],
  ["brand", "model", "engineClass", "ccBucket", "coeBucket"],
  ["brand", "model", "engineClass"],
  ["brand", "engineClass", "ccBucket", "coeBucket"],
  ["brand", "engineClass", "ccBucket"],
  ["engineClass", "ccBucket"],
];

function value(listing: MotorcycleListing, key: MatchKey): string {
  if (key === "brand") return listing.brand.toUpperCase();
  if (key === "model") return normalizeModel(listing.model);
  if (key === "engineClass") return listing.engineClass;
  if (key === "ccBucket") return ccBucket(listing.engineCc);
  if (key === "coeBucket") return coeBucket(listing.coeRemainingYears);
  if (key === "ageBucket") return ageBucket(listing.ageYears);
  if (key === "mileageBucket") return mileageBucket(listing.mileageKm);
  return listing.conditionGroup;
}

export function findComparables(target: MotorcycleListing, listings: MotorcycleListing[]): ComparableSearchResult {
  let selected: MotorcycleListing[] = [];
  let selectedLevel = levels.length;
  for (let index = 0; index < levels.length; index += 1) {
    const keys = levels[index];
    const matches = listings.filter((candidate) =>
      candidate.id !== target.id &&
      candidate.askingPriceSgd > 0 &&
      keys.every((key) => value(candidate, key) === value(target, key)),
    );
    selected = matches;
    selectedLevel = index + 1;
    if (matches.length >= VALUATION_CONFIG.minComparables) break;
  }

  const filtersUsed = levels[selectedLevel - 1];
  const relaxed = levels[0].filter((key) => !filtersUsed.includes(key));
  const comparables = selected
    .map((listing) => ({ ...listing, similarity: similarityScore(target, listing) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, VALUATION_CONFIG.maxComparables);

  return {
    level: selectedLevel,
    filtersUsed,
    filtersRelaxed: relaxed,
    comparables,
    count: comparables.length,
  };
}

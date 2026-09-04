import { calculateValuation } from "./valuation";
import type { MotorcycleListing, ValuationResult } from "./types";

const cache = new Map<string, ValuationResult | null>();

export function getValuation(listing: MotorcycleListing, listings: MotorcycleListing[]): ValuationResult | null {
  const dataVersion = `${listings.length}:${listings.reduce((latest, item) => item.dateCollected && item.dateCollected > latest ? item.dateCollected : latest, "")}`;
  const key = `${listing.id}:${dataVersion}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const valuation = calculateValuation(listing, listings);
  cache.set(key, valuation);
  return valuation;
}

import { VALUATION_CONFIG } from "../config/valuation";
import { calculateConfidence } from "./confidence";
import { findComparables } from "./comparable-search";
import type { ComparableListing, MotorcycleListing, ValuationResult } from "./types";

export function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * p;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

export function removePriceOutliers(comparables: ComparableListing[]): ComparableListing[] {
  if (comparables.length < 4) return comparables;
  const prices = comparables.map((item) => item.askingPriceSgd);
  const q1 = quantile(prices, 0.25);
  const q3 = quantile(prices, 0.75);
  const iqr = q3 - q1;
  const low = q1 - VALUATION_CONFIG.priceOutlierIqrMultiplier * iqr;
  const high = q3 + VALUATION_CONFIG.priceOutlierIqrMultiplier * iqr;
  const filtered = comparables.filter((item) => item.askingPriceSgd >= low && item.askingPriceSgd <= high);
  return filtered.length >= 3 ? filtered : comparables;
}

function roundPrice(value: number): number {
  return Math.round(value / 50) * 50;
}

export function calculateValuation(target: MotorcycleListing, listings: MotorcycleListing[]): ValuationResult | null {
  const search = findComparables(target, listings);
  const comparables = removePriceOutliers(search.comparables);
  if (comparables.length < 2) return null;
  const prices = comparables.map((item) => item.askingPriceSgd);
  const weightTotal = comparables.reduce((sum, item) => sum + Math.max(item.similarity, 0.1), 0);
  const weightedMean = comparables.reduce((sum, item) => sum + item.askingPriceSgd * Math.max(item.similarity, 0.1), 0) / weightTotal;
  const median = quantile(prices, 0.5);
  const estimatedMid = median * 0.6 + weightedMean * 0.4;
  const averageSimilarity = comparables.reduce((sum, item) => sum + item.similarity, 0) / comparables.length;
  return {
    estimatedLow: roundPrice(quantile(prices, 0.25)),
    estimatedMid: roundPrice(estimatedMid),
    estimatedHigh: roundPrice(quantile(prices, 0.75)),
    median: roundPrice(median),
    weightedMean: roundPrice(weightedMean),
    comparableCount: comparables.length,
    searchLevel: search.level,
    filtersRelaxed: search.filtersRelaxed,
    confidence: calculateConfidence({ target, comparableCount: comparables.length, searchLevel: search.level, averageSimilarity }),
    averageSimilarity: Math.round(averageSimilarity * 1000) / 1000,
    comparables,
  };
}

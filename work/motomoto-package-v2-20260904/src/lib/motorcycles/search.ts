import { assessPrice, calculateDealScore } from "./deal-score";
import { calculateValuation } from "./valuation";
import type { HardSearchFilters, MotorcycleListing, SearchIntent, SearchResult, SoftPreferences } from "./types";

export function matchesFilters(listing: MotorcycleListing, filters: HardSearchFilters): boolean {
  return (!filters.engineClass || listing.engineClass === filters.engineClass) &&
    (!filters.brands?.length || filters.brands.some((brand) => brand.toLowerCase() === listing.brand.toLowerCase())) &&
    (filters.maxPriceSgd === undefined || listing.askingPriceSgd <= filters.maxPriceSgd) &&
    (filters.minCoeYears === undefined || (listing.coeRemainingYears !== null && listing.coeRemainingYears >= filters.minCoeYears)) &&
    (filters.maxMileageKm === undefined || (listing.mileageKm !== null && listing.mileageKm <= filters.maxMileageKm)) &&
    (filters.minEngineCc === undefined || listing.engineCc >= filters.minEngineCc) &&
    (filters.maxEngineCc === undefined || listing.engineCc <= filters.maxEngineCc) &&
    (filters.minAgeYears === undefined || (listing.ageYears !== null && listing.ageYears >= filters.minAgeYears)) &&
    (filters.maxAgeYears === undefined || (listing.ageYears !== null && listing.ageYears <= filters.maxAgeYears));
}

export function preferenceScore(listing: MotorcycleListing, preferences: SoftPreferences): number {
  const scores: number[] = [];
  if (preferences.preferredBrands?.length) scores.push(preferences.preferredBrands.some((b) => b.toLowerCase() === listing.brand.toLowerCase()) ? 1 : 0);
  if (preferences.preferLowerMileage) scores.push(listing.mileageKm === null ? 0.35 : Math.max(0, 1 - listing.mileageKm / 140_000));
  if (preferences.preferMoreCoe) scores.push(listing.coeRemainingYears === null ? 0.35 : Math.min(1, listing.coeRemainingYears / 10));
  if (preferences.preferBetterCondition || preferences.reliabilityPriority) scores.push(listing.conditionScore === null ? 0.4 : (listing.conditionScore - 1) / 4);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.65;
}

export function searchListings(listings: MotorcycleListing[], intent: SearchIntent, limit = 16): SearchResult[] {
  const shortlisted = listings
    .filter((listing) => matchesFilters(listing, intent.hardFilters))
    .map((listing) => ({ listing, preferenceScore: preferenceScore(listing, intent.softPreferences) }))
    .sort((a, b) => b.preferenceScore - a.preferenceScore)
    .slice(0, 30);

  return shortlisted.map(({ listing, preferenceScore }) => {
    const valuation = calculateValuation(listing, listings);
    const percentageDifference = valuation ? ((listing.askingPriceSgd - valuation.estimatedMid) / valuation.estimatedMid) * 100 : null;
    const deal = valuation ? calculateDealScore(listing, valuation, preferenceScore) : { score: Math.round(preferenceScore * 45), components: {} };
    return {
      listing,
      preferenceScore: Math.round(preferenceScore * 1000) / 1000,
      valuation,
      dealScore: deal.score,
      priceAssessment: percentageDifference === null ? null : assessPrice(percentageDifference),
      priceDifference: valuation ? listing.askingPriceSgd - valuation.estimatedMid : null,
      percentageDifference: percentageDifference === null ? null : Math.round(percentageDifference * 10) / 10,
    };
  }).sort((a, b) => b.dealScore - a.dealScore).slice(0, limit);
}

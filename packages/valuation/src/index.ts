import type { ListingRecord, SearchIntent } from "@motomoto/domain";

export const VALUATION_VERSION = "motomoto-comparable-v2";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface ComparableListing {
  listing: ListingRecord;
  matchLevel: 1 | 2 | 3 | 4;
  weight: number;
  reasons: string[];
}

export interface ValuationResult {
  valuationVersion: string;
  listedPriceSgd: number | null;
  estimatedValueSgd: number | null;
  rangeLowSgd: number | null;
  rangeHighSgd: number | null;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  reasonCodes: string[];
  comparableCount: number;
  authoritativeComparableCount: number;
  searchLevel: number | null;
  averageSimilarity: number;
  assessment: string;
  statusComposition: Record<string, number>;
  comparables: ComparableListing[];
  generatedAt: string;
  disclaimer: string;
}

const DAY = 86_400_000;

export function normalizeModel(value: string | null): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/\b(?:ABS|FI|EFI|EDITION|MODEL|MOTORCYCLE)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function conditionScore(listing: Pick<ListingRecord, "conditionEvidence" | "conditionScore">): number | null {
  if (listing.conditionScore !== null) return listing.conditionScore;
  const usable = listing.conditionEvidence.filter((item) => item.score !== null && item.reliability > 0);
  if (!usable.length) return null;
  const denominator = usable.reduce((sum, item) => sum + item.reliability, 0);
  return usable.reduce((sum, item) => sum + (item.score ?? 0) * item.reliability, 0) / denominator;
}

function freshnessWeight(lastSeenAt: string, now: Date): number {
  const ageDays = Math.max(0, (now.valueOf() - new Date(lastSeenAt).valueOf()) / DAY);
  return Math.pow(0.5, ageDays / 120);
}

function matchLevel(subject: ListingRecord, candidate: ListingRecord): 1 | 2 | 3 | 4 | null {
  if (!candidate.askingPriceSgd || candidate.id === subject.id || candidate.listingStatus === "REMOVED") return null;
  const sameBrand = subject.brand?.toUpperCase() === candidate.brand?.toUpperCase();
  const sameModel = normalizeModel(subject.model) !== "" && normalizeModel(subject.model) === normalizeModel(candidate.model);
  const sameClass = subject.engineClass && subject.engineClass === candidate.engineClass;
  const closeCc = subject.engineCc && candidate.engineCc ? Math.abs(subject.engineCc - candidate.engineCc) <= Math.max(25, subject.engineCc * 0.15) : false;
  if (sameBrand && sameModel && sameClass) return 1;
  if (sameBrand && sameModel) return 2;
  if (sameBrand && (sameClass || closeCc)) return 3;
  if (sameClass || closeCc) return 4;
  return null;
}

function comparableWeight(subject: ListingRecord, candidate: ListingRecord, level: 1 | 2 | 3 | 4, now: Date): number {
  const levelWeight = [0, 1, 0.82, 0.55, 0.32][level] ?? 0;
  const priceReliability = candidate.priceType === "FULL_PRICE" || candidate.priceType === "TOTAL_INSTALLMENT_PRICE" ? 1 : candidate.priceType === "UNKNOWN" ? 0.18 : 0;
  if (!priceReliability) return 0;
  let similarity = 1;
  if (subject.ageYears !== null && candidate.ageYears !== null) similarity *= Math.max(0.35, 1 - Math.abs(subject.ageYears - candidate.ageYears) / 12);
  if (subject.coeRemainingYears !== null && candidate.coeRemainingYears !== null) similarity *= Math.max(0.35, 1 - Math.abs(subject.coeRemainingYears - candidate.coeRemainingYears) / 10);
  if (subject.mileageKm !== null && candidate.mileageKm !== null) similarity *= Math.max(0.45, 1 - Math.abs(subject.mileageKm - candidate.mileageKm) / 120_000);
  const subjectCondition = conditionScore(subject);
  const candidateCondition = conditionScore(candidate);
  if (subjectCondition !== null && candidateCondition !== null) similarity *= Math.max(0.6, 1 - Math.abs(subjectCondition - candidateCondition) / 5);
  return levelWeight * priceReliability * freshnessWeight(candidate.lastSeenAt, now) * similarity;
}

function weightedQuantile(values: Array<{ value: number; weight: number }>, quantile: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total * quantile) return item.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

export function valueListing(subject: ListingRecord, candidates: ListingRecord[], now = new Date()): ValuationResult {
  const deduped = new Map(candidates.map((listing) => [listing.id, listing]));
  const comparables: ComparableListing[] = [];
  for (const candidate of deduped.values()) {
    const level = matchLevel(subject, candidate);
    if (!level) continue;
    const weight = comparableWeight(subject, candidate, level, now);
    if (weight <= 0.02) continue;
    comparables.push({
      listing: candidate,
      matchLevel: level,
      weight,
      reasons: [`MATCH_LEVEL_${level}`, candidate.priceType === "UNKNOWN" ? "LEGACY_PRICE_TYPE_UNKNOWN" : "CONFIRMED_TOTAL_PRICE"],
    });
  }
  comparables.sort((a, b) => b.weight - a.weight);
  const statusComposition = comparables.reduce<Record<string, number>>((counts, item) => { counts[item.listing.listingStatus] = (counts[item.listing.listingStatus] ?? 0) + 1; return counts; }, {});
  const searchLevel = comparables.length ? Math.min(...comparables.map((item) => item.matchLevel)) : null;
  const averageSimilarity = comparables.length ? comparables.reduce((sum, item) => sum + item.weight, 0) / comparables.length : 0;
  const authoritative = comparables.filter((item) => item.listing.priceType === "FULL_PRICE" || item.listing.priceType === "TOTAL_INSTALLMENT_PRICE");
  const usable = authoritative.length >= 2 ? authoritative : comparables;
  const weighted = usable.map((item) => ({ value: item.listing.askingPriceSgd ?? 0, weight: item.weight }));
  const reasons: string[] = [];
  if (!weighted.length) reasons.push("NO_ELIGIBLE_COMPARABLES");
  if (!authoritative.length && comparables.length) reasons.push("LEGACY_UNKNOWN_PRICE_TYPES_ONLY");
  if (authoritative.length < 3) reasons.push("TOO_FEW_AUTHORITATIVE_COMPARABLES");
  if (!subject.coeRemainingYears) reasons.push("SUBJECT_COE_DATA_MISSING");
  if (subject.mileageKm === null) reasons.push("SUBJECT_MILEAGE_MISSING");
  const targetPriceVerified = subject.priceType === "FULL_PRICE" || subject.priceType === "TOTAL_INSTALLMENT_PRICE";
  if (!targetPriceVerified) reasons.push("TARGET_PRICE_NOT_VERIFIED");
  const median = weighted.length ? Math.round(weightedQuantile(weighted, 0.5)) : null;
  const low = weighted.length ? Math.round(weightedQuantile(weighted, 0.25)) : null;
  const high = weighted.length ? Math.round(weightedQuantile(weighted, 0.75)) : null;
  const effectiveWeight = authoritative.reduce((sum, item) => sum + item.weight, 0);
  const dataCompleteness = [subject.engineClass, subject.coeRemainingYears, subject.mileageKm, subject.conditionScore].filter((value) => value !== null && value !== undefined).length / 4;
  let score = Math.min(1, (effectiveWeight / 4) * 0.65 + dataCompleteness * 0.35);
  if (authoritative.length < 2) score = Math.min(score, 0.24);
  if (!targetPriceVerified) score = 0;
  const confidence: ConfidenceLevel = !weighted.length || !targetPriceVerified ? "INSUFFICIENT" : score >= 0.75 ? "HIGH" : score >= 0.5 ? "MEDIUM" : "LOW";
  const estimated = targetPriceVerified ? median : null;
  const differenceRatio = estimated && subject.askingPriceSgd ? (subject.askingPriceSgd - estimated) / estimated : null;
  const assessment = confidence === "HIGH" || confidence === "MEDIUM"
    ? differenceRatio === null ? "Comparable asking-price range" : differenceRatio <= -0.2 ? "Strong Deal" : differenceRatio <= -0.1 ? "Good Deal" : differenceRatio <= 0.1 ? "Fairly Priced" : differenceRatio <= 0.2 ? "Slightly Overpriced" : differenceRatio <= 0.35 ? "Overpriced" : "Significantly Overpriced"
    : confidence === "LOW" ? "Indicative comparison only" : "Not enough evidence for a reliable deal classification";
  return {
    valuationVersion: VALUATION_VERSION,
    listedPriceSgd: subject.askingPriceSgd,
    estimatedValueSgd: estimated,
    rangeLowSgd: targetPriceVerified ? low : null,
    rangeHighSgd: targetPriceVerified ? high : null,
    confidence,
    confidenceScore: Math.round(score * 100) / 100,
    reasonCodes: reasons,
    comparableCount: comparables.length,
    authoritativeComparableCount: authoritative.length,
    searchLevel,
    averageSimilarity: Math.round(averageSimilarity * 100) / 100,
    assessment,
    statusComposition,
    comparables: comparables.slice(0, 12),
    generatedAt: now.toISOString(),
    disclaimer: "Indicative asking-price estimate only. Verify listing details, financing terms and vehicle condition independently.",
  };
}

export function searchListings(listings: ListingRecord[], intent: SearchIntent): ListingRecord[] {
  return listings
    .filter((item) => item.listingStatus === "AVAILABLE" || item.listingStatus === "RESERVED")
    .filter((item) => !intent.hardFilters.engineClass || item.engineClass === intent.hardFilters.engineClass)
    .filter((item) => !intent.hardFilters.brands?.length || !!item.brand && intent.hardFilters.brands.some((brand) => brand.toLowerCase() === item.brand?.toLowerCase()))
    .filter((item) => !intent.hardFilters.maxPriceSgd || !!item.askingPriceSgd && item.askingPriceSgd <= intent.hardFilters.maxPriceSgd)
    .filter((item) => !intent.hardFilters.minCoeYears || !!item.coeRemainingYears && item.coeRemainingYears >= intent.hardFilters.minCoeYears)
    .filter((item) => !intent.hardFilters.maxMileageKm || item.mileageKm !== null && item.mileageKm <= intent.hardFilters.maxMileageKm)
    .filter((item) => !intent.hardFilters.minEngineCc || item.engineCc !== null && item.engineCc >= intent.hardFilters.minEngineCc)
    .filter((item) => !intent.hardFilters.maxEngineCc || item.engineCc !== null && item.engineCc <= intent.hardFilters.maxEngineCc)
    .sort((a, b) => {
      let aScore = 0;
      let bScore = 0;
      if (intent.softPreferences.preferredBrands?.some((brand) => brand.toLowerCase() === a.brand?.toLowerCase())) aScore += 2;
      if (intent.softPreferences.preferredBrands?.some((brand) => brand.toLowerCase() === b.brand?.toLowerCase())) bScore += 2;
      if (intent.softPreferences.preferLowerMileage) { aScore -= (a.mileageKm ?? 150_000) / 100_000; bScore -= (b.mileageKm ?? 150_000) / 100_000; }
      if (intent.softPreferences.preferMoreCoe) { aScore += a.coeRemainingYears ?? 0; bScore += b.coeRemainingYears ?? 0; }
      if (intent.softPreferences.preferBetterCondition) { aScore += conditionScore(a) ?? 0; bScore += conditionScore(b) ?? 0; }
      return bScore - aScore;
    });
}

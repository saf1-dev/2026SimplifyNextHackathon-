export type EngineClass = "2B" | "2A" | "2";
export type ConfidenceLevel = "high" | "medium" | "low";
export type PriceAssessment =
  | "strong_deal"
  | "good_deal"
  | "fairly_priced"
  | "slightly_overpriced"
  | "overpriced"
  | "significantly_overpriced";

export interface MotorcycleListing {
  id: string;
  source: string;
  sourceListingId: string | null;
  listingUrl: string;
  dateCollected: string | null;
  listingAgeDays: number | null;
  listingStatus: string | null;
  brand: string;
  model: string;
  engineCc: number;
  engineClass: EngineClass;
  askingPriceSgd: number;
  mileageKm: number | null;
  registrationDate: string | null;
  coeExpiry: string | null;
  ageDays: number | null;
  ageYears: number | null;
  coeRemainingDays: number | null;
  coeRemainingYears: number | null;
  roadTaxExpiry: string | null;
  numberOfOwners: number | null;
  location: string | null;
  originalPriceSgd: number | null;
  priceChangePercent: number | null;
  paymentOption: string | null;
  maintenanceHistory: number | null;
  accidentDamageDisclosure: string | null;
  modifications: string | null;
  tyreCondition: number | null;
  chainSprocketCondition: number | null;
  visibleRustCorrosion: number | null;
  visibleDamage: number | null;
  evidenceCompleteness: number | null;
  descriptionNotes: string | null;
  redFlags: string | null;
  conditionScore: number | null;
  conditionGroup: string;
  comparableGroupId: string;
}

export interface HardSearchFilters {
  engineClass?: EngineClass;
  brands?: string[];
  maxPriceSgd?: number;
  minCoeYears?: number;
  maxMileageKm?: number;
  minEngineCc?: number;
  maxEngineCc?: number;
  minAgeYears?: number;
  maxAgeYears?: number;
}

export interface SoftPreferences {
  preferredBrands?: string[];
  usage?: "commuting" | "touring" | "sport" | "delivery" | "general";
  preferLowerMileage?: boolean;
  reliabilityPriority?: boolean;
  preferMoreCoe?: boolean;
  preferBetterCondition?: boolean;
}

export interface SearchIntent {
  hardFilters: HardSearchFilters;
  softPreferences: SoftPreferences;
  summary: string;
  source: "groq" | "fallback" | "manual";
}

export interface ComparableListing extends MotorcycleListing {
  similarity: number;
}

export interface ComparableSearchResult {
  level: number;
  filtersUsed: string[];
  filtersRelaxed: string[];
  comparables: ComparableListing[];
  count: number;
}

export interface ValuationResult {
  estimatedLow: number;
  estimatedMid: number;
  estimatedHigh: number;
  median: number;
  weightedMean: number;
  comparableCount: number;
  searchLevel: number;
  filtersRelaxed: string[];
  confidence: ConfidenceLevel;
  averageSimilarity: number;
  comparables: ComparableListing[];
}

export interface DealScoreResult {
  score: number;
  components: Record<string, number>;
}

export interface SearchResult {
  listing: MotorcycleListing;
  preferenceScore: number;
  valuation: ValuationResult | null;
  dealScore: number;
  priceAssessment: PriceAssessment | null;
  priceDifference: number | null;
  percentageDifference: number | null;
}

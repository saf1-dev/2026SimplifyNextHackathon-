import { describe, expect, it } from "vitest";
import { ageBucket, ccBucket, coeBucket, mileageBucket } from "../src/lib/motorcycles/buckets";
import { calculateCondition } from "../src/lib/motorcycles/condition";
import { buildComparableGroupId } from "../src/lib/motorcycles/comparable-id";
import { findComparables } from "../src/lib/motorcycles/comparable-search";
import { similarityScore } from "../src/lib/motorcycles/similarity";
import { calculateValuation, removePriceOutliers } from "../src/lib/motorcycles/valuation";
import { calculateConfidence } from "../src/lib/motorcycles/confidence";
import { assessPrice, calculateDealScore } from "../src/lib/motorcycles/deal-score";
import { listing } from "./fixtures/listings";

describe("bucket boundaries", () => {
  it("assigns CC boundaries", () => { expect(ccBucket(200)).toBe("CC0-200"); expect(ccBucket(201)).toBe("CC201-400"); expect(ccBucket(1201)).toBe("CC1200+"); });
  it("assigns mileage boundaries and missing", () => { expect(mileageBucket(19_999)).toBe("M0-20K"); expect(mileageBucket(20_000)).toBe("M20-40K"); expect(mileageBucket(null)).toBe("M-NA"); });
  it("assigns age boundaries and missing", () => { expect(ageBucket(9.99)).toBe("AGE6-10"); expect(ageBucket(10)).toBe("AGE10-15"); expect(ageBucket(null)).toBe("AGE-NA"); });
  it("assigns COE boundaries and missing", () => { expect(coeBucket(1.99)).toBe("COE0-2"); expect(coeBucket(2)).toBe("COE2-5"); expect(coeBucket(null)).toBe("COE-NA"); });
});

describe("condition calculation", () => {
  const base = { maintenanceHistory: 5, tyreCondition: 4, chainSprocketCondition: 4, visibleRustCorrosion: 4, visibleDamage: 3, accidentDamageDisclosure: null, modifications: null };
  it("averages available evidence", () => expect(calculateCondition(base)).toMatchObject({ score: 4, group: "COND4" }));
  it("applies accident and modification penalties", () => expect(calculateCondition({ ...base, accidentDamageDisclosure: "Present", modifications: "Significant" })).toMatchObject({ score: 2.5, group: "COND3" }));
  it("does not manufacture average condition when evidence is missing", () => expect(calculateCondition({ ...base, maintenanceHistory: 4, tyreCondition: null, chainSprocketCondition: null, visibleRustCorrosion: null, visibleDamage: null })).toMatchObject({ score: null, group: "COND-NA" }));
});

describe("comparable logic", () => {
  it("does not include asking price in the comparable group id", () => {
    const low = buildComparableGroupId(listing({ askingPriceSgd: 1000 }));
    const high = buildComparableGroupId(listing({ askingPriceSgd: 9999 }));
    expect(low).toBe(high); expect(low).not.toContain("9999");
  });
  it("excludes the target and progressively relaxes filters", () => {
    const target = listing();
    const candidates = Array.from({ length: 6 }, (_, index) => listing({ id: `c${index}`, listingUrl: `https://example.test/${index}`, mileageKm: 20_000 + index * 1000, comparableGroupId: "" }));
    const result = findComparables(target, [target, ...candidates]);
    expect(result.comparables).toHaveLength(6); expect(result.comparables.some((item) => item.id === target.id)).toBe(false); expect(result.level).toBe(3); expect(result.filtersRelaxed).toContain("mileageBucket");
  });
  it("scores an exact model more highly", () => {
    const target = listing();
    expect(similarityScore(target, listing({ id: "exact" }))).toBeGreaterThan(similarityScore(target, listing({ id: "other", model: "Burgman 400", brand: "Yamaha" })));
  });
  it("removes obvious asking-price outliers", () => {
    const prices = [6000, 6200, 6300, 6500, 50_000];
    const filtered = removePriceOutliers(prices.map((askingPriceSgd, index) => ({ ...listing({ id: String(index), askingPriceSgd }), similarity: .8 })));
    expect(filtered.map((item) => item.askingPriceSgd)).not.toContain(50_000);
  });
  it("calculates a deterministic robust valuation", () => {
    const target = listing();
    const candidates = [6300, 6500, 6800, 7000, 7200, 7400].map((askingPriceSgd, index) => listing({ id: `v${index}`, listingUrl: `https://example.test/v${index}`, askingPriceSgd }));
    const result = calculateValuation(target, [target, ...candidates]);
    expect(result?.estimatedMid).toBeGreaterThanOrEqual(6500); expect(result?.estimatedMid).toBeLessThanOrEqual(7200); expect(result?.comparableCount).toBe(6);
  });
});

describe("confidence and deal assessment", () => {
  it("grades strong evidence high and sparse evidence low", () => {
    expect(calculateConfidence({ target: listing(), comparableCount: 9, searchLevel: 2, averageSimilarity: .85 })).toBe("high");
    expect(calculateConfidence({ target: listing({ mileageKm: null }), comparableCount: 3, searchLevel: 8, averageSimilarity: .4 })).toBe("low");
  });
  it("uses configurable price assessment boundaries", () => {
    expect(assessPrice(-15)).toBe("strong_deal"); expect(assessPrice(-5)).toBe("good_deal"); expect(assessPrice(5)).toBe("fairly_priced"); expect(assessPrice(31)).toBe("significantly_overpriced");
  });
  it("does not reward missing listing evidence as excellent", () => {
    const valuation = calculateValuation(listing(), Array.from({ length: 7 }, (_, i) => listing({ id: `d${i}`, listingUrl: `https://example.test/d${i}`, askingPriceSgd: 7000 + i * 100 })))!;
    const complete = calculateDealScore(listing(), valuation, .8);
    const missing = calculateDealScore(listing({ mileageKm: null, coeRemainingYears: null, conditionScore: null, evidenceCompleteness: null }), valuation, .8);
    expect(complete.score).toBeGreaterThan(missing.score);
  });
});

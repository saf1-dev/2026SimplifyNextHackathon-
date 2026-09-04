import { describe, expect, it } from "vitest";
import { parseSearchFallback, validateGroqIntent } from "../src/lib/groq/parse-search";

describe("Groq intent validation", () => {
  it("validates strict structured JSON", () => {
    const result = validateGroqIntent({ hard_filters: { engine_class: "2A", max_price_sgd: 8000 }, soft_preferences: { preferred_brands: ["Honda"], usage: "commuting", prefer_lower_mileage: true }, summary: "Class 2A commuter below S$8,000." });
    expect(result.hardFilters).toMatchObject({ engineClass: "2A", maxPriceSgd: 8000 }); expect(result.source).toBe("groq");
  });
  it("rejects invalid output", () => expect(() => validateGroqIntent({ hard_filters: { engine_class: "3" }, soft_preferences: {}, summary: "Invalid" })).toThrow());
  it("safely handles the acceptance query without an API key", () => {
    const result = parseSearchFallback("I need a Class 2A Japanese bike below $8k for commuting and don't want very high mileage.");
    expect(result.hardFilters).toMatchObject({ engineClass: "2A", maxPriceSgd: 8000 }); expect(result.softPreferences.preferredBrands).toEqual(["Honda", "Yamaha", "Suzuki", "Kawasaki"]); expect(result.softPreferences.preferLowerMileage).toBe(true);
  });
});

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { canonicalizeMarketplaceUrl, extractMarketplaceListing, sanitizeDescription } from "@motomoto/extraction";

describe("marketplace extraction", () => {
  it("extracts labelled SGBikeMart fields before AI", () => {
    const dom = new JSDOM(`<!doctype html><title>Yamaha Aerox 155 for sale</title><h1>Yamaha Aerox 155</h1><table><tr><th>Engine Capacity</th><td>155 cc</td></tr><tr><th>Price</th><td>S$6,800 full cash price</td></tr><tr><th>Mileage</th><td>12,500 km</td></tr><tr><th>COE Expiry</th><td>12/06/2031</td></tr></table><div class="description">Well maintained motorcycle. Full cash price S$6,800. WhatsApp 9123 4567.</div>`);
    const result = extractMarketplaceListing(dom.window.document, "https://sgbikemart.com.sg/usedbike/yamaha-aerox/12345?utm_source=test", "2026-09-06T00:00:00.000Z");
    expect(result.marketplace).toBe("SGBIKEMART");
    expect(result.brand).toBe("Yamaha");
    expect(result.model).toBe("Aerox 155");
    expect(result.engineCc).toBe(155);
    expect(result.askingPriceSgd).toBe(6800);
    expect(result.priceType).toBe("FULL_PRICE");
    expect(result.descriptionText).not.toContain("9123");
  });
  it("removes tracking parameters", () => expect(canonicalizeMarketplaceUrl("https://www.carousell.sg/p/bike-123456789?utm_source=x&foo=bar").canonicalUrl).toBe("https://carousell.sg/p/bike-123456789?foo=bar"));
  it("redacts contact details", () => expect(sanitizeDescription("Call me at 9123 4567 or a@b.com")).toBe("[contact removed] [phone removed] or [email removed]"));
});

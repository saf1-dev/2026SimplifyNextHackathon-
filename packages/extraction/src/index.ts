import {
  type EvidenceSource,
  type ExtractedDraft,
  type FieldEvidence,
  type Marketplace,
  type PriceType,
  engineClassFromCc,
} from "@motomoto/domain";

export const EXTRACTOR_VERSION = "motomoto-extractor-v2.0.0";

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "ref", "referrer", "source", "share", "shared_by", "session", "session_id",
  "fbclid", "gclid", "yclid", "sort", "tracking", "tracking_id",
]);

const KNOWN_BRANDS = ["Honda", "Yamaha", "Suzuki", "Kawasaki", "KTM", "BMW", "CFMoto", "Royal Enfield", "Triumph", "Ducati", "Vespa", "Aprilia", "Harley Davidson", "SYM"];

export function detectMarketplace(value: string): Marketplace {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "carousell.sg" || host === "carousell.app.link") return "CAROUSELL";
    if (host === "sgbikemart.com.sg") return "SGBIKEMART";
  } catch {
    return "UNKNOWN";
  }
  return "UNKNOWN";
}

export function supportsMarketplace(value: string): boolean {
  return detectMarketplace(value) !== "UNKNOWN";
}

export function canonicalizeMarketplaceUrl(value: string): { canonicalUrl: string | null; flags: string[] } {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    const flags = url.hostname === "carousell.app.link" ? ["SHORT_LINK_IDENTITY_UNRESOLVED"] : [];
    return { canonicalUrl: url.toString().replace(/\/$/, ""), flags };
  } catch {
    return { canonicalUrl: null, flags: ["INVALID_OR_MISSING_SOURCE_URL"] };
  }
}

export function sourceListingIdFromUrl(value: string, marketplace = detectMarketplace(value)): string | null {
  try {
    const url = new URL(value);
    if (marketplace === "SGBIKEMART") return url.pathname.match(/\/usedbike\/[^/]+\/(\d+)/i)?.[1] ?? null;
    if (marketplace === "CAROUSELL") return url.pathname.match(/(?:-|\/)(\d{8,})(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
  return null;
}

export function sanitizeDescription(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b/g, "[phone removed]")
    .replace(/\b(?:wa|whatsapp|telegram|contact|call|text|pm)\s*(?:me|us)?\s*(?:at|@|:)?(?=\s*(?:\[phone removed\]|\[email removed\]|[A-Za-z0-9_.+-]{3,}))/gi, "[contact removed] ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8_000);
}

export function classifyPriceType(text: string): PriceType {
  const lower = text.toLowerCase();
  if (/\b(?:down\s*payment|deposit)\b/.test(lower)) return "DOWNPAYMENT";
  if (/\b(?:per month|monthly installment|monthly instalment|\/\s*mth|\/\s*month)\b/.test(lower)) return "MONTHLY_INSTALLMENT";
  if (/\b(?:total installment price|total instalment price)\b/.test(lower)) return "TOTAL_INSTALLMENT_PRICE";
  if (/\b(?:full price|full cash|cash price|nett price)\b/.test(lower)) return "FULL_PRICE";
  return "UNKNOWN";
}

function parseNumber(value: string | null): number | null {
  if (!value || /^(?:-|na|n\/a|unknown)$/i.test(value.trim())) return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const dmy = value.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function yearsBetween(capturedAt: string, date: string | null, reverse = false): number | null {
  if (!date) return null;
  const capture = new Date(capturedAt).valueOf();
  const other = new Date(`${date}T00:00:00Z`).valueOf();
  const years = (reverse ? other - capture : capture - other) / (365.25 * 86_400_000);
  return Math.round(years * 100) / 100;
}

function meta(document: Document, property: string): string | null {
  return document.querySelector(`meta[property="${property}"],meta[name="${property}"]`)?.getAttribute("content")?.trim() || null;
}

function evidence(field: string, value: unknown, source: EvidenceSource, confidence: number, snippet: string | null, observedAt: string): FieldEvidence {
  return { field, value: value ?? null, source, confidence, evidenceSnippet: snippet?.slice(0, 500) ?? null, userConfirmed: false, observedAt };
}

function jsonLdObjects(document: Document): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed: unknown = JSON.parse(node.textContent || "null");
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (value && typeof value === "object") {
          const graph = (value as { "@graph"?: unknown[] })["@graph"];
          if (Array.isArray(graph)) output.push(...graph.filter((item): item is Record<string, unknown> => !!item && typeof item === "object"));
          else output.push(value as Record<string, unknown>);
        }
      }
    } catch {
      // Invalid third-party structured data is ignored.
    }
  }
  return output;
}

function findJsonLdProduct(document: Document): Record<string, unknown> | null {
  return jsonLdObjects(document).find((item) => {
    const type = item["@type"];
    return type === "Product" || type === "Vehicle" || (Array.isArray(type) && type.some((t) => t === "Product" || t === "Vehicle"));
  }) ?? null;
}

function labelledValues(document: Document): Map<string, string> {
  const values = new Map<string, string>();
  const add = (label: string | null | undefined, value: string | null | undefined) => {
    const key = label?.replace(/\s+/g, " ").trim().toLowerCase();
    const clean = value?.replace(/\s+/g, " ").trim();
    if (key && clean && key.length <= 80 && clean.length <= 1_000) values.set(key, clean);
  };
  for (const row of document.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("th,td");
    if (cells.length >= 2) add(cells[0]?.textContent, cells[1]?.textContent);
  }
  for (const dt of document.querySelectorAll("dt")) add(dt.textContent, dt.nextElementSibling?.textContent);
  for (const element of document.querySelectorAll("[data-testid],[aria-label]")) {
    const label = element.getAttribute("aria-label") || element.getAttribute("data-testid");
    if (label) add(label, element.textContent);
  }
  return values;
}

function findLabel(map: Map<string, string>, ...labels: string[]): string | null {
  for (const [key, value] of map) {
    if (labels.some((label) => key === label || key.includes(label))) return value;
  }
  return null;
}

function inferBrand(title: string, explicit: string | null): string | null {
  if (explicit) return explicit.replace(/^brand\s*:?/i, "").trim();
  return KNOWN_BRANDS.find((brand) => title.toLowerCase().includes(brand.toLowerCase())) ?? null;
}

function inferModel(title: string, brand: string | null, explicit: string | null): string | null {
  if (explicit) return explicit.replace(/^model\s*:?/i, "").trim().replace(new RegExp(`^${brand ?? ""}\\s+`, "i"), "");
  if (!brand) return null;
  const after = title.slice(title.toLowerCase().indexOf(brand.toLowerCase()) + brand.length).trim();
  return after.split(/\s+(?:for sale|motorcycle|used|coe|\||-|,)/i)[0]?.trim() || null;
}

function extractDescription(document: Document): string {
  const selectors = [
    '[data-testid*="description" i]',
    '[class*="description" i]',
    'meta[name="description"]',
    'meta[property="og:description"]',
  ];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const raw = element?.tagName === "META" ? element.getAttribute("content") : element?.textContent;
    if (raw?.trim() && raw.trim().length > 20) return sanitizeDescription(raw);
  }
  return "";
}

function sharedExtraction(document: Document, pageUrl: string, marketplace: Marketplace, capturedAt: string): ExtractedDraft {
  const labels = labelledValues(document);
  const product = findJsonLdProduct(document);
  const title = String(product?.name ?? meta(document, "og:title") ?? document.querySelector("h1,h2")?.textContent ?? document.title ?? "").trim();
  const offers = product?.offers && typeof product.offers === "object" ? product.offers as Record<string, unknown> : null;
  const description = sanitizeDescription(String(product?.description ?? extractDescription(document) ?? ""));
  const explicitBrand = typeof product?.brand === "string" ? product.brand : typeof product?.brand === "object" && product.brand ? String((product.brand as Record<string, unknown>).name ?? "") : findLabel(labels, "brand", "make");
  const brand = inferBrand(title, explicitBrand || null);
  const model = inferModel(title, brand, findLabel(labels, "model", "bike model"));
  const engineText = findLabel(labels, "engine capacity", "engine cc", "capacity");
  const engineCc = parseNumber(engineText);
  const classText = findLabel(labels, "classification", "engine class", "class");
  const engineClass = classText?.match(/\b(2B|2A|2)\b/i)?.[1]?.toUpperCase() as "2B" | "2A" | "2" | undefined;
  const priceText = String(offers?.price ?? findLabel(labels, "price", "asking price") ?? meta(document, "product:price:amount") ?? document.querySelector('[itemprop="price"]')?.getAttribute("content") ?? document.querySelector('[class*="price" i]')?.textContent ?? "");
  const askingPriceSgd = parseNumber(priceText);
  const registrationText = findLabel(labels, "registration date", "reg date", "registration");
  const coeText = findLabel(labels, "coe expiry date", "coe expiry", "coe");
  const registrationDate = toIsoDate(registrationText);
  const coeExpiry = toIsoDate(coeText);
  const mileageText = findLabel(labels, "mileage");
  const ownersText = findLabel(labels, "no. of owners", "number of owners", "owners");
  const location = findLabel(labels, "location");
  const combinedPriceText = `${priceText} ${description}`;
  const priceType = classifyPriceType(combinedPriceText);
  const canonical = canonicalizeMarketplaceUrl(pageUrl);
  const extractionEvidence: FieldEvidence[] = [];
  const source: EvidenceSource = product ? "MARKETPLACE_JSON_LD" : "MARKETPLACE_DOM";
  const add = (field: string, value: unknown, snippet: string | null, confidence = product ? 0.98 : 0.94) => {
    if (value !== null && value !== undefined && value !== "") extractionEvidence.push(evidence(field, value, source, confidence, snippet, capturedAt));
  };
  add("brand", brand, explicitBrand || title);
  add("model", model, findLabel(labels, "model", "bike model") || title);
  add("engineCc", engineCc, engineText);
  add("engineClass", engineClass ?? engineClassFromCc(engineCc), classText || engineText, classText ? 0.98 : 0.75);
  add("askingPriceSgd", askingPriceSgd, priceText);
  if (priceType !== "UNKNOWN") add("priceType", priceType, combinedPriceText, 0.9);
  add("mileageKm", parseNumber(mileageText), mileageText);
  add("registrationDate", registrationDate, registrationText);
  add("coeExpiry", coeExpiry, coeText);
  add("numberOfOwners", parseNumber(ownersText), ownersText);
  add("location", location, location);
  return {
    marketplace,
    sourceListingId: sourceListingIdFromUrl(pageUrl, marketplace),
    originalUrl: pageUrl,
    canonicalUrl: canonical.canonicalUrl,
    listingStatus: /\bsold\b/i.test(document.body?.textContent ?? "") ? "SOLD" : "AVAILABLE",
    brand,
    model,
    engineCc: engineCc === null ? null : Math.round(engineCc),
    engineClass: engineClass ?? engineClassFromCc(engineCc),
    askingPriceSgd,
    priceType,
    mileageKm: parseNumber(mileageText),
    registrationDate,
    ageYears: yearsBetween(capturedAt, registrationDate),
    coeExpiry,
    coeRemainingYears: yearsBetween(capturedAt, coeExpiry, true),
    roadTaxExpiry: null,
    numberOfOwners: parseNumber(ownersText),
    location,
    paymentOption: /\b(?:loan|finance|installment|instalment)\b/i.test(description) ? "Financing mentioned" : null,
    sellerType: /\bdirect seller\b/i.test(document.body?.textContent ?? "") ? "DIRECT_OWNER" : /\b(?:dealer|company|pte ltd)\b/i.test(document.body?.textContent ?? "") ? "DEALER" : "UNKNOWN",
    maintenanceSummary: null,
    accidentDisclosure: null,
    modifications: null,
    modificationImpact: /\b(?:stock|no modifications?)\b/i.test(description) ? "STOCK_NONE" : "UNKNOWN",
    descriptionText: description || null,
    redFlags: [],
    conditionEvidence: [],
    conditionScore: null,
    conditionGroup: "COND-NA",
    capturedAt,
    extractionEvidence,
    dataQualityFlags: canonical.flags,
    ingestionSource: "EXTENSION",
    extractorVersion: EXTRACTOR_VERSION,
    deterministicFieldCount: extractionEvidence.length,
  };
}

export interface MarketplaceExtractor {
  marketplace: Marketplace;
  supports(url: string): boolean;
  extract(document: Document, url: string, capturedAt?: string): ExtractedDraft;
}

export const CarousellExtractor: MarketplaceExtractor = {
  marketplace: "CAROUSELL",
  supports: (url) => detectMarketplace(url) === "CAROUSELL",
  extract(document, url, capturedAt = new Date().toISOString()) {
    return sharedExtraction(document, url, "CAROUSELL", capturedAt);
  },
};

export const SGBikeMartExtractor: MarketplaceExtractor = {
  marketplace: "SGBIKEMART",
  supports: (url) => detectMarketplace(url) === "SGBIKEMART",
  extract(document, url, capturedAt = new Date().toISOString()) {
    return sharedExtraction(document, url, "SGBIKEMART", capturedAt);
  },
};

export function extractMarketplaceListing(document: Document, url: string, capturedAt = new Date().toISOString()): ExtractedDraft {
  const extractor = [CarousellExtractor, SGBikeMartExtractor].find((candidate) => candidate.supports(url));
  if (!extractor) throw new Error("UNSUPPORTED_MARKETPLACE");
  return extractor.extract(document, url, capturedAt);
}

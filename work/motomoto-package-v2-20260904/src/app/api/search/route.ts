import { NextResponse } from "next/server";
import { z } from "zod";
import { getListings } from "@/lib/database/motorcycles";
import { applyManualOverrides, parseSearchIntent } from "@/lib/groq/parse-search";
import { searchListings } from "@/lib/motorcycles/search";

export const runtime = "nodejs";

const requestSchema = z.object({
  query: z.string().max(1000).default(""),
  filters: z.object({
    engineClass: z.enum(["2B", "2A", "2"]).optional(), brands: z.array(z.string()).optional(),
    maxPriceSgd: z.number().positive().optional(), minCoeYears: z.number().nonnegative().optional(), maxMileageKm: z.number().positive().optional(),
    minEngineCc: z.number().nonnegative().optional(), maxEngineCc: z.number().positive().optional(), minAgeYears: z.number().nonnegative().optional(), maxAgeYears: z.number().positive().optional(),
  }).default({}),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const parsed = await parseSearchIntent(body.query);
    const intent = applyManualOverrides(parsed, body.filters);
    const listings = await getListings();
    const results = searchListings(listings, intent);
    console.info("motorcycle_search", { intent, matched: results.length, comparableLevels: results.map((r) => r.valuation?.searchLevel ?? null) });
    return NextResponse.json({ interpretedRequest: intent, resultCount: results.length, results });
  } catch (error) {
    console.error("search_error", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "We couldn't complete that search. Please check the filters and try again." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getListing, getListings } from "@/lib/database/motorcycles";
import { explainValuation } from "@/lib/groq/explain-valuation";
import { getValuation } from "@/lib/motorcycles/valuation-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, listings] = await Promise.all([getListing(id), getListings()]);
  if (!listing) return NextResponse.json({ error: "Motorcycle not found." }, { status: 404 });
  const valuation = getValuation(listing, listings);
  if (!valuation) return NextResponse.json({ error: "Not enough comparable listing data to provide a reliable valuation." }, { status: 422 });
  return NextResponse.json({ valuation, explanation: await explainValuation(listing, valuation) });
}

import { NextResponse } from "next/server";
import { getListing, getListings } from "@/lib/database/motorcycles";
import { getValuation } from "@/lib/motorcycles/valuation-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, listings] = await Promise.all([getListing(id), getListings()]);
  if (!listing) return NextResponse.json({ error: "Motorcycle not found." }, { status: 404 });
  const valuation = getValuation(listing, listings);
  return NextResponse.json({ searchLevel: valuation?.searchLevel ?? null, filtersRelaxed: valuation?.filtersRelaxed ?? [], comparables: valuation?.comparables ?? [] });
}

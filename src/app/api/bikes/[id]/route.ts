import { NextResponse } from "next/server";
import { getListing } from "@/lib/database/motorcycles";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);
  return listing ? NextResponse.json(listing) : NextResponse.json({ error: "Motorcycle not found." }, { status: 404 });
}

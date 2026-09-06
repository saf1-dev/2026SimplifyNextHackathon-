import { NextResponse } from "next/server";
import { getRepository } from "@motomoto/data-access";
import { parseSearchIntent } from "@motomoto/groq";
import { searchListings } from "@motomoto/valuation";
export async function GET(request:Request){try{const q=new URL(request.url).searchParams.get("q")??"";const intent=await parseSearchIntent(q);const results=searchListings(await getRepository().list(),intent).slice(0,30);return NextResponse.json({intent,results,total:results.length});}catch(error){return NextResponse.json({error:"SEARCH_FAILED",message:error instanceof Error?error.message:"Search failed"},{status:400});}}

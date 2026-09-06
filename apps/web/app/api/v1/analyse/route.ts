import { NextResponse } from "next/server";
import { AnalyseRequestSchema } from "@motomoto/domain";
import { getRepository } from "@motomoto/data-access";
import { valueListing } from "@motomoto/valuation";
export async function POST(request: Request){
  try{const input=AnalyseRequestSchema.parse(await request.json());const repository=getRepository();const saved=await repository.save(input);let valuation;try{valuation=valueListing(saved.listing,await repository.list());}catch{valuation=null;}return NextResponse.json({ingested:true,...saved,valuation,message:valuation?.confidence==="INSUFFICIENT"||!valuation?"Listing added to MotoMoto, but there is not enough comparable evidence yet for a responsible valuation.":"Listing added and compared against independent MotoMoto evidence."});}
  catch(error){return NextResponse.json({error:"INVALID_ANALYSE_REQUEST",message:error instanceof Error?error.message:"Invalid request"},{status:400});}
}

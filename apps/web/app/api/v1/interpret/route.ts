import { NextResponse } from "next/server";
import { InterpretRequestSchema } from "@motomoto/domain";
import { interpretDraft } from "@motomoto/groq";
export async function POST(request: Request){try{return NextResponse.json(await interpretDraft(InterpretRequestSchema.parse(await request.json()).draft));}catch(error){return NextResponse.json({error:"INVALID_INTERPRET_REQUEST",message:error instanceof Error?error.message:"Invalid request"},{status:400});}}

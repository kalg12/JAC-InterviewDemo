import { NextRequest, NextResponse } from "next/server";
import { submitAnswer } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await submitAnswer(body.participantId ?? "", body.optionId ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la respuesta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { joinParticipant } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const participant = await joinParticipant(body.name ?? "");
    return NextResponse.json({ participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el participante.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

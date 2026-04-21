import { NextRequest, NextResponse } from "next/server";
import { getParticipantResultSummary } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  try {
    const participantId = request.nextUrl.searchParams.get("participantId") ?? "";
    const result = await getParticipantResultSummary(participantId);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar los resultados.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

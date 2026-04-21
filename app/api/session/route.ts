import { NextRequest, NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  try {
    const participantId = request.nextUrl.searchParams.get("participantId") ?? undefined;
    const payload = await getSessionPayload(participantId);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la sesion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

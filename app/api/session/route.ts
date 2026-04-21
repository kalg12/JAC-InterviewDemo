import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/session-store";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la sesion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

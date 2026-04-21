import { NextRequest, NextResponse } from "next/server";
import { controlSession } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as "next" | "reveal" | "reset" | "end";
    const session = await controlSession(action);
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo controlar la sesion.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

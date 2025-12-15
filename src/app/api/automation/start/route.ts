import { NextRequest, NextResponse } from "next/server";
import { startAutomation } from "../../../lib/start";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, scriptName } = body;

    if (!user) {
      return NextResponse.json({ error: "User and name are required" }, { status: 400 });
    }

    const result = await startAutomation(user, scriptName);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

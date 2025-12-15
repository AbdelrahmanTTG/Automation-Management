import { NextRequest, NextResponse } from "next/server";
import { statusAutomation } from "../../../lib/status";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user } = body;

    if (!user || !user.id || !user.name) {
      return NextResponse.json(
        { error: "User name and id are required" },
        { status: 400 }
      );
    }

    const result = await statusAutomation(user);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import pako from "pako";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/^\/+/, "");

  const publicPaths = ["login", "unauthorized"];
  const publicExtensions = [".png", ".jpg", ".jpeg", ".svg", ".gif", ".css", ".js", ".ico"];

  if (
    publicPaths.includes(pathname) ||
    publicExtensions.some(ext => pathname.endsWith(ext))
  ) {
    return NextResponse.next();
  }

  const tokenName = process.env.ACCESS_TOKEN_NAME;
  const token = request.cookies.get(tokenName!)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const apiUrl = process.env.API_BASE_URL;
  const res = await fetch(`${apiUrl}/api/perm`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const resData = await res.json();

  let dataArray: any[] = [];

  try {
    if (resData.data && typeof resData.data === "string") {
      const compressedBase64 = resData.data;
      const compressed = Uint8Array.from(atob(compressedBase64), c => c.charCodeAt(0));
      const decompressed = pako.inflate(compressed, { to: "string" });
      dataArray = JSON.parse(decompressed);
    } else if (Array.isArray(resData.data)) {
      dataArray = resData.data;
    }
  } catch (err) {
    console.error("Failed to decompress API response:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowedRoutes: string[] = dataArray.map((r: any) => r.url);

  if (!allowedRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|assets/|login|unauthorized).*)",
  ],
};


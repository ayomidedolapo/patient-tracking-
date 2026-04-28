// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookie, ADMIN_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 1. Find out which URL the frontend is making the request from
  const referer = req.headers.get("referer") || "";
  
  let user = null;

  // 2. If the request comes from the Admin portal, strictly check the admin token
  if (referer.includes("/admin")) {
    user = await getCurrentUserFromCookie(ADMIN_COOKIE_NAME);
  } 
  // 3. Otherwise, it comes from the Staff/Patient portal, so strictly check the auth token
  else {
    user = await getCurrentUserFromCookie(AUTH_COOKIE_NAME);
  }

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true, data: user });
}
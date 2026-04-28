// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear the cookie
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}

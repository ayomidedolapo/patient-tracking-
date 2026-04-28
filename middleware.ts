// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if accessing admin routes
  if (pathname.startsWith("/admin")) {
    // Check for admin_token cookie
    const adminToken = request.cookies.get("admin_token")?.value;
    
    // Allow access to admin login page without token
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }
    
    // Redirect to admin login if no admin_token
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    
    return NextResponse.next();
  }
  
  // Check if accessing staff routes (non-admin)
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/staff")) {
    // Check for auth_token cookie (staff)
    const staffToken = request.cookies.get("auth_token")?.value;
    
    if (!staffToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/staff/:path*"],
};
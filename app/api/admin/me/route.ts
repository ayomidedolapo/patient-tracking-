// app/api/admin/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Must match the cookie name used in admin-login route
const ADMIN_COOKIE_NAME = "admin_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

type JwtPayload = {
  userId: number;
  role: Role;
};

export async function GET(request: NextRequest) {
  try {
    // Get token from request cookies (NextRequest has cookies API)
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

    // Debug logging (check your server console)
    console.log("Admin/me - Token found:", !!token);
    console.log("Admin/me - All cookies:", request.cookies.getAll().map(c => c.name));

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - No admin token found" },
        { status: 401 }
      );
    }

    // Verify the token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      console.log("Admin/me - Decoded:", { userId: decoded.userId, role: decoded.role });
    } catch (jwtError) {
      console.error("Admin/me - JWT verification failed:", jwtError);
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check if user has admin role (case-insensitive)
    const userRole = decoded.role?.toUpperCase();
    if (userRole !== "ADMIN") {
      console.log("Admin/me - Forbidden. Role:", decoded.role);
      return NextResponse.json(
        { success: false, error: `Forbidden - Admin access required (role: ${decoded.role})` },
        { status: 403 }
      );
    }

    // Fetch full user details from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        staffId: true,
        phone: true,
        department: true,
        shift: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is deactivated" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.error("Admin me error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
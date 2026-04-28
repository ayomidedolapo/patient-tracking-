// app/api/auth/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAuthToken } from "@/lib/auth";

const AUTH_COOKIE_NAME = "auth_token";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { email, password, staffId, portal } = body as {
      email?: string;
      password?: string;
      staffId?: string;
      portal?: string;
    };

    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedStaffId = staffId?.trim().toUpperCase();
    const normalizedPortal = portal?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Admin bypass - no staffId required for ADMIN role
    const isAdmin = user.role === "ADMIN";
    
    // Staff ID required for non-admin staff roles (DOCTOR, NURSE, THERAPIST)
    if (!isAdmin && !normalizedStaffId) {
      return NextResponse.json(
        { success: false, error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify staff ID matches (for non-admin staff roles only)
    if (!isAdmin && user.role !== "PATIENT" && user.staffId !== normalizedStaffId) {
      return NextResponse.json(
        { success: false, error: "Invalid Staff ID" },
        { status: 401 }
      );
    }

    // Admin portal protection
    if (normalizedPortal === "admin" && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to access the admin dashboard",
        },
        { status: 403 }
      );
    }

    const token = signAuthToken({
      id: user.id,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        staffId: user.staffId,
        role: user.role,
      },
    });

    // FIX: Use different cookie paths for admin vs staff/patient
    // Admin cookie only valid for /admin paths
    // Staff/Patient cookie valid for all paths (they need access everywhere)
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",  // FIX: Changed from `isAdmin ? "/admin" : "/"` to always be "/"
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
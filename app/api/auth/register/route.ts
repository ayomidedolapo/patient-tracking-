import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { signAuthToken } from "@/lib/auth";

const AUTH_COOKIE_NAME = "auth_token";

// Generate unique staff ID based on role and year
async function generateStaffId(role: Role): Promise<string | null> {
  if (role === "PATIENT") {
    return null;
  }

  const prefix = {
    ADMIN: "ADM",
    DOCTOR: "DOC",
    NURSE: "NUR",
    THERAPIST: "THR",
  }[role];

  if (!prefix) {
    return null;
  }

  const year = new Date().getFullYear();

  const count = await prisma.user.count({
    where: {
      role,
      staffId: { startsWith: `${prefix}-${year}` },
    },
  });

  const sequence = (count + 1).toString().padStart(3, "0");
  return `${prefix}-${year}-${sequence}`;
}

// ==================== GET: List all staff (non-patients) ====================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pageSize = parseInt(searchParams.get("pageSize") || "1000");

    console.log("📥 GET /api/auth/register - Fetching staff list");

    const users = await prisma.user.findMany({
      where: {
        role: { not: "PATIENT" }, // Exclude patients, get only staff
      },
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        staffId: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        shift: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    console.log(`✅ Found ${users.length} staff members`);

    return NextResponse.json({
      success: true,
      data: users, // Return flat array, not nested
    });
  } catch (error: unknown) {
    console.error("💥 GET /api/auth/register error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch staff", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ==================== POST: Register new staff (your existing code) ====================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      email,
      password,
      fullName,
      role,
      staffId: providedStaffId,
      department,
      shift,
      phone,
    } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: Role;
      staffId?: string;
      department?: string;
      shift?: string;
      phone?: string;
    };

    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const allowedRoles: Role[] = [
      Role.ADMIN,
      Role.DOCTOR,
      Role.NURSE,
      Role.THERAPIST,
      Role.PATIENT,
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "Email already in use" },
        { status: 409 }
      );
    }

    let finalStaffId: string | null = null;

    if (role !== Role.PATIENT) {
      if (providedStaffId?.trim()) {
        const trimmedStaffId = providedStaffId.trim();

        const existingStaffId = await prisma.user.findUnique({
          where: { staffId: trimmedStaffId },
        });

        if (existingStaffId) {
          return NextResponse.json(
            { success: false, error: "Staff ID already in use" },
            { status: 409 }
          );
        }

        finalStaffId = trimmedStaffId;
      } else {
        finalStaffId = await generateStaffId(role);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        staffId: finalStaffId,
        role,
        department: department?.trim() || null,
        shift: shift?.trim() || null,
        phone: phone?.trim() || null,
        isActive: true, // Default to active
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        staffId: true,
        role: true,
        department: true,
        shift: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Check if request is from admin creating new staff
    const authHeader = req.headers.get("authorization");
    const isAdminCreatingStaff = authHeader || req.cookies.get(AUTH_COOKIE_NAME);
    
    const res = NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );

    // Only set cookie for PATIENT role or if no existing session
    if (role === Role.PATIENT || !isAdminCreatingStaff) {
      const token = signAuthToken({ id: user.id, role: user.role });
      res.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return res;
  } catch (error: unknown) {
    console.error("💥 POST /api/auth/register error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ==================== PATCH: Update staff status ====================
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0");
    const body = await req.json() as { isActive?: boolean }; // Type assertion for body
    const { isActive } = body;

    console.log(`📝 PATCH /api/auth/register - ID: ${id}, isActive: ${isActive}`);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        staffId: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        shift: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    console.log("✅ Staff updated:", updated.id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("💥 PATCH /api/auth/register error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update staff", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { Role } from "@prisma/client";

// GET /api/staff-assignments - List assignments
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const staffIdParam = searchParams.get("staffId");
    const patientIdParam = searchParams.get("patientId");
    const roleParam = searchParams.get("role");

    const where: {
      staffId?: number;
      patientId?: number;
      role?: Role;
      OR?: Array<{
        staffId?: number;
        patient?: {
          staffAssignments: {
            some: { staffId: number };
          };
        };
      }>;
    } = {};

    // Role-based access
    if (user.role !== Role.ADMIN) {
      // Staff can only see their own assignments or assignments for their patients
      where.OR = [
        { staffId: user.id },
        {
          patient: {
            staffAssignments: {
              some: { staffId: user.id }
            }
          }
        },
      ];
    }

    if (staffIdParam) where.staffId = parseInt(staffIdParam, 10);
    if (patientIdParam) where.patientId = parseInt(patientIdParam, 10);
    if (roleParam) where.role = roleParam as Role;

    const assignments = await prisma.staffAssignment.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
            department: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            roomNumber: true,
            bedNumber: true,
            vitalStatus: true,
            isActive: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: assignments,
    });
  } catch (error: unknown) {
    console.error("Staff assignments fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json() as {
      staffId: number;
      patientId: number;
      role: Role;
      isPrimary?: boolean;
    };
    const { staffId, patientId, role, isPrimary = false } = body;

    if (!staffId || !patientId || !role) {
      return NextResponse.json(
        { success: false, error: "staffId, patientId, and role are required" },
        { status: 400 }
      );
    }

    const canAssign =
      user.role === Role.ADMIN ||
      (await prisma.staffAssignment.findFirst({
        where: {
          patientId: patientId,
          staffId: user.id,
          isPrimary: true,
        },
      }));

    if (!canAssign) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission denied. Only admin or primary staff can assign.",
        },
        { status: 403 }
      );
    }

    const staff = await prisma.user.findFirst({
      where: {
        id: staffId,
        role: { in: [Role.DOCTOR, Role.NURSE, Role.THERAPIST, Role.ADMIN] },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Staff not found or invalid role" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.staffAssignment.findUnique({
      where: {
        staffId_patientId: {
          staffId: staffId,
          patientId: patientId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Assignment already exists" },
        { status: 409 }
      );
    }

    if (isPrimary) {
      await prisma.staffAssignment.updateMany({
        where: {
          patientId: patientId,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const assignment = await prisma.staffAssignment.create({
      data: {
        staffId: staffId,
        patientId: patientId,
        role,
        isPrimary,
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
            department: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: assignment,
        message: "Staff assigned successfully",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Staff assignment creation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create assignment" },
      { status: 500 }
    );
  }
}

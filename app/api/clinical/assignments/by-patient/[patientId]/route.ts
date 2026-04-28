import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// GET /api/staff-assignments/by-patient/[patientId] - Get assigned staff for a patient
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const patientId = parseInt(params.patientId);

    // Check access
    const hasAccess = user.role === "ADMIN" || await prisma.staffAssignment.findFirst({
      where: {
        patientId,
        staffId: user.id,
      },
    }) || await prisma.patient.findFirst({
      where: {
        id: patientId,
        userId: user.id, // Patient viewing their own record
      },
    });

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const assignments = await prisma.staffAssignment.findMany({
      where: { patientId },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
            department: true,
            email: true,
            shift: true,
          },
        },
      },
      orderBy: [
        { isPrimary: "desc" },
        { assignedAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    console.error("Patient staff fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assigned staff" },
      { status: 500 }
    );
  }
}
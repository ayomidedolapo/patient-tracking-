import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTokenFromCookie, AUTH_COOKIE_NAME } from "@/lib/auth";
import { Role, AppointmentStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = verifyTokenFromCookie(req);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const allowedRoles = [Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.THERAPIST] as const;
    if (!allowedRoles.includes(user.role as 'ADMIN' | 'DOCTOR' | 'NURSE' | 'THERAPIST')) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Inferring types for body properties.
    const body = await req.json() as {
      patientId?: number;
      staffUserId?: number;
      appointmentDateTime?: string;
      reason?: string;
    };

    const { patientId, staffUserId, appointmentDateTime, reason } = body;

    if (!patientId || !appointmentDateTime) {
      return NextResponse.json(
        { success: false, error: "patientId and appointmentDateTime are required" },
        { status: 400 }
      );
    }

    const dt = new Date(appointmentDateTime);
    if (Number.isNaN(dt.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid appointmentDateTime" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    let finalStaffId: number;

    if (user.role === Role.ADMIN) {
      finalStaffId = staffUserId ?? user.id;
    } else {
      finalStaffId = user.id;

      if (staffUserId !== undefined && staffUserId !== user.id) {
        return NextResponse.json(
          { success: false, error: "You can only create appointments assigned to yourself" },
          { status: 403 }
        );
      }
    }

    const staff = await prisma.user.findUnique({
      where: { id: finalStaffId },
      select: { id: true, role: true },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Staff user not found" },
        { status: 404 }
      );
    }

    if (staff.role === Role.PATIENT) {
      return NextResponse.json(
        { success: false, error: "Appointments must be assigned to staff, not a patient" },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        staffUserId: finalStaffId,
        appointmentDateTime: dt,
        reason: reason?.trim() ? reason.trim() : null,
        status: AppointmentStatus.SCHEDULED,
      },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: appointment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create appointment error:", error);
    // Type assertion for error to access .message property safely
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = verifyTokenFromCookie(req);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const patientIdFilter = searchParams.get("patientId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const safePage = page > 0 ? page : 1;
    const safePageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 10;

    // Using a more specific type for whereClause instead of Record<string, any>
    const whereClause: {
      patientId?: number;
      staffUserId?: number;
    } = {};

    if (user.role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!patient) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: {
            total: 0,
            page: safePage,
            pageSize: safePageSize,
            totalPages: 0,
          },
        });
      }

      whereClause.patientId = patient.id;
    } else if (user.role === Role.ADMIN) {
      if (patientIdFilter) {
        const pid = parseInt(patientIdFilter, 10);
        if (!Number.isNaN(pid)) {
          whereClause.patientId = pid;
        }
      }
    } else if (
      user.role === Role.DOCTOR ||
      user.role === Role.NURSE ||
      user.role === Role.THERAPIST
    ) {
      whereClause.staffUserId = user.id;

      if (patientIdFilter) {
        const pid = parseInt(patientIdFilter, 10);
        if (!Number.isNaN(pid)) {
          whereClause.patientId = pid;
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const total = await prisma.appointment.count({
      where: whereClause,
    });

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      orderBy: { appointmentDateTime: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(total / safePageSize);

    return NextResponse.json({
      success: true,
      data: appointments,
      meta: {
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

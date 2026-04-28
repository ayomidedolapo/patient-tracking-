// app/api/patients/[id]/discharge-summaries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// POST /api/patients/:id/discharge-summaries → create summary
// ADMIN, DOCTOR only
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole([Role.ADMIN, Role.DOCTOR]);

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid patient id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { admissionDate, dischargeDate, summary, followUpPlan } = body as {
      admissionDate?: string;
      dischargeDate?: string;
      summary?: string;
      followUpPlan?: string;
    };

    if (!dischargeDate || !summary?.trim()) {
      return NextResponse.json(
        { success: false, error: "dischargeDate and summary are required" },
        { status: 400 }
      );
    }

    const discharge = new Date(dischargeDate);
    if (Number.isNaN(discharge.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid dischargeDate" },
        { status: 400 }
      );
    }

    let admission: Date | null = null;
    if (admissionDate) {
      const d = new Date(admissionDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid admissionDate" },
          { status: 400 }
        );
      }
      admission = d;
    }

    const patientExists = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!patientExists) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    const dischargeSummary = await prisma.dischargeSummary.create({
      data: {
        patientId,
        createdByUserId: user.id,
        admissionDate: admission,
        dischargeDate: discharge,
        summary: summary.trim(),
        followUpPlan: followUpPlan?.trim() || null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
            userId: true,
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: dischargeSummary },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (error?.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    console.error("Create discharge summary error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/patients/:id/discharge-summaries → list summaries
// ADMIN/DOCTOR/NURSE can view
// THERAPIST cannot view
// PATIENT can view only their own
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid patient id" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const requestedPageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const pageSize =
      requestedPageSize > 0 && requestedPageSize <= 100 ? requestedPageSize : 10;
    const skip = (page - 1) * pageSize;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    if (user.role === Role.PATIENT) {
      if (!patient.userId || patient.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Not authorized to view this record" },
          { status: 403 }
        );
      }
    } else {
      const allowedStaff: Role[] = [Role.ADMIN, Role.DOCTOR, Role.NURSE];

      if (!allowedStaff.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: "Not authorized" },
          { status: 403 }
        );
      }
    }

    const [total, dischargeSummaries] = await Promise.all([
      prisma.dischargeSummary.count({
        where: { patientId },
      }),
      prisma.dischargeSummary.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          patient: {
            select: {
              id: true,
              patientCode: true,
              firstName: true,
              lastName: true,
              userId: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: dischargeSummaries,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get discharge summaries error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
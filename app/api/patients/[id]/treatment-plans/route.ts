import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Role, TreatmentStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isStaff = (role: Role) => [Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.THERAPIST].includes(role as 'ADMIN' | 'DOCTOR' | 'NURSE' | 'THERAPIST');

// GET /api/patients/:id/treatment-plans
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient ID" }, { status: 400 });
    }

    // Check permissions
    if (user.role === Role.PATIENT) {
      const patient = await prisma.patient.findFirst({
        where: { userId: user.id },
        select: { id: true }
      });
      if (!patient || patient.id !== patientId) {
        return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
      }
    }

    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
            bedNumber: true,
            roomNumber: true,
            vitalStatus: true,
          },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true, staffId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error: any) {
    console.error("GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/patients/:id/treatment-plans
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient ID" }, { status: 400 });
    }

    const body = await req.json();
    
    // Accept both old and new field names
    const description = body.description || body.title;
    const startDate = body.startDate;

    if (!description?.trim()) {
      return NextResponse.json(
        { success: false, error: "Description is required" },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: "Start date is required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid start date" }, { status: 400 });
    }

    let end = null;
    if (body.endDate) {
      end = new Date(body.endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid end date" }, { status: 400 });
      }
      if (end < start) {
        return NextResponse.json({ success: false, error: "End date cannot be before start date" }, { status: 400 });
      }
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true }
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    }

    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId: patientId,
        title: body.title || null,
        description: description.trim(),
        startDate: start,
        endDate: end,
        status: body.status || "ACTIVE",
        priority: body.priority || "NORMAL",
        createdByUserId: user.id,
      },
      include: {
        patient: {
          select: { id: true, patientCode: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, fullName: true, role: true, staffId: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: any) {
    console.error("POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/patients/:id/treatment-plans
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient ID" }, { status: 400 });
    }

    const body = await req.json();
    const { planId, status, description, startDate, endDate, priority } = body;

    if (!planId) {
      return NextResponse.json({ success: false, error: "Plan ID required" }, { status: 400 });
    }

    const existing = await prisma.treatmentPlan.findFirst({
      where: { id: parseInt(planId), patientId },
      select: { id: true, createdByUserId: true }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    // THERAPIST check
    if (user.role === Role.THERAPIST && existing.createdByUserId !== user.id) {
      return NextResponse.json({ success: false, error: "Not your plan" }, { status: 403 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description.trim();
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (priority !== undefined) updateData.priority = priority;

    const updated = await prisma.treatmentPlan.update({
      where: { id: parseInt(planId) },
      data: updateData,
      include: {
        patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, fullName: true, role: true, staffId: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PATCH error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
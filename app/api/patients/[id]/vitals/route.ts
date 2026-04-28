// app/api/patients/[id]/vitals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/patients/:id/vitals  — saves ALL vital fields
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole([Role.ADMIN, Role.DOCTOR, Role.NURSE]);

    const { id } = await context.params;
    const patientId = parseInt(id, 10);
    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient id" }, { status: 400 });
    }

    const body = await req.json();

    // ✅ Destructure ALL fields that exist in your PatientVital table
    const {
      bloodPressure,
      heartRate,
      temperature,
      oxygenSaturation,   // ✅ was missing from old route
      respiratoryRate,    // ✅ was missing from old route
      weight,             // ✅ was missing from old route
      height,             // ✅ was missing from old route
      bmi,                // ✅ was missing from old route
      painScore,          // ✅ was missing from old route
      notes,              // ✅ was missing from old route
      recordedAt,         // optional override
    } = body as {
      bloodPressure?:    string;
      heartRate?:        number;
      temperature?:      number;
      oxygenSaturation?: number;
      respiratoryRate?:  number;
      weight?:           number;
      height?:           number;
      bmi?:              number;
      painScore?:        number;
      notes?:            string;
      recordedAt?:       string;
    };

    // At least one field must be present
    if (
      bloodPressure    === undefined &&
      heartRate        === undefined &&
      temperature      === undefined &&
      oxygenSaturation === undefined &&
      respiratoryRate  === undefined &&
      weight           === undefined &&
      height           === undefined &&
      painScore        === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "At least one vital field is required" },
        { status: 400 }
      );
    }

    if (painScore !== undefined && (painScore < 0 || painScore > 10)) {
      return NextResponse.json(
        { success: false, error: "painScore must be between 0 and 10" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    }

    // ✅ Auto-calculate BMI when not provided but weight + height are
    let finalBmi = bmi ?? null;
    if (!finalBmi && weight && height && height > 0) {
      const hM = height / 100;
      finalBmi = parseFloat((weight / (hM * hM)).toFixed(1));
    }

    const vital = await prisma.patientVital.create({
      data: {
        patientId,
        recordedByUserId: user.id,
        bloodPressure:    bloodPressure?.trim() ?? null,
        heartRate:        heartRate        ?? null,
        temperature:      temperature      ?? null,
        oxygenSaturation: oxygenSaturation ?? null,
        respiratoryRate:  respiratoryRate  ?? null,
        weight:           weight           ?? null,
        height:           height           ?? null,
        bmi:              finalBmi,
        painScore:        painScore        ?? null,
        notes:            notes?.trim()    ?? null,
        ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
      },
      include: {
        recordedBy: {
          select: { id: true, fullName: true, role: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: vital }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    if (error?.message === "FORBIDDEN")       return NextResponse.json({ success: false, error: "Not authorized" },      { status: 403 });
    console.error("Create vitals error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/patients/:id/vitals
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { id } = await context.params;
    const patientId = parseInt(id, 10);
    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page     = Math.max(parseInt(searchParams.get("page")     || "1",  10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, userId: true } });
    if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

    if (user.role === Role.PATIENT) {
      if (!patient.userId || patient.userId !== user.id) {
        return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
      }
    } else {
      const allowed: Role[] = [Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.THERAPIST];
      if (!allowed.includes(user.role)) {
        return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
      }
    }

    const [total, vitals] = await Promise.all([
      prisma.patientVital.count({ where: { patientId } }),
      prisma.patientVital.findMany({
        where:   { patientId },
        orderBy: { recordedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          recordedBy: { select: { id: true, fullName: true, role: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: vitals,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Get vitals error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
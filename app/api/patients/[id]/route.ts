// app/api/patients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { Role, Sex, MaritalStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/patients/:id — full patient record with all nested data
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { id } = await context.params;
    const patientId = parseInt(id, 10);
    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient id" }, { status: 400 });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        vitals: {
          orderBy: { recordedAt: "desc" },
          include: {
            recordedBy: { select: { id: true, fullName: true, role: true, email: true } },
          },
        },
        progressNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, fullName: true, role: true, email: true } },
          },
        },
        diagnosticReports: {
          orderBy: { createdAt: "desc" },
          include: {
            orderedBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        treatmentPlans: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        dischargeSummaries: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        appointments: {
          orderBy: { appointmentDateTime: "desc" },
          include: {
            staff: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

    if (user.role === Role.PATIENT) {
      if (!patient.userId || patient.userId !== user.id) {
        return NextResponse.json({ success: false, error: "Not authorized to view this record" }, { status: 403 });
      }
    } else {
      const allowed: Role[] = [Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.THERAPIST];
      if (!allowed.includes(user.role)) {
        return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    console.error("Get patient by id error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/patients/:id — update patient demographics + room/bed/admission
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    await requireRole([Role.ADMIN, Role.DOCTOR, Role.NURSE]);

    const { id } = await context.params;
    const patientId = parseInt(id, 10);
    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json({ success: false, error: "Invalid patient id" }, { status: 400 });
    }

    const exists = await prisma.patient.findUnique({
      where: { id: patientId }, select: { id: true },
    });
    if (!exists) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

    const body = await req.json();

    // ✅ Now includes roomNumber, bedNumber, admissionDate, dischargeDate
    const {
      firstName, lastName, sex, dateOfBirth, phone, address, maritalStatus,
      employerName, employerAddress, nextOfKinName, nextOfKinRelationship,
      nextOfKinPhone, bloodGroup,
      roomNumber, bedNumber, admissionDate, dischargeDate,   // ✅ was missing
    } = body as {
      firstName?: string; lastName?: string; sex?: Sex; dateOfBirth?: string;
      phone?: string; address?: string; maritalStatus?: MaritalStatus;
      employerName?: string; employerAddress?: string;
      nextOfKinName?: string; nextOfKinRelationship?: string; nextOfKinPhone?: string;
      bloodGroup?: string;
      roomNumber?: string; bedNumber?: string;               // ✅
      admissionDate?: string; dischargeDate?: string;        // ✅
    };

    const data: Record<string, any> = {};

    if (firstName !== undefined) {
      const t = firstName.trim();
      if (!t) return NextResponse.json({ success: false, error: "firstName cannot be empty" }, { status: 400 });
      data.firstName = t;
    }
    if (lastName !== undefined) {
      const t = lastName.trim();
      if (!t) return NextResponse.json({ success: false, error: "lastName cannot be empty" }, { status: 400 });
      data.lastName = t;
    }

    if (phone                !== undefined) data.phone                = phone?.trim()                || null;
    if (address              !== undefined) data.address              = address?.trim()              || null;
    if (employerName         !== undefined) data.employerName         = employerName?.trim()         || null;
    if (employerAddress      !== undefined) data.employerAddress      = employerAddress?.trim()      || null;
    if (nextOfKinName        !== undefined) data.nextOfKinName        = nextOfKinName?.trim()        || null;
    if (nextOfKinRelationship!== undefined) data.nextOfKinRelationship= nextOfKinRelationship?.trim()|| null;
    if (nextOfKinPhone       !== undefined) data.nextOfKinPhone       = nextOfKinPhone?.trim()       || null;
    if (bloodGroup           !== undefined) data.bloodGroup           = bloodGroup?.trim()           || null;

    // ✅ Room / bed
    if (roomNumber !== undefined) data.roomNumber = roomNumber?.trim() || null;
    if (bedNumber  !== undefined) data.bedNumber  = bedNumber?.trim()  || null;

    // ✅ Admission date
    if (admissionDate !== undefined) {
      if (!admissionDate) {
        data.admissionDate = null;
      } else {
        const d = new Date(admissionDate);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid admissionDate" }, { status: 400 });
        }
        data.admissionDate = d;
      }
    }

    // ✅ Discharge date — also sets isActive = false when discharging
    if (dischargeDate !== undefined) {
      if (!dischargeDate) {
        data.dischargeDate = null;
        data.isActive      = true;  // re-admitting
      } else {
        const d = new Date(dischargeDate);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid dischargeDate" }, { status: 400 });
        }
        data.dischargeDate = d;
        data.isActive      = false; // patient is now discharged
      }
    }

    if (sex !== undefined) {
      const allowed: Sex[] = [Sex.MALE, Sex.FEMALE, Sex.OTHER];
      if (!allowed.includes(sex)) return NextResponse.json({ success: false, error: "Invalid sex value" }, { status: 400 });
      data.sex = sex;
    }

    if (maritalStatus !== undefined) {
      const allowed: MaritalStatus[] = [
        MaritalStatus.SINGLE, MaritalStatus.MARRIED,
        MaritalStatus.DIVORCED, MaritalStatus.WIDOWED, MaritalStatus.OTHER,
      ];
      if (!allowed.includes(maritalStatus)) return NextResponse.json({ success: false, error: "Invalid maritalStatus" }, { status: 400 });
      data.maritalStatus = maritalStatus;
    }

    if (dateOfBirth !== undefined) {
      const dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) return NextResponse.json({ success: false, error: "Invalid dateOfBirth" }, { status: 400 });
      data.dateOfBirth = dob;
      const now = new Date();
      let age   = now.getFullYear() - dob.getFullYear();
      const m   = now.getMonth()    - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      data.age = Math.max(0, age);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data,
      // ✅ Return all fields including room/bed/admission so frontend updates immediately
      select: {
        id: true, patientCode: true,
        firstName: true, lastName: true,
        sex: true, dateOfBirth: true, age: true,
        phone: true, address: true, maritalStatus: true,
        employerName: true, employerAddress: true,
        nextOfKinName: true, nextOfKinRelationship: true, nextOfKinPhone: true,
        bloodGroup: true,
        roomNumber:    true,
        bedNumber:     true,
        admissionDate: true,
        dischargeDate: true,
        isActive:      true,
        vitalStatus:   true,
        createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    if (error?.message === "FORBIDDEN")       return NextResponse.json({ success: false, error: "Not authorized" },      { status: 403 });
    console.error("Update patient error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
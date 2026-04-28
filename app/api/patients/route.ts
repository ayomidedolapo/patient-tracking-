// app/api/patients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleApi, AUTH_COOKIE_NAME } from "@/lib/auth";
import { Role, Sex, MaritalStatus } from "@prisma/client";

async function generatePatientCode() {
  const count = await prisma.patient.count();
  return `PAT-${(count + 1).toString().padStart(6, "0")}`;
}

function calculateAge(dateOfBirth: Date) {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const m = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) age--;
  return age < 0 ? 0 : age;
}

const PATIENT_LIST_SELECT = {
  id: true, patientCode: true,
  firstName: true, lastName: true,
  sex: true, dateOfBirth: true, age: true,
  phone: true, address: true, maritalStatus: true,
  employerName: true, employerAddress: true,
  nextOfKinName: true, nextOfKinRelationship: true, nextOfKinPhone: true,
  bloodGroup: true,
  roomNumber: true,
  bedNumber: true,
  admissionDate: true,
  dischargeDate: true,
  isActive: true,
  vitalStatus: true,
  createdAt: true, updatedAt: true,
};

export async function POST(req: NextRequest) {
  try {
    const user = requireRoleApi(req, [Role.ADMIN, Role.DOCTOR, Role.NURSE]);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated or not authorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      firstName, lastName, sex, dateOfBirth, phone, address, maritalStatus,
      employerName, employerAddress, nextOfKinName, nextOfKinRelationship,
      nextOfKinPhone, bloodGroup,
      roomNumber, bedNumber, admissionDate, dischargeDate,
    } = body as {
      firstName?: string; lastName?: string; sex?: Sex; dateOfBirth?: string;
      phone?: string; address?: string; maritalStatus?: MaritalStatus;
      employerName?: string; employerAddress?: string;
      nextOfKinName?: string; nextOfKinRelationship?: string; nextOfKinPhone?: string;
      bloodGroup?: string;
      roomNumber?: string; bedNumber?: string;
      admissionDate?: string; dischargeDate?: string;
    };

    if (!firstName?.trim() || !lastName?.trim() || !sex || !dateOfBirth || !phone?.trim() || !address?.trim()) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const allowedSex: Sex[] = [Sex.MALE, Sex.FEMALE, Sex.OTHER];
    if (!allowedSex.includes(sex)) {
      return NextResponse.json({ success: false, error: "Invalid sex value" }, { status: 400 });
    }

    const allowedMarital: MaritalStatus[] = [
      MaritalStatus.SINGLE, MaritalStatus.MARRIED,
      MaritalStatus.DIVORCED, MaritalStatus.WIDOWED, MaritalStatus.OTHER,
    ];
    if (maritalStatus && !allowedMarital.includes(maritalStatus)) {
      return NextResponse.json({ success: false, error: "Invalid maritalStatus value" }, { status: 400 });
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid dateOfBirth" }, { status: 400 });
    }

    let admDate: Date | null = null;
    let disDate: Date | null = null;
    if (admissionDate) {
      admDate = new Date(admissionDate);
      if (Number.isNaN(admDate.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid admissionDate" }, { status: 400 });
      }
    }
    if (dischargeDate) {
      disDate = new Date(dischargeDate);
      if (Number.isNaN(disDate.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid dischargeDate" }, { status: 400 });
      }
    }

    const age = calculateAge(dob);
    const patientCode = await generatePatientCode();

    const patient = await prisma.patient.create({
      data: {
        patientCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sex,
        dateOfBirth: dob,
        age,
        phone: phone.trim(),
        address: address.trim(),
        maritalStatus: maritalStatus ?? null,
        employerName: employerName?.trim() || null,
        employerAddress: employerAddress?.trim() || null,
        nextOfKinName: nextOfKinName?.trim() || null,
        nextOfKinRelationship: nextOfKinRelationship?.trim() || null,
        nextOfKinPhone: nextOfKinPhone?.trim() || null,
        bloodGroup: bloodGroup?.trim() || null,
        roomNumber: roomNumber?.trim() || null,
        bedNumber: bedNumber?.trim() || null,
        admissionDate: admDate,
        dischargeDate: disDate,
      },
      select: PATIENT_LIST_SELECT,
    });

    return NextResponse.json({ success: true, data: patient }, { status: 201 });
  } catch (error: any) {
    console.error("Create patient error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = requireRoleApi(req, [Role.ADMIN, Role.DOCTOR, Role.NURSE]);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated or not authorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const safePage = page > 0 ? page : 1;
    const safeSize = pageSize > 0 && pageSize <= 100 ? pageSize : 10;

    const where: Record<string, any> = {};

    if (rawSearch) {
      const tokens = rawSearch.split(/\s+/).map(t => t.trim()).filter(Boolean);

      const orConditions: Record<string, any>[] = [
        { firstName: { contains: rawSearch } },
        { lastName: { contains: rawSearch } },
        { phone: { contains: rawSearch } },
        { patientCode: { contains: rawSearch } },
        { bloodGroup: { contains: rawSearch } },
        { address: { contains: rawSearch } },
        { employerName: { contains: rawSearch } },
        { nextOfKinName: { contains: rawSearch } },
        { roomNumber: { contains: rawSearch } },
        { bedNumber: { contains: rawSearch } },
      ];

      if (tokens.length >= 2) {
        orConditions.push({
          AND: [{ firstName: { contains: tokens[0] } }, { lastName: { contains: tokens.slice(1).join(" ") } }],
        });
        orConditions.push({
          AND: [{ firstName: { contains: tokens.slice(1).join(" ") } }, { lastName: { contains: tokens[0] } }],
        });
      }

      if (tokens.length > 0) {
        where.AND = tokens.map(token => ({
          OR: [
            { firstName: { contains: token } },
            { lastName: { contains: token } },
            { phone: { contains: token } },
            { patientCode: { contains: token } },
            { bloodGroup: { contains: token } },
            { address: { contains: token } },
            { employerName: { contains: token } },
            { nextOfKinName: { contains: token } },
            { roomNumber: { contains: token } },
            { bedNumber: { contains: token } },
          ],
        }));
        where.OR = orConditions;
      }
    }

    const total = await prisma.patient.count({ where });
    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      select: PATIENT_LIST_SELECT,
    });

    return NextResponse.json({
      success: true,
      data: patients,
      meta: {
        total, page: safePage, pageSize: safeSize,
        totalPages: total === 0 ? 0 : Math.ceil(total / safeSize),
      },
    });
  } catch (error: any) {
    console.error("List/search patients error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
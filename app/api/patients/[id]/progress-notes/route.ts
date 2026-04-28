// app/api/patients/[id]/progress-notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { Role, AuthorRole } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// POST /api/patients/:id/progress-notes → add a progress note
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole([
      Role.ADMIN,
      Role.DOCTOR,
      Role.NURSE,
      Role.THERAPIST,
    ]);

    const { id } = await context.params;
    const patientId = parseInt(id, 10);

    if (!patientId || Number.isNaN(patientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid patient id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { note } = body as { note?: string };

    if (!note || note.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Note is required" },
        { status: 400 }
      );
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

    let authorRole: AuthorRole;
    switch (user.role) {
      case Role.DOCTOR:
        authorRole = AuthorRole.DOCTOR;
        break;
      case Role.NURSE:
        authorRole = AuthorRole.NURSE;
        break;
      case Role.THERAPIST:
        authorRole = AuthorRole.THERAPIST;
        break;
      case Role.ADMIN:
      default:
        authorRole = AuthorRole.DOCTOR;
        break;
    }

    const progressNote = await prisma.progressNote.create({
      data: {
        patientId,
        authorUserId: user.id,
        authorRole,
        note: note.trim(),
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            role: true,
            email: true,
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
      { success: true, data: progressNote },
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

    console.error("Create progress note error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/patients/:id/progress-notes → view notes
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
      const allowedStaff: Role[] = [
        Role.ADMIN,
        Role.DOCTOR,
        Role.NURSE,
        Role.THERAPIST,
      ];

      if (!allowedStaff.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: "Not authorized" },
          { status: 403 }
        );
      }
    }

    const [total, progressNotes] = await Promise.all([
      prisma.progressNote.count({
        where: { patientId },
      }),
      prisma.progressNote.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              role: true,
              email: true,
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
      data: progressNotes,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get progress notes error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
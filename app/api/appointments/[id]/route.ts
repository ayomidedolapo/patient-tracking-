import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Role, AppointmentStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const ALLOWED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (
      ![Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.THERAPIST].includes(
        user.role as 'ADMIN' | 'DOCTOR' | 'NURSE' | 'THERAPIST'
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const appointmentId = parseInt(id, 10);

    if (!appointmentId || Number.isNaN(appointmentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid appointment id" },
        { status: 400 }
      );
    }

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        staffUserId: true,
        status: true,
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (user.role !== Role.ADMIN) {
      if (existingAppointment.staffUserId !== user.id) {
        return NextResponse.json(
          { success: false, error: "You cannot modify another staff member's appointment" },
          { status: 403 }
        );
      }
    }

    const body = await req.json() as {
      status?: AppointmentStatus;
      appointmentDateTime?: string;
      reason?: string;
      reminderSent?: boolean;
    };
    const { status, appointmentDateTime, reason, reminderSent } = body;

    const data: {
      status?: AppointmentStatus;
      appointmentDateTime?: Date;
      reason?: string | null;
      reminderSent?: boolean;
    } = {};

    if (status !== undefined) {
      if (user.role === Role.THERAPIST) {
        return NextResponse.json(
          {
            success: false,
            error: "Therapists are not allowed to update appointment status",
          },
          { status: 403 }
        );
      }

      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: "Invalid status" },
          { status: 400 }
        );
      }

      data.status = status;
    }

    if (reason !== undefined) {
      data.reason = reason?.trim() ? reason.trim() : null;
    }

    if (reminderSent !== undefined) {
      if (user.role === Role.THERAPIST) {
        return NextResponse.json(
          {
            success: false,
            error: "Therapists are not allowed to update reminder state",
          },
          { status: 403 }
        );
      }

      data.reminderSent = !!reminderSent;
    }

    if (appointmentDateTime !== undefined) {
      const dt = new Date(appointmentDateTime);

      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid appointmentDateTime" },
          { status: 400 }
        );
      }

      data.appointmentDateTime = dt;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields supplied for update" },
        { status: 400 }
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data,
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("Update appointment error:", error);

    const typedError = error as {
      code?: string;
      message?: string;
    };

    if (typedError?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: typedError.message || "Internal server error" },
      { status: 500 }
    );
  }
}

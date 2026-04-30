import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromCookie, ADMIN_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth";
import { headers } from "next/headers";
import { Role, VitalStatus, TaskStatus, AppointmentStatus } from "@prisma/client";

interface PatientData {
  id: number;
  firstName: string;
  lastName: string;
  patientCode: string;
  roomNumber?: string;
  bedNumber?: string;
  vitalStatus: VitalStatus;
}

interface AppointmentData {
  id: number;
  appointmentDateTime: string;
  status: AppointmentStatus;
}

interface TaskData {
  id: number;
  status: TaskStatus;
  completedAt?: string;
}

interface InternalFetchResponse {
  success: boolean;
  data: any; // Data can be of various types from different APIs
}

// ─── Helper: server-side call to an internal route ───────────────────────────
async function internalFetch(path: string, requestHeaders: Headers): Promise<InternalFetchResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method:  "GET",
    headers: {
      cookie:          requestHeaders.get("cookie")          || "",
      authorization:   requestHeaders.get("authorization")   || "",
      "content-type":  "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json : null;
}

export async function GET(request: NextRequest) {
  try {
    // ── 1. Who is calling? (Fixing the Admin Override Bug) ────────────────────
    const referer = request.headers.get("referer") || "";
    const isAdminPortal = referer.includes("/admin");

    let user = null;
    let activeToken = "";
    let activeCookieName = "";

    // Check the referer to strictly enforce which cookie to use
    if (isAdminPortal) {
      user = await getCurrentUserFromCookie(ADMIN_COOKIE_NAME);
      activeCookieName = ADMIN_COOKIE_NAME;
      activeToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value || "";
    } else {
      user = await getCurrentUserFromCookie(AUTH_COOKIE_NAME);
      activeCookieName = AUTH_COOKIE_NAME;
      activeToken = request.cookies.get(AUTH_COOKIE_NAME)?.value || "";
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Fetch full user details including department, shift, staffId
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        shift: true,
        staffId: true,
      },
    });

    if (!fullUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // ── 1.5 Isolate the headers for internal fetches ──────────────────────────
    // Create a new Headers object and ONLY pass the specific cookie we just validated.
    // This prevents sub-routes from seeing the admin_token if a staff member is logged in.
    const isolatedHeaders = new Headers(request.headers);
    if (activeToken) {
      isolatedHeaders.set("cookie", `${activeCookieName}=${activeToken}`);
    }

    // ── 2. Fan out to individual routes in parallel ───────────────────────────
    const [patientsRes, appointmentsRes, tasksRes] = await Promise.allSettled([
      internalFetch(`/api/patients?pageSize=30`, isolatedHeaders),
      internalFetch(`/api/appointments?pageSize=20`, isolatedHeaders),
      internalFetch(`/api/tasks?pageSize=50`, isolatedHeaders),
    ]);

    // ── 3. Safely unwrap results ──────────────────────────────────────────────
    const patients: PatientData[] = 
      patientsRes.status === "fulfilled" && patientsRes.value && patientsRes.value.data 
        ? patientsRes.value.data as PatientData[] 
        : [];
    const appointments: AppointmentData[] = 
      appointmentsRes.status === "fulfilled" && appointmentsRes.value && appointmentsRes.value.data
        ? appointmentsRes.value.data as AppointmentData[] 
        : [];
    const tasks: TaskData[] = 
      tasksRes.status === "fulfilled" && tasksRes.value && tasksRes.value.data
        ? tasksRes.value.data as TaskData[] 
        : [];

    // ── 4. Derive alerts from patients already fetched ────────────────────────
    const alerts = patients
      .filter((p) => p.vitalStatus === VitalStatus.CRITICAL || p.vitalStatus === VitalStatus.UNSTABLE)
      .slice(0, 10)
      .map((p) => ({
        id:          p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        patientCode: p.patientCode,
        room:        p.roomNumber  ?? undefined,
        bed:         p.bedNumber   ?? undefined,
        status:      p.vitalStatus,
      }));

    // ── 5. Compute stats from the fetched data ────────────────────────────────
    const todayStr = new Date().toDateString();

    const todayAppointments = appointments.filter(
      (a) => new Date(a.appointmentDateTime).toDateString() === todayStr
    );

    const stats = {
      totalMyPatients:      patients.length,
      criticalPatients:     patients.filter((p) => p.vitalStatus === VitalStatus.CRITICAL).length,
       pendingTasks:         tasks.filter((t) => [TaskStatus.PENDING, TaskStatus.IN_PROGRESS].includes(t.status as 'PENDING' | 'IN_PROGRESS')).length,
      completedTasksToday:  tasks.filter((t) => t.status === TaskStatus.COMPLETED && t.completedAt && new Date(t.completedAt).toDateString() === todayStr).length,
      appointmentsTodayTotal: todayAppointments.length,
      patientsSeenToday:    todayAppointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
    };

    // ── 6. Return the aggregated dashboard payload ────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
         me: {
           id:         fullUser.id,
           fullName:   fullUser.fullName,
           email:      fullUser.email,
           role:       fullUser.role,
           department: fullUser.department ?? null,
           shift:      fullUser.shift      ?? null,
           staffId:    fullUser.staffId    ?? null,
         },
        patients,
        appointments,
        tasks,
        alerts,
        stats,
      },
    });
  } catch (error: unknown) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
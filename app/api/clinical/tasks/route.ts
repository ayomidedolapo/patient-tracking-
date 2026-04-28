import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// GET /api/tasks - List tasks (with filtering)
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const priority = searchParams.get("priority") as any;
    const patientId = searchParams.get("patientId");
    const assignedTo = searchParams.get("assignedTo");
    const type = searchParams.get("type") as any;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: any = {};

    // Role-based filtering
    if (user.role !== "ADMIN") {
      // Staff can see: tasks assigned to them OR tasks for patients they care for
      where.OR = [
        { assignedTo: user.id },
        {
          patient: {
            staffAssignments: {
              some: { staffId: user.id }
            }
          }
        }
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;
    if (patientId) where.patientId = parseInt(patientId);
    if (assignedTo) where.assignedTo = parseInt(assignedTo);

    const skip = (page - 1) * pageSize;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              patientCode: true,
              roomNumber: true,
              bedNumber: true,
            },
          },
          assignee: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [
          { priority: "desc" }, // URGENT first
          { dueTime: "asc" },  // Then by due time
          { createdAt: "desc" },
        ],
        skip,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: tasks,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Tasks fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only staff can create tasks
    if (user.role === "PATIENT") {
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      patientId,
      assignedTo,
      type,
      title,
      description,
      priority = "NORMAL",
      dueTime,
    } = body;

    // Validation
    if (!patientId || !type || !title) {
      return NextResponse.json(
        { success: false, error: "patientId, type, and title are required" },
        { status: 400 }
      );
    }

    // Verify patient exists and user has access
    const patient = await prisma.patient.findFirst({
      where: {
        id: parseInt(patientId),
        ...(user.role !== "ADMIN" && {
          staffAssignments: {
            some: { staffId: user.id }
          }
        }),
      },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found or access denied" },
        { status: 404 }
      );
    }
    
    // If assignedTo provided, verify staff exists
    if (assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: parseInt(assignedTo),
          role: { in: ["DOCTOR", "NURSE", "THERAPIST", "ADMIN"] },
        },
      });
      if (!assignee) {
        return NextResponse.json(
          { success: false, error: "Assignee not found or invalid role" },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        patientId: parseInt(patientId),
        assignedTo: assignedTo ? parseInt(assignedTo) : user.id, // Default to self
        createdBy: user.id,
        type,
        title,
        description,
        priority,
        dueTime: dueTime ? new Date(dueTime) : null,
        status: "PENDING",
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            roomNumber: true,
            bedNumber: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: task,
      message: "Task created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Task creation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create task" },
      { status: 500 }
    );
  }
}
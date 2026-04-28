import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// GET /api/tasks/my-tasks - Quick endpoint for dashboard
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
    const status = searchParams.get("status");

    const where: any = {
      assignedTo: user.id,
    };

    if (status) {
      where.status = status;
    } else {
      // Default: pending and in-progress
      where.status = { in: ["PENDING", "IN_PROGRESS"] };
    }

    const tasks = await prisma.task.findMany({
      where,
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
      },
      orderBy: [
        { priority: "desc" },
        { dueTime: "asc" },
      ],
      take: 50, // Limit for performance
    });

    return NextResponse.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("My tasks fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
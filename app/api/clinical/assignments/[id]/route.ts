import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// GET /api/staff-assignments/[id] - Get single assignment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const assignmentId = parseInt(params.id);

    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        id: assignmentId,
        ...(user.role !== "ADMIN" && {
          OR: [
            { staffId: user.id },
            {
              patient: {
                staffAssignments: {
                  some: { staffId: user.id }
                }
              }
            },
          ],
        }),
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
            department: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            roomNumber: true,
            bedNumber: true,
            vitalStatus: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error("Assignment fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

// PATCH /api/staff-assignments/[id] - Update assignment (e.g., set primary)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const assignmentId = parseInt(params.id);
    const { isPrimary } = await request.json();

    if (isPrimary === undefined) {
      return NextResponse.json(
        { success: false, error: "isPrimary is required" },
        { status: 400 }
      );
    }

    // Only admin or existing primary staff can update
    const existing = await prisma.staffAssignment.findFirst({
      where: {
        id: assignmentId,
        ...(user.role !== "ADMIN" && {
          patient: {
            staffAssignments: {
              some: {
                staffId: user.id,
                isPrimary: true,
              }
            }
          },
        }),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Assignment not found or permission denied" },
        { status: 404 }
      );
    }

    // If setting as primary, unset others
    if (isPrimary) {
      await prisma.staffAssignment.updateMany({
        where: {
          patientId: existing.patientId,
          isPrimary: true,
          id: { not: assignmentId },
        },
        data: { isPrimary: false },
      });
    }

    const assignment = await prisma.staffAssignment.update({
      where: { id: assignmentId },
      data: { isPrimary },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: assignment,
      message: "Assignment updated successfully",
    });
  } catch (error) {
    console.error("Assignment update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE /api/staff-assignments/[id] - Remove assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const assignmentId = parseInt(params.id);

    // Only admin or the assigned staff themselves can remove
    const existing = await prisma.staffAssignment.findFirst({
      where: {
        id: assignmentId,
        ...(user.role !== "ADMIN" && {
          OR: [
            { staffId: user.id },
            {
              patient: {
                staffAssignments: {
                  some: {
                    staffId: user.id,
                    isPrimary: true,
                  }
                }
              }
            },
          ],
        }),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Assignment not found or permission denied" },
        { status: 404 }
      );
    }

    await prisma.staffAssignment.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({
      success: true,
      message: "Assignment removed successfully",
    });
  } catch (error) {
    console.error("Assignment delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
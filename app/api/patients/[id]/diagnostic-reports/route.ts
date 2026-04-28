import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

type ReportType = 'XRAY' | 'SCAN' | 'PATHOLOGY' | 'LAB' | 'OTHER';

const VALID_REPORT_TYPES: ReportType[] = ['XRAY', 'SCAN', 'PATHOLOGY', 'LAB', 'OTHER'];
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// app/api/patients/[id]/diagnostic-reports/route.ts

async function verifyAuthToken() {
  const cookieStore = await cookies();
  
  // Try to get auth_token first, fallback to admin_token
  let token = cookieStore.get('auth_token')?.value;
  if (!token) {
    token = cookieStore.get('admin_token')?.value;
  }
  
  if (!token) return null;
  
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: number; role: string };
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

// Helper to get user info (not staff - User model has staffId field)
async function getUserInfo(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  return user;
}

// GET - Fetch all diagnostic reports for a patient

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patientId = parseInt(id, 10);
    
    if (isNaN(patientId)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }
    
    const payload = await verifyAuthToken();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Get reports without includes
    const reports = await prisma.diagnosticReport.findMany({
      where: { patientId: patientId },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch user info separately for each report
    const transformedReports = await Promise.all(
      reports.map(async (report) => {
        const user = await getUserInfo(report.orderedByUserId);
        
        return {
          id: report.id,
          patientId: report.patientId,
          orderedByUserId: report.orderedByUserId,
          reportType: report.reportType,
          title: report.title,
          description: report.description,
          fileUrl: report.fileUrl,
          resultDate: report.resultDate?.toISOString() || null,
          isCritical: report.isCritical,
          acknowledgedAt: report.acknowledgedAt?.toISOString() || null,
          acknowledgedBy: report.acknowledgedBy,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
          patient: {
            id: patient.id,
            patientCode: patient.patientCode,
            firstName: patient.firstName,
            lastName: patient.lastName,
            sex: patient.sex,
            age: calculateAge(patient.dateOfBirth)
          },
          orderedBy: user ? {
            id: user.id,
            staffId: user.staffId || String(user.id),
            role: user.role,
            user: {
              firstName: user.fullName?.split(' ')[0] || '',
              lastName: user.fullName?.split(' ').slice(1).join(' ') || ''
            }
          } : {
            id: report.orderedByUserId,
            staffId: String(report.orderedByUserId),
            role: 'UNKNOWN',
            user: { firstName: 'Unknown', lastName: 'Staff' }
          }
        };
      })
    );

    return NextResponse.json(transformedReports);
    
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagnostic reports', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST - Create new diagnostic report (ADMIN and DOCTOR only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patientId = parseInt(id, 10);
    
    if (isNaN(patientId)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }
    
    const payload = await verifyAuthToken();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = payload.role?.toString().trim().toUpperCase();
    
    if (!['ADMIN', 'DOCTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: `Forbidden: Only ADMIN and DOCTOR can create. Your role: ${userRole}` },
        { status: 403 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const body = await request.json();
    const { reportType, title, description, isCritical } = body;

    if (!reportType || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: reportType and title are required' },
        { status: 400 }
      );
    }

    if (!VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Create report - NO INCLUDES
    const report = await prisma.diagnosticReport.create({
      data: {
        patientId: patientId,
        orderedByUserId: payload.userId,
        reportType: reportType as ReportType,
        title: title.trim(),
        description: description ? description.trim() : null,
        fileUrl: null,
        resultDate: null,
        isCritical: isCritical || false,
        acknowledgedAt: null,
        acknowledgedBy: null
      }
    });

    // Get user info separately
    const user = await getUserInfo(payload.userId);

    const transformedReport = {
      id: report.id,
      patientId: report.patientId,
      orderedByUserId: report.orderedByUserId,
      reportType: report.reportType,
      title: report.title,
      description: report.description,
      fileUrl: report.fileUrl,
      resultDate: report.resultDate?.toISOString() || null,
      isCritical: report.isCritical,
      acknowledgedAt: report.acknowledgedAt?.toISOString() || null,
      acknowledgedBy: report.acknowledgedBy,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      patient: {
        id: patient.id,
        patientCode: patient.patientCode,
        firstName: patient.firstName,
        lastName: patient.lastName,
        sex: patient.sex,
        age: calculateAge(patient.dateOfBirth)
      },
      orderedBy: user ? {
        id: user.id,
        staffId: user.staffId || String(user.id),
        role: user.role,
        user: {
          firstName: user.fullName?.split(' ')[0] || '',
          lastName: user.fullName?.split(' ').slice(1).join(' ') || ''
        }
      } : {
        id: payload.userId,
        staffId: String(payload.userId),
        role: payload.role,
        user: { firstName: 'You', lastName: '' }
      }
    };

    return NextResponse.json(transformedReport, { status: 201 });
    
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create diagnostic report', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH - Update diagnostic report
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patientId = parseInt(id, 10);
    
    if (isNaN(patientId)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }
    
    const payload = await verifyAuthToken();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, isCritical, description, fileUrl, resultDate, acknowledgedAt, acknowledgedBy } = body;

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
    }

    const existingReport = await prisma.diagnosticReport.findFirst({
      where: {
        id: reportId,
        patientId: patientId
      }
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (isCritical !== undefined) updateData.isCritical = isCritical;
    if (description !== undefined) updateData.description = description;
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
    if (resultDate !== undefined) updateData.resultDate = resultDate ? new Date(resultDate) : null;
    if (acknowledgedAt !== undefined) updateData.acknowledgedAt = acknowledgedAt ? new Date(acknowledgedAt) : null;
    if (acknowledgedBy !== undefined) updateData.acknowledgedBy = acknowledgedBy;

    // Update without includes
    const updated = await prisma.diagnosticReport.update({
      where: { id: reportId },
      data: updateData
    });

    // Get related data separately
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    const user = await getUserInfo(updated.orderedByUserId);

    const transformed = {
      id: updated.id,
      patientId: updated.patientId,
      orderedByUserId: updated.orderedByUserId,
      reportType: updated.reportType,
      title: updated.title,
      description: updated.description,
      fileUrl: updated.fileUrl,
      resultDate: updated.resultDate?.toISOString() || null,
      isCritical: updated.isCritical,
      acknowledgedAt: updated.acknowledgedAt?.toISOString() || null,
      acknowledgedBy: updated.acknowledgedBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      patient: patient ? {
        id: patient.id,
        patientCode: patient.patientCode,
        firstName: patient.firstName,
        lastName: patient.lastName,
        sex: patient.sex,
        age: calculateAge(patient.dateOfBirth)
      } : null,
      orderedBy: user ? {
        id: user.id,
        staffId: user.staffId || String(user.id),
        role: user.role,
        user: {
          firstName: user.fullName?.split(' ')[0] || '',
          lastName: user.fullName?.split(' ').slice(1).join(' ') || ''
        }
      } : null
    };

    return NextResponse.json(transformed);
    
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update report', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateAge(dateOfBirth: Date | null): number {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
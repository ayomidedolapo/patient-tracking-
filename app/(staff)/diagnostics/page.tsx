'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  X,
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Download,
  Calendar,
  Beaker,
  Scan,
  Microscope,
  FileQuestion,
  Loader2,
  RefreshCw
} from 'lucide-react';

// Types
type ReportType = 'XRAY' | 'SCAN' | 'PATHOLOGY' | 'LAB' | 'OTHER';
type ReportStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

const getErrorMessage = (error: unknown, fallback = 'Request failed') =>
  error instanceof Error ? error.message : fallback;

// Types matching API response (IDs are numbers from DB)
interface DiagnosticReport {
  id: number | string;
  patientId: number | string;
  orderedByUserId: number | string;
  reportType: ReportType;
  title: string;
  description: string | null;
  fileUrl: string | null;
  resultDate: string | null;
  isCritical: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: number | string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: number | string;
    patientCode: string;
    firstName: string;
    lastName: string;
    sex: string;
    age: number;
  };
  orderedBy?: {
    id: number | string;
    staffId: string;
    role: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  age: number;
  isActive: boolean;
}

interface Me {
  id: number;
  fullName: string;
  email: string;
  role: string;
  department: string | null;
  shift: string | null;
  staffId: string | null;
}

// Report Type Config
const reportTypeConfig: Record<ReportType, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  XRAY: { icon: Scan, color: 'text-blue-600', bg: 'bg-blue-50', label: 'X-Ray' },
  SCAN: { icon: Scan, color: 'text-purple-600', bg: 'bg-purple-50', label: 'CT/MRI Scan' },
  PATHOLOGY: { icon: Microscope, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Pathology' },
  LAB: { icon: Beaker, color: 'text-green-600', bg: 'bg-green-50', label: 'Laboratory' },
  OTHER: { icon: FileQuestion, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Other' }
};

// ─── Input styles ─────────────────────────────────────────────────────────────

const fieldCls = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';
const selectCls = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';

// Modal Component - Fixed: No blur on modal itself
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  maxWidth?: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop with blur - separate from modal content */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-0">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        >
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 bg-white">{children}</div>
        </motion.div>
      </div>
    </div>
  );
};

// Main Page Component
export default function DiagnosticsPage() {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState('');
  
  const [reports, setReports] = useState<DiagnosticReport[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ReportType | 'ALL'>('ALL');
  const [filterStatus] = useState<ReportStatus | 'ALL'>('ALL');
  const [expandedReport, setExpandedReport] = useState<number | string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state - matching DB structure
  const [formData, setFormData] = useState({
    patientId: '',
    reportType: 'LAB' as ReportType,
    title: '',
    description: '',
    isCritical: false
  });

  // ─── Fetch me ───────────────────────────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    setMeLoading(true);
    setMeError('');
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.me) {
          setMe(json.data.me);
          setMeLoading(false);
          return;
        }
      }
      const res2 = await fetch('/api/auth/me');
      if (res2.ok) {
        const json2 = await res2.json();
        const user = json2?.data ?? json2;
        if (user?.id) {
          setMe({
            id: user.id,
            fullName: user.fullName ?? user.name ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
            email: user.email ?? '',
            role: user.role ?? 'STAFF',
            department: user.department ?? null,
            shift: user.shift ?? null,
            staffId: user.staffId ?? null,
          });
          setMeLoading(false);
          return;
        }
      }
      setMeError('Could not load your staff profile. Please refresh the page.');
    } catch (e: unknown) {
      setMeError(getErrorMessage(e, 'Network error loading staff profile. Please refresh.'));
      console.error('fetchMe error:', e);
    } finally {
      setMeLoading(false);
    }
  }, []);

  // ─── Fetch patients ─────────────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/patients?pageSize=1000');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (json.data ?? []);
      setPatients(arr);
    } catch (e) {
      console.error('fetchPatients error:', e);
      setPatients([]);
    }
  }, []);

  // ─── Fetch reports ──────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    if (patients.length === 0) return;
    
    try {
      const allReports: DiagnosticReport[] = [];
      
      const reportPromises = patients.slice(0, 100).map(async (patient: Patient) => {
        try {
          const res = await fetch(`/api/patients/${patient.id}/diagnostic-reports`);
          if (res.ok) {
            const patientReports = await res.json();
            if (Array.isArray(patientReports)) {
              return patientReports;
            }
          }
          return [];
        } catch (e) {
          console.error(`Failed to fetch reports for patient ${patient.id}:`, e);
          return [];
        }
      });

      const reportsArrays = await Promise.all(reportPromises);
      reportsArrays.forEach(arr => allReports.push(...arr));

      allReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(allReports);
    } catch (err) {
      console.error('fetchReports error:', err);
    }
  }, [patients]);

  // ─── Combined fetch data ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchMe();
      await fetchPatients();
    } catch (err) {
      console.error('Fetch data error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [fetchMe, fetchPatients]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (patients.length > 0) {
      fetchReports();
    }
  }, [patients, fetchReports]);

  // ─── Role check ─────────────────────────────────────────────────────────────
  const userRole = me?.role?.toString().trim().toUpperCase() || 'UNKNOWN';
  const canCreateReport = userRole === 'ADMIN' || userRole === 'DOCTOR';

  // ─── Create Report ──────────────────────────────────────────────────────────
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId) {
      setError('Please select a patient');
      return;
    }
    if (!me?.id) {
      setError('Staff profile not loaded. Please refresh and try again.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Match DB structure exactly - send all required fields
      const payload = {
        patientId: parseInt(formData.patientId), // Send as number
        orderedByUserId: me.id, // Send as number
        reportType: formData.reportType,
        title: formData.title,
        description: formData.description || null,
        fileUrl: null,
        resultDate: null,
        isCritical: formData.isCritical
      };

      console.log('Creating report with payload:', payload);

      const res = await fetch(`/api/patients/${formData.patientId}/diagnostic-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log('Create response:', data);

      if (!res.ok) {
        throw new Error(data.error || `Failed to create report (${res.status})`);
      }

      setIsCreateModalOpen(false);
      setSuccessMessage('Diagnostic report created successfully');
      setFormData({
        patientId: '',
        reportType: 'LAB',
        title: '',
        description: '',
        isCritical: false
      });
      
      // Refresh reports
      fetchReports();
    } catch (err) {
      console.error('Create report error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Update Status ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (reportId: number | string, patientId: number | string, newStatus: ReportStatus) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/diagnostic-reports`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportId: typeof reportId === 'string' ? parseInt(reportId) : reportId,
          status: newStatus
        })
      });

      if (!res.ok) {
        if (res.status === 404) {
          setSuccessMessage('Status update not supported by API');
          return;
        }
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      const updatedReport = await res.json();
      setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r));
      setSuccessMessage(`Report status updated to ${newStatus}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.patient?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.patient?.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.patient?.patientCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.orderedBy?.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (report.orderedBy?.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesType = filterType === 'ALL' || report.reportType === filterType;
    
    // Derive status from isCritical
    const reportStatus: ReportStatus = report.isCritical ? 'PENDING' : 'COMPLETED';
    const matchesStatus = filterStatus === 'ALL' || reportStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.isCritical).length,
    completed: reports.filter(r => !r.isCritical).length,
    today: reports.filter(r => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today;
    }).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <>
      {/* Main content - blur only applied here, not to modal */}
      <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCreateModalOpen ? 'blur-[2px]' : ''}`}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded-xl">
                  <Stethoscope className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Diagnostic Reports</h1>
                  <p className="text-sm text-slate-500">Manage patient diagnostic reports and imaging</p>
                </div>
              </div>
              
              {canCreateReport && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-sky-500/30 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Report</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ─── Staff Banner ──────────────────────────────────────────────────── */}
          {meLoading ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
              <span className="text-sm text-slate-500">Loading your staff profile...</span>
            </div>
          ) : meError ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-700">Staff Profile Not Loaded</p>
                <p className="text-xs text-rose-500">{meError}</p>
              </div>
              <button
                onClick={fetchMe}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-medium transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : me ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-5 h-5 text-sky-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{me.fullName}</p>
                <p className="text-xs text-slate-500">
                  {me.role}
                  {me.department ? ` • ${me.department}` : ''}
                  {me.staffId ? ` • ${me.staffId}` : ''}
                </p>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">Role: {userRole}</p>
              <button onClick={fetchMe} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition" title="Refresh staff profile">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 font-medium">{error}</span>
                <button onClick={() => setError(null)} className="hover:text-rose-900">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
            
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800"
              >
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 font-medium">{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="hover:text-emerald-900">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Total Reports</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Critical</div>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Normal</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Today&apos;s Reports</div>
              <div className="text-2xl font-bold text-sky-600">{stats.today}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by patient, code, title, or doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={fieldCls + ' pl-10'}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ReportType | 'ALL')}
                className={selectCls}
              >
                <option value="ALL">All Types</option>
                <option value="XRAY">X-Ray</option>
                <option value="SCAN">CT/MRI Scan</option>
                <option value="PATHOLOGY">Pathology</option>
                <option value="LAB">Laboratory</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No reports found</h3>
                <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
                {canCreateReport && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-sky-500/30 transition-all inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Create Your First Report
                  </button>
                )}
              </div>
            ) : (
              filteredReports.map((report) => {
                const TypeIcon = reportTypeConfig[report.reportType].icon;
                const isExpanded = expandedReport === report.id;
                const isCritical = report.isCritical;

                return (
                  <motion.div
                    key={report.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    >
                      <div className={`p-2 rounded-xl ${reportTypeConfig[report.reportType].bg} ${reportTypeConfig[report.reportType].color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">{report.title}</h3>
                          {isCritical && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Critical
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="text-slate-900 font-medium">{report.patient?.firstName} {report.patient?.lastName}</span>
                            <span className="text-slate-400">({report.patient?.patientCode})</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-slate-900">{new Date(report.createdAt).toLocaleDateString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}</span>
                          </span>
                          {report.orderedBy && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              <span className="text-slate-900">Dr. {report.orderedBy.user.firstName} {report.orderedBy.user.lastName}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 bg-slate-50"
                        >
                          <div className="p-4 space-y-4">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <h4 className="text-sm font-semibold text-slate-900 mb-2">Patient Information</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-slate-500">Name:</span>
                                  <p className="font-medium text-slate-900">{report.patient?.firstName} {report.patient?.lastName}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Code:</span>
                                  <p className="font-medium text-slate-900">{report.patient?.patientCode}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Sex:</span>
                                  <p className="font-medium text-slate-900">{report.patient?.sex}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Age:</span>
                                  <p className="font-medium text-slate-900">{report.patient?.age} years</p>
                                </div>
                              </div>
                            </div>

                            {report.description && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900 mb-1">Description</h4>
                                <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200">{report.description}</p>
                              </div>
                            )}

                            {report.fileUrl && (
                              <div className="flex items-center gap-2">
                                <a
                                  href={report.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium"
                                >
                                  <Download className="w-4 h-4" />
                                  Download Attachment
                                </a>
                              </div>
                            )}

                            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                              <div className="flex gap-4">
                                {/* FIXED: Use String() to handle both number and string IDs */}
                                <span>Report ID: <span className="font-mono text-slate-900">{String(report.id).slice(0, 8)}...</span></span>
                                {report.orderedBy && (
                                  <span>Ordered by: <span className="text-slate-900 font-medium">{report.orderedBy.user.firstName} {report.orderedBy.user.lastName} ({report.orderedBy.staffId})</span></span>
                                )}
                              </div>
                              <span>Last updated: <span className="text-slate-900">{new Date(report.updatedAt).toLocaleString()}</span></span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create Report Modal - Outside the blurred container */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !submitting && setIsCreateModalOpen(false)}
        title="Create New Diagnostic Report"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateReport} className="space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
              {!me && (
                <button type="button" onClick={fetchMe} className="ml-auto flex items-center gap-1 text-rose-600 underline text-xs">
                  <RefreshCw className="w-3 h-3" /> Reload staff
                </button>
              )}
            </div>
          )}

          {/* Staff info card */}
          {me ? (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
              <p className="text-xs font-semibold text-sky-600 uppercase mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Ordering Staff
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{me.fullName}</p>
                  <p className="text-xs text-slate-500">{me.role}{me.department ? ` • ${me.department}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-sky-700 font-semibold">{me.staffId ?? `ID: ${me.id}`}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-700">Staff profile not loaded</p>
                <p className="text-xs text-amber-600">Click Reload to try again before creating.</p>
              </div>
              <button type="button" onClick={fetchMe}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-xs font-medium transition">
                <RefreshCw className="w-3.5 h-3.5" /> Reload
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Patient *
              </label>
              <select
                required
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className={selectCls}
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} ({patient.patientCode}) - {patient.sex}, {patient.age}y
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Report Type *</label>
              <select
                required
                value={formData.reportType}
                onChange={(e) => setFormData({ ...formData, reportType: e.target.value as ReportType })}
                className={selectCls}
              >
                <option value="LAB">Laboratory</option>
                <option value="XRAY">X-Ray</option>
                <option value="SCAN">CT/MRI Scan</option>
                <option value="PATHOLOGY">Pathology</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Chest X-Ray, Blood Count, CT Brain"
                className={fieldCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Brief description of the test..."
                className={fieldCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCritical}
                  onChange={(e) => setFormData({ ...formData, isCritical: e.target.checked })}
                  className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-slate-700">Mark as Critical</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submitting}
              className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !me}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl font-medium shadow-lg shadow-sky-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</>
              ) : (
                <><Plus className="w-4 h-4" /> Create Report</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

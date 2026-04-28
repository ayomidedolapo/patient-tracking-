// app/patient/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity, Calendar, FileText, Pill, FlaskConical, User,
  Phone, MapPin, Droplets, Clock, LogOut, AlertCircle,
  CheckCircle2, ChevronRight, Heart, Thermometer, Wind,
  Users, Bed, CalendarClock, RefreshCw, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "vitals" | "notes" | "medications" | "reports";
type VitalStatus = "STABLE" | "UNSTABLE" | "CRITICAL" | "RECOVERING";

interface ApiVital {
  id: number;
  patientId: number;
  recordedByUserId: number;
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  respiratoryRate: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  painScore: number | null;
  notes: string | null;
  recordedAt: string;
  recordedBy?: { id: number; fullName: string; role: string };
}

interface ProgressNote {
  id: number;
  patientId: number;
  note: string;
  createdAt: string;
  author?: { id: number; fullName: string; role: string };
}

interface DiagnosticReport {
  id: number;
  patientId: number;
  reportType: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  createdAt: string;
  createdBy?: { id: number; fullName: string; role: string };
}

interface DischargeSummary {
  id: number;
  patientId: number;
  dischargeDate: string;
  dischargeDiagnosis: string;
  dischargeSummary: string;
  medicationsOnDischarge: string | null;
  followUpInstructions: string | null;
  createdAt: string;
  createdBy?: { id: number; fullName: string; role: string };
}

interface TreatmentPlan {
  id: number;
  patientId: number;
  description: string;
  startDate: string;
  status: string;
  createdAt: string;
  createdBy?: { id: number; fullName: string; role: string };
}

interface Appointment {
  id: number;
  patientId: number;
  appointmentDateTime: string;
  reason: string;
  status: string;
  createdAt: string;
  doctor?: { id: number; fullName: string; role: string };
}

interface Medication {
  id: number;
  name: string;
  dose: string;
  freq: string;
  route: string;
  color: string;
}

interface Patient {
  id: number;
  userId: number | null;
  patientCode: string;
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  age: number;
  maritalStatus: string;
  phone: string;
  address: string;
  employerName: string;
  employerAddress: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  bloodGroup: string;
  roomNumber: string;
  bedNumber: string;
  admissionDate: string | null;
  dischargeDate: string | null;
  isActive: boolean;
  vitalStatus: VitalStatus;
  createdAt?: string;
  updatedAt?: string;
}

const getErrorMessage = (error: unknown, fallback = "Request failed") =>
  error instanceof Error ? error.message : fallback;

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Spinner = ({ className = "w-5 h-5" }: { className?: string }) => (
  <Loader2 className={`${className} animate-spin text-blue-500`} />
);

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-200 flex items-center gap-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="text-xs underline whitespace-nowrap">Retry</button>}
    </div>
  );
}

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatientDashboardPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<ApiVital[]>([]);
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);
  const [dischargeSummaries, setDischargeSummaries] = useState<DischargeSummary[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  // ── Check session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const storedPatientId = localStorage.getItem("patientId");
    if (!storedPatientId) {
      router.push("/patient/login");
      return;
    }
    setPatientId(Number(storedPatientId));
  }, [router]);

  // ── Fetch all patient data ──────────────────────────────────────────────────
  const fetchAllData = useCallback(async (showSpinner = true) => {
    if (!patientId) return;
    
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setGlobalError("");

    try {
      // Fetch all endpoints in parallel
      const [
        patientRes,
        vitalsRes,
        notesRes,
        reportsRes,
        dischargeRes,
        plansRes,
        appointmentsRes
      ] = await Promise.all([
        apiFetch(`/api/patients/${patientId}`),
        apiFetch(`/api/patients/${patientId}/vitals?pageSize=50`).catch(() => ({ data: [] })),
        apiFetch(`/api/patients/${patientId}/progress-notes?pageSize=50`).catch(() => ({ data: [] })),
        apiFetch(`/api/patients/${patientId}/diagnostic-reports?pageSize=50`).catch(() => ({ data: [] })),
        apiFetch(`/api/patients/${patientId}/discharge-summaries?pageSize=50`).catch(() => ({ data: [] })),
        apiFetch(`/api/patients/${patientId}/treatment-plans?pageSize=50`).catch(() => ({ data: [] })),
        apiFetch(`/api/appointments?patientId=${patientId}&pageSize=50`).catch(() => ({ data: [] })),
      ]);

      setPatient(patientRes.data);
      setVitals(vitalsRes.data || []);
      setProgressNotes(notesRes.data || []);
      setDiagnosticReports(reportsRes.data || []);
      setDischargeSummaries(dischargeRes.data || []);
      setTreatmentPlans(plansRes.data || []);
      setAppointments(appointmentsRes.data || []);
      
    } catch (e: unknown) {
      const errorMessage = getErrorMessage(e, "Failed to load patient data");
      setGlobalError(errorMessage);
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("not found")) {
        localStorage.removeItem("patientId");
        localStorage.removeItem("patientCode");
        localStorage.removeItem("patientName");
        router.push("/patient/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (patientId) {
      fetchAllData();
    }
  }, [patientId, fetchAllData]);

  const handleRefresh = () => fetchAllData(false);

  const handleLogout = () => {
    localStorage.removeItem("patientId");
    localStorage.removeItem("patientCode");
    localStorage.removeItem("patientName");
    router.push("/patient/login");
  };

  // ── Display helpers ──────────────────────────────────────────────────────────
  const calcAge = (dob: string) => {
    const b = new Date(dob), t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const getStatusConfig = (status: VitalStatus | string) => {
    switch (status) {
      case "CRITICAL":   return { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    dot: "bg-rose-500",    badge: "bg-rose-100 text-rose-700 border-rose-200" };
      case "UNSTABLE":   return { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200" };
      case "STABLE":     return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "RECOVERING": return { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200" };
      default:           return { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const medColorMap: Record<string, { bg: string; text: string }> = {
    rose: { bg: "bg-rose-100", text: "text-rose-600" }, blue: { bg: "bg-blue-100", text: "text-blue-600" },
    amber: { bg: "bg-amber-100", text: "text-amber-600" }, emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" }, teal: { bg: "bg-teal-100", text: "text-teal-600" },
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-rose-500" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to load patient data</h2>
          <button 
            onClick={() => router.push("/admin/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const lastVital = vitals.length > 0 ? vitals[0] : null;
  const sc = getStatusConfig(patient.vitalStatus);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/20">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
                <p className="text-sm text-slate-500 font-mono">{patient.patientCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefresh} 
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition" 
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${sc.bg} border ${sc.border} mb-4`}>
            <div className={`w-2 h-2 rounded-full ${sc.dot} animate-pulse`} />
            <span className={`text-sm font-semibold ${sc.text}`}>
              Status: {patient.vitalStatus}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-600">
              Room {patient.roomNumber || "—"} • Bed {patient.bedNumber || "—"}
            </span>
            {!patient.isActive && (
              <>
                <span className="text-slate-300">|</span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-semibold border border-rose-200">
                  Discharged
                </span>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {([
              { key: "overview" as Tab, label: "Overview", icon: User },
              { key: "vitals" as Tab, label: "Vitals History", icon: Activity },
              { key: "notes" as Tab, label: "Doctor Notes", icon: FileText },
              { key: "medications" as Tab, label: "Medications", icon: Pill },
              { key: "reports" as Tab, label: "Reports & Plans", icon: FlaskConical },
            ]).map(({ key, label, icon: Icon }) => (
              <button 
                key={key} 
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {globalError && <div className="mb-4"><ErrorBanner message={globalError} onRetry={fetchAllData} /></div>}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Vitals */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Current Vitals
                      {lastVital && (
                        <span className="ml-auto text-xs font-normal text-slate-400 normal-case">
                          Updated {fmtDateTime(lastVital.recordedAt)}
                        </span>
                      )}
                    </h3>
                    
                    {lastVital ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                          <Heart className="w-5 h-5 text-rose-600 mb-2" />
                          <p className="text-[10px] text-slate-400 uppercase">Heart Rate</p>
                          <p className="text-lg font-bold text-slate-900">{lastVital.heartRate} bpm</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <Activity className="w-5 h-5 text-blue-600 mb-2" />
                          <p className="text-[10px] text-slate-400 uppercase">Blood Pressure</p>
                          <p className="text-lg font-bold text-slate-900">{lastVital.bloodPressure || "—"}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                          <Thermometer className="w-5 h-5 text-amber-600 mb-2" />
                          <p className="text-[10px] text-slate-400 uppercase">Temperature</p>
                          <p className="text-lg font-bold text-slate-900">{lastVital.temperature}°C</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <Wind className="w-5 h-5 text-emerald-600 mb-2" />
                          <p className="text-[10px] text-slate-400 uppercase">Oxygen Sat</p>
                          <p className="text-lg font-bold text-slate-900">{lastVital.oxygenSaturation}%</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No vitals recorded yet</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Notes Preview */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Recent Notes
                      </h3>
                      <button 
                        onClick={() => setActiveTab("notes")}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All →
                      </button>
                    </div>
                    
                    {progressNotes.length > 0 ? (
                      <div className="space-y-3">
                        {progressNotes.slice(0, 2).map((note) => (
                          <div key={note.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-slate-700">{note.author?.fullName || "Medical Staff"}</span>
                              <span className="text-xs text-slate-400">{fmtDateTime(note.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-sm">No notes available</div>
                    )}
                  </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                  {/* Personal Info */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Personal Information
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Date of Birth</p>
                          <p className="font-medium text-slate-900">{fmtDate(patient.dateOfBirth)}</p>
                          <p className="text-[10px] text-slate-500">{calcAge(patient.dateOfBirth)} years</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <Droplets className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Blood Group</p>
                          <p className="font-medium text-slate-900">{patient.bloodGroup}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Phone</p>
                          <p className="font-medium text-slate-900">{patient.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Address</p>
                          <p className="font-medium text-slate-900">{patient.address || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <Bed className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Room/Bed</p>
                          <p className="font-medium text-slate-900">{patient.roomNumber || "—"} / {patient.bedNumber || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <CalendarClock className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Admission</p>
                          <p className="font-medium text-slate-900">{fmtDate(patient.admissionDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Emergency Contact
                    </h3>
                    {patient.nextOfKinName ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{patient.nextOfKinName}</p>
                            <p className="text-xs text-slate-500">{patient.nextOfKinRelationship}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {patient.nextOfKinPhone}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">No emergency contact on file</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── VITALS TAB ── */}
            {activeTab === "vitals" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Vitals History</h3>
                  <p className="text-xs text-slate-500 mt-1">Complete history of your vital signs</p>
                </div>
                
                {vitals.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {vitals.map((v, i) => (
                      <div key={v.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{fmtDateTime(v.recordedAt)}</p>
                            <p className="text-xs text-slate-500">By: {v.recordedBy?.fullName || "Staff"} ({v.recordedBy?.role || "Medical"})</p>
                          </div>
                          {i === 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Latest</span>}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-xs">
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Heart Rate</span>
                            <span className="font-semibold text-slate-900">{v.heartRate ? `${v.heartRate} bpm` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">BP</span>
                            <span className="font-semibold text-slate-900">{v.bloodPressure || "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Temp</span>
                            <span className="font-semibold text-slate-900">{v.temperature ? `${v.temperature}°C` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">SpO2</span>
                            <span className="font-semibold text-slate-900">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Resp</span>
                            <span className="font-semibold text-slate-900">{v.respiratoryRate ? `${v.respiratoryRate}/min` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Pain</span>
                            <span className="font-semibold text-slate-900">{v.painScore != null ? `${v.painScore}/10` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Weight</span>
                            <span className="font-semibold text-slate-900">{v.weight ? `${v.weight}kg` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">Height</span>
                            <span className="font-semibold text-slate-900">{v.height ? `${v.height}cm` : "—"}</span>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-400 text-[10px] block">BMI</span>
                            <span className="font-semibold text-slate-900">{v.bmi || "—"}</span>
                          </div>
                        </div>
                        {v.notes && <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100 italic">{v.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>No vitals recorded yet</p>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES TAB ── */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                {progressNotes.length > 0 ? (
                  progressNotes.map((note) => (
                    <div key={note.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{note.author?.fullName || "Medical Staff"}</p>
                            <p className="text-xs text-slate-500">{note.author?.role} • {fmtDateTime(note.createdAt)}</p>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No Progress Notes</h3>
                    <p className="text-slate-500">Your doctor hasn&apos;t added any notes yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── MEDICATIONS TAB ── */}
            {activeTab === "medications" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Current Medications</h3>
                  <p className="text-xs text-slate-500 mt-1">Prescribed medications and instructions</p>
                </div>
                
                {medications.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {medications.map((med) => {
                      const mc = medColorMap[med.color] || medColorMap.blue;
                      return (
                        <div key={med.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                          <div className={`w-12 h-12 ${mc.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <Pill className={`w-6 h-6 ${mc.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900">{med.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{med.dose} • {med.freq} • {med.route}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">Active</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <Pill className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>No active medications</p>
                  </div>
                )}
              </div>
            )}

            {/* ── REPORTS TAB ── */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                {/* Diagnostic Reports */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-blue-600" />
                      Diagnostic Reports
                    </h3>
                  </div>
                  
                  {diagnosticReports.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {diagnosticReports.map((r) => (
                        <div key={r.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">{r.reportType}</span>
                                <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span>
                              </div>
                              <h4 className="font-semibold text-slate-900">{r.title}</h4>
                              {r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}
                            </div>
                            {r.fileUrl && (
                              <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition flex-shrink-0">
                                View
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">No diagnostic reports</div>
                  )}
                </div>

                {/* Treatment Plans */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Treatment Plans
                    </h3>
                  </div>
                  
                  {treatmentPlans.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {treatmentPlans.map((tp) => (
  <Link 
    key={tp.id} 
    href={`/patient/treatment-plans/${tp.id}`}
    className="px-6 py-4 hover:bg-slate-50 transition-colors block cursor-pointer border-b border-slate-100 last:border-0"
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{tp.status}</span>
      <span className="text-xs text-slate-400">Started {fmtDate(tp.startDate)}</span>
    </div>
    <p className="text-sm text-slate-700 line-clamp-2">{tp.description}</p>
    <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
      <ChevronRight className="w-3 h-3" />
      View Details
    </div>
  </Link>
))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">No treatment plans</div>
                  )}
                </div>

                {/* Discharge Summaries */}
                {dischargeSummaries.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Discharge Summaries
                      </h3>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                      {dischargeSummaries.map((ds) => (
                        <div key={ds.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500">Discharged: {fmtDate(ds.dischargeDate)}</span>
                            <span className="text-xs text-slate-400">By: {ds.createdBy?.fullName || "Staff"}</span>
                          </div>
                          <p className="font-semibold text-slate-900 mb-1">Diagnosis: {ds.dischargeDiagnosis}</p>
                          <p className="text-sm text-slate-600 mb-2">{ds.dischargeSummary}</p>
                          {ds.medicationsOnDischarge && (
                            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">Meds: {ds.medicationsOnDischarge}</p>
                          )}
                          {ds.followUpInstructions && (
                            <p className="text-xs text-amber-600 mt-2">Follow-up: {ds.followUpInstructions}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointments */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      Appointments
                    </h3>
                  </div>
                  
                  {appointments.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {appointments.map((a) => (
                        <div key={a.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{a.reason}</p>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDateTime(a.appointmentDateTime)}</p>
                            {a.doctor && <p className="text-xs text-slate-400 mt-0.5">Dr. {a.doctor.fullName}</p>}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${a.status === "SCHEDULED" ? "bg-amber-100 text-amber-700" : a.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">No appointments</div>
                  )}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

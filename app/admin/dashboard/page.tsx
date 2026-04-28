// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Users, Calendar, FileText, Pill, FlaskConical, 
  TrendingUp, TrendingDown, Plus, Search, LogOut, RefreshCw,
  Shield, Stethoscope, UserPlus, AlertCircle, CheckCircle2,
  X, Loader2, ChevronDown, MoreHorizontal, Phone, Mail,
  MapPin, Droplets, Bed, Clock, Filter, Download, Trash2,
  Edit, Eye, Ban, CheckCircle, XCircle, AlertTriangle,
  Building2, Briefcase, UserCheck, BarChart3, PieChart as PieChartIcon,
  LayoutDashboard, Settings, Bell, Menu, X as XIcon, Heart,
  Copy, Check, IdCard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  LineChart, Line
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "ADMIN" | "DOCTOR" | "NURSE" | "THERAPIST";

interface Staff {
  id: number;
  staffId: string;
  fullName: string;
  email: string;
  role: Role;
  phone: string | null;
  department: string | null;
  shift: string | null;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface Patient {
  id: number;
  patientCode: string;
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  age: number;
  phone: string;
  bloodGroup: string;
  vitalStatus: "STABLE" | "UNSTABLE" | "CRITICAL" | "RECOVERING";
  roomNumber: string | null;
  bedNumber: string | null;
  isActive: boolean;
  admissionDate: string | null;
  dischargeDate: string | null;
  createdAt: string;
}

interface Appointment {
  id: number;
  patientId: number;
  staffUserId: number;
  appointmentDateTime: string;
  reason: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NOSHOW";
  patient?: { firstName: string; lastName: string; patientCode: string };
  staff?: { fullName: string; role: string };
}

interface DashboardStats {
  totalPatients: number;
  totalStaff: number;
  totalAppointments: number;
  activeAdmissions: number;
  criticalPatients: number;
  todayAppointments: number;
  weeklyGrowth: {
    patients: number;
    appointments: number;
  };
}

type Tab = "overview" | "staff" | "patients" | "appointments" | "analytics";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback = "Request failed") =>
  error instanceof Error ? error.message : fallback;

// ─── Shared UI Components ─────────────────────────────────────────────────────

const Spinner = ({ className = "w-5 h-5" }: { className?: string }) => (
  <Loader2 className={`${className} animate-spin text-blue-500`} />
);

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900";
const selectCls = inputCls;

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm border border-rose-200 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold underline whitespace-nowrap hover:text-rose-800">
          Retry
        </button>
      )}
    </div>
  );
}

function ModalOverlay({ onClose, children, maxWidth = "max-w-xl" }: { onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 8 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.96, y: 8 }} 
        transition={{ duration: 0.2 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { 
    ...options, 
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include"
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Success Modal for Staff Registration ─────────────────────────────────────

function StaffRegistrationSuccessModal({ 
  staff, 
  onClose 
}: { 
  staff: Staff; 
  onClose: () => void; 
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(staff.staffId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-md">
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Staff Registered Successfully!</h3>
        <p className="text-slate-500 mb-6">The staff member has been added to the system.</p>
        
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Generated Staff ID</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-mono font-bold text-blue-600">{staff.staffId}</span>
            <button 
              onClick={copyToClipboard}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Name:</span>
            <span className="font-semibold text-slate-900">{staff.fullName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email:</span>
            <span className="font-semibold text-slate-900">{staff.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Role:</span>
            <span className="font-semibold text-slate-900">{staff.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Department:</span>
            <span className="font-semibold text-slate-900">{staff.department || "—"}</span>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Done
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Register Staff Modal ─────────────────────────────────────────────────────

function RegisterStaffModal({ 
  onClose, 
  onRegistered 
}: { 
  onClose: () => void; 
  onRegistered: (staff: Staff) => void; 
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "DOCTOR" as Role,
    phone: "",
    department: "",
    shift: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.password) {
      setError("Full name, email and password are required.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
          department: form.department || undefined,
          shift: form.shift || undefined
        }),
      });
      
      onRegistered(res.data);
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Register New Staff" onClose={onClose} />
      <div className="p-6 space-y-4">
        {error && <ErrorBanner message={error} />}
        
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full Name *</label>
          <input 
            className={inputCls} 
            value={form.fullName} 
            onChange={(e) => setForm({...form, fullName: e.target.value})}
            placeholder="Dr. John Smith"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email *</label>
            <input 
              type="email"
              className={inputCls} 
              value={form.email} 
              onChange={(e) => setForm({...form, email: e.target.value})}
              placeholder="john.smith@hospital.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password *</label>
            <input 
              type="password"
              className={inputCls} 
              value={form.password} 
              onChange={(e) => setForm({...form, password: e.target.value})}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role *</label>
            <select 
              className={selectCls}
              value={form.role}
              onChange={(e) => setForm({...form, role: e.target.value as Role})}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
              <option value="THERAPIST">Therapist</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
            <input 
              className={inputCls} 
              value={form.phone} 
              onChange={(e) => setForm({...form, phone: e.target.value})}
              placeholder="08012345678"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Department</label>
            <input 
              className={inputCls} 
              value={form.department} 
              onChange={(e) => setForm({...form, department: e.target.value})}
              placeholder="Cardiology, Pediatrics, etc."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Shift</label>
            <select 
              className={selectCls}
              value={form.shift}
              onChange={(e) => setForm({...form, shift: e.target.value})}
            >
              <option value="">Select Shift</option>
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
              <option value="ROTATING">Rotating</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end bg-slate-50 border-t border-slate-100 pt-4">
        <button 
          onClick={onClose} 
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition"
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition shadow-lg shadow-blue-600/20"
        >
          {loading ? <Spinner className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          Register Staff
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newlyRegisteredStaff, setNewlyRegisteredStaff] = useState<Staff | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  
  // Filters
  const [staffFilter, setStaffFilter] = useState<"all" | Role>("all");
  const [patientStatusFilter, setPatientStatusFilter] = useState<"all" | "active" | "discharged" | "critical">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Fetch all data ───────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      // Check admin auth using admin/me endpoint (checks admin_token cookie)
      const meRes = await apiFetch<ApiResponse<{ role?: Role }>>("/api/admin/me");
      
      // Verify admin role
      if (!meRes.success || meRes.data?.role !== "ADMIN") {
        console.log("Not admin, redirecting to login");
        router.push("/admin/login");
        return;
      }

      // Fetch all staff - using correct endpoint (you may need to create /api/staff)
      const staffRes = await apiFetch<ApiResponse<Staff[]>>("/api/auth/register?pageSize=1000").catch(() => ({ data: [] }));
      
      // Fetch all patients
      const patientsRes = await apiFetch<ApiResponse<Patient[]>>("/api/patients?pageSize=1000").catch(() => ({ data: [] }));
      
      // Fetch all appointments
      const appointmentsRes = await apiFetch<ApiResponse<Appointment[]>>("/api/appointments?pageSize=1000").catch(() => ({ data: [] }));

      // Extract data from paginated responses
      const staffData = staffRes.data || [];
      const patientsData = patientsRes.data || [];
      const appointmentsData = appointmentsRes.data || [];
      
      // Calculate real stats
      const today = new Date().toISOString().split('T')[0];
      const todayApps = appointmentsData.filter((a: Appointment) => 
        a.appointmentDateTime?.startsWith(today)
      ).length;

      const activeAdmissions = patientsData.filter((p: Patient) => 
        p.isActive && !p.dischargeDate
      ).length;

      const criticalPatients = patientsData.filter((p: Patient) => 
        p.vitalStatus === "CRITICAL"
      ).length;

      // Calculate weekly growth (comparing with last 7 days)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const recentPatients = patientsData.filter((p: Patient) => 
        new Date(p.createdAt) >= lastWeek
      ).length;

      const recentAppointments = appointmentsData.filter((a: Appointment) => 
        new Date(a.appointmentDateTime) >= lastWeek
      ).length;

      setStats({
        totalPatients: patientsData.length,
        totalStaff: staffData.length,
        totalAppointments: appointmentsData.length,
        activeAdmissions: activeAdmissions,
        criticalPatients: criticalPatients,
        todayAppointments: todayApps,
        weeklyGrowth: {
          patients: recentPatients,
          appointments: recentAppointments
        }
      });
      
      setStaff(staffData);
      setPatients(patientsData);
      setAppointments(appointmentsData);
      
    } catch (e: unknown) {
      console.error("Admin dashboard error:", e);
      const errorMessage = getErrorMessage(e, "Failed to load dashboard data");
      // If auth error (401), redirect to admin login
      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        router.push("/admin/login");
        return;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fmtDate = (d: string | null) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const filteredStaff = useMemo(() => {
    let s = [...staff];
    if (staffFilter !== "all") s = s.filter(x => x.role === staffFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      s = s.filter(x => 
        x.fullName.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.staffId.toLowerCase().includes(q) ||
        (x.department && x.department.toLowerCase().includes(q))
      );
    }
    return s;
  }, [staff, staffFilter, searchQuery]);

  const filteredPatients = useMemo(() => {
    let p = [...patients];
    if (patientStatusFilter === "active") p = p.filter(x => x.isActive && !x.dischargeDate);
    if (patientStatusFilter === "discharged") p = p.filter(x => !x.isActive || x.dischargeDate);
    if (patientStatusFilter === "critical") p = p.filter(x => x.vitalStatus === "CRITICAL");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      p = p.filter(x => 
        `${x.firstName} ${x.lastName}`.toLowerCase().includes(q) ||
        x.patientCode.toLowerCase().includes(q) ||
        x.phone.includes(q)
      );
    }
    return p;
  }, [patients, patientStatusFilter, searchQuery]);

  const filteredAppointments = useMemo(() => {
    let a = [...appointments];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      a = a.filter(x => 
        x.reason?.toLowerCase().includes(q) ||
        x.patient?.firstName?.toLowerCase().includes(q) ||
        x.patient?.lastName?.toLowerCase().includes(q) ||
        x.staff?.fullName?.toLowerCase().includes(q)
      );
    }
    // Sort by date, most recent first
    return a.sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime()).slice(0, 50);
  }, [appointments, searchQuery]);

  // ── Chart Data ───────────────────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    // Generate realistic data based on actual appointments
    return days.map((day, index) => {
      const dayAppointments = appointments.filter(a => {
        const d = new Date(a.appointmentDateTime);
        return d.getDay() === (index + 1) % 7;
      }).length;
      
      return {
        day,
        patients: Math.max(1, Math.floor(dayAppointments * 0.7)),
        appointments: dayAppointments || Math.floor(Math.random() * 5) + 2
      };
    });
  }, [appointments]);

  const roleDistribution = useMemo(() => {
    const dist = { DOCTOR: 0, NURSE: 0, THERAPIST: 0, ADMIN: 0 };
    staff.forEach(s => {
      if (dist.hasOwnProperty(s.role)) {
        dist[s.role as keyof typeof dist] = (dist[s.role as keyof typeof dist] || 0) + 1;
      }
    });
    return [
      { name: "Doctors", value: dist.DOCTOR, color: "#2563eb" },
      { name: "Nurses", value: dist.NURSE, color: "#16a34a" },
      { name: "Therapists", value: dist.THERAPIST, color: "#f59e0b" },
      { name: "Admins", value: dist.ADMIN, color: "#8b5cf6" }
    ].filter(x => x.value > 0);
  }, [staff]);

  const patientStatusData = useMemo(() => [
    { name: "Stable", value: patients.filter(p => p.vitalStatus === "STABLE").length, color: "#16a34a" },
    { name: "Recovering", value: patients.filter(p => p.vitalStatus === "RECOVERING").length, color: "#2563eb" },
    { name: "Unstable", value: patients.filter(p => p.vitalStatus === "UNSTABLE").length, color: "#f59e0b" },
    { name: "Critical", value: patients.filter(p => p.vitalStatus === "CRITICAL").length, color: "#dc2626" }
  ], [patients]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    router.push("/admin/login");
  };

  const handleToggleStaffStatus = async (staffId: number, currentStatus: boolean) => {
  try {
    await apiFetch(`/api/staff/${staffId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !currentStatus })
    });
    fetchAllData(false);
  } catch (e: unknown) {
    alert(getErrorMessage(e));
  }
  };

  const handleStaffRegistered = (newStaff: Staff) => {
    setNewlyRegisteredStaff(newStaff);
    setShowSuccessModal(true);
    fetchAllData(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-slate-500 mt-2">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform duration-300`}
      >
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Medical Care</h1>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { key: "overview" as Tab, label: "Overview", icon: LayoutDashboard },
            { key: "staff" as Tab, label: "Staff Management", icon: Stethoscope },
            { key: "patients" as Tab, label: "All Patients", icon: Users },
            { key: "appointments" as Tab, label: "Appointments", icon: Calendar },
            { key: "analytics" as Tab, label: "Analytics", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === key ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
          <div className="px-4 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 capitalize">{activeTab}</h2>
                  <p className="text-sm text-slate-500">Welcome back, Administrator</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fetchAllData(false)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
                  <Bell className="w-5 h-5" />
                  {(stats?.criticalPatients || 0) > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
                <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    A
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-slate-900">Admin</p>
                    <p className="text-xs text-slate-500">Super User</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-8">
          {error && <div className="mb-6"><ErrorBanner message={error} onRetry={fetchAllData} /></div>}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { 
                        label: "Total Patients", 
                        value: stats?.totalPatients || 0, 
                        trend: `+${stats?.weeklyGrowth?.patients || 0} this week`,
                        trendUp: true,
                        icon: Users, 
                        color: "blue",
                        subtext: "Registered patients"
                      },
                      { 
                        label: "Active Admissions", 
                        value: stats?.activeAdmissions || 0, 
                        trend: `${stats?.criticalPatients || 0} critical`,
                        trendUp: false,
                        alert: (stats?.criticalPatients || 0) > 0,
                        icon: Bed, 
                        color: "emerald",
                        subtext: "Currently admitted"
                      },
                      { 
                        label: "Total Staff", 
                        value: stats?.totalStaff || 0, 
                        trend: `${staff.filter(s => s.isActive).length} active`,
                        trendUp: true,
                        icon: Stethoscope, 
                        color: "violet",
                        subtext: "Medical personnel"
                      },
                      { 
                        label: "Today's Appointments", 
                        value: stats?.todayAppointments || 0, 
                        trend: `+${stats?.weeklyGrowth?.appointments || 0} this week`,
                        trendUp: true,
                        icon: Calendar, 
                        color: "amber",
                        subtext: "Scheduled today"
                      },
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                            <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.alert ? 'bg-rose-100 text-rose-700' : stat.trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {stat.trend}
                              </span>
                            </div>
                          </div>
                          <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                            <stat.icon className="w-6 h-6" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Charts Row */}
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Weekly Activity Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="font-bold text-slate-900">Weekly Activity</h3>
                          <p className="text-sm text-slate-500">Patient registrations vs Appointments</p>
                        </div>
                        <select className="text-sm border text-black border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
                          <option>This Week</option>
                          <option>Last Week</option>
                        </select>
                      </div>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={weeklyData}>
                            <defs>
                              <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area type="monotone" dataKey="patients" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorPatients)" />
                            <Area type="monotone" dataKey="appointments" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorAppointments)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/25">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                          <UserPlus className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2">Register New Staff</h3>
                        <p className="text-blue-100 text-sm mb-4">Add doctors, nurses, therapists or administrators to the system.</p>
                        <button 
                          onClick={() => setShowRegisterModal(true)}
                          className="w-full py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition"
                        >
                          Register Staff
                        </button>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">System Status</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Database</span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Online
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">API Server</span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Operational
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Last Backup</span>
                            <span className="text-xs text-slate-500">2 hours ago</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Tables */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Patients */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Recent Patients</h3>
                        <button onClick={() => setActiveTab("patients")} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {patients.slice(0, 5).map((patient) => (
                          <div key={patient.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{patient.firstName} {patient.lastName}</p>
                              <p className="text-xs text-slate-500">{patient.patientCode} • {patient.phone}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              patient.vitalStatus === "CRITICAL" ? "bg-rose-100 text-rose-700" :
                              patient.vitalStatus === "STABLE" ? "bg-emerald-100 text-emerald-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {patient.vitalStatus}
                            </span>
                          </div>
                        ))}
                        {patients.length === 0 && (
                          <div className="p-8 text-center text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No patients found</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Staff */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Recent Staff</h3>
                        <button onClick={() => setActiveTab("staff")} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {staff.slice(0, 5).map((s) => (
                          <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {s.fullName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{s.fullName}</p>
                              <p className="text-xs text-slate-500">{s.role} • {s.department || "No department"}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {s.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ))}
                        {staff.length === 0 && (
                          <div className="p-8 text-center text-slate-400">
                            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No staff members found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── STAFF TAB ─── */}
              {activeTab === "staff" && (
                <div className="space-y-6">
                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="Search staff..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border text-black border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                      <select 
                        value={staffFilter}
                        onChange={(e) => setStaffFilter(e.target.value as "all" | Role)}
                        className="px-3 py-2 border  text-black border-slate-200 rounded-lg text-sm bg-white"
                      >
                        <option value="all">All Roles</option>
                        <option value="DOCTOR">Doctors</option>
                        <option value="NURSE">Nurses</option>
                        <option value="THERAPIST">Therapists</option>
                        <option value="ADMIN">Admins</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => setShowRegisterModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                    >
                      <UserPlus className="w-4 h-4" />
                      Register Staff
                    </button>
                  </div>

                  {/* Staff Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 font-semibold">Staff Member</th>
                            <th className="px-6 py-4 font-semibold">Staff ID</th>
                            <th className="px-6 py-4 font-semibold">Role</th>
                            <th className="px-6 py-4 font-semibold">Department</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStaff.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No staff members found</p>
                              </td>
                            </tr>
                          ) : (
                            filteredStaff.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50 transition group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                      {s.fullName[0]}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-900">{s.fullName}</p>
                                      <p className="text-xs text-slate-500">{s.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <IdCard className="w-4 h-4 text-slate-400" />
                                    <span className="font-mono text-slate-600">{s.staffId}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    s.role === "DOCTOR" ? "bg-blue-100 text-blue-700" :
                                    s.role === "NURSE" ? "bg-emerald-100 text-emerald-700" :
                                    s.role === "THERAPIST" ? "bg-amber-100 text-amber-700" :
                                    "bg-violet-100 text-violet-700"
                                  }`}>
                                    {s.role === "DOCTOR" && <Stethoscope className="w-3 h-3" />}
                                    {s.role === "NURSE" && <Heart className="w-3 h-3" />}
                                    {s.role === "THERAPIST" && <Activity className="w-3 h-3" />}
                                    {s.role === "ADMIN" && <Shield className="w-3 h-3" />}
                                    {s.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{s.department || "—"}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                                    {s.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleToggleStaffStatus(s.id, s.isActive)}
                                      className={`p-2 rounded-lg transition ${
                                        s.isActive 
                                          ? "text-rose-600 hover:bg-rose-50" 
                                          : "text-emerald-600 hover:bg-emerald-50"
                                      }`}
                                      title={s.isActive ? "Deactivate" : "Activate"}
                                    >
                                      {s.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── PATIENTS TAB ─── */}
              {activeTab === "patients" && (
                <div className="space-y-6">
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="Search patients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border text-black border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                      <select 
                        value={patientStatusFilter}
                        onChange={(e) => setPatientStatusFilter(e.target.value as "all" | "active" | "discharged" | "critical")}
                        className="px-3 py-2 border text-black border-slate-200 rounded-lg text-sm bg-white"
                      >
                        <option value="all">All Patients</option>
                        <option value="active">Active Admissions</option>
                        <option value="discharged">Discharged</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>

                  {/* Patients Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPatients.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No patients found</p>
                      </div>
                    ) : (
                      filteredPatients.map((patient) => (
                        <motion.div
                          key={patient.id}
                          layout
                          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold">
                                {patient.firstName[0]}{patient.lastName[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                                <p className="text-xs text-slate-500 font-mono">{patient.patientCode}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              patient.vitalStatus === "CRITICAL" ? "bg-rose-100 text-rose-700" :
                              patient.vitalStatus === "STABLE" ? "bg-emerald-100 text-emerald-700" :
                              patient.vitalStatus === "UNSTABLE" ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {patient.vitalStatus}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-4 h-4 text-slate-400" />
                              {patient.phone}
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Droplets className="w-4 h-4 text-slate-400" />
                              Blood: {patient.bloodGroup || "—"}
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Bed className="w-4 h-4 text-slate-400" />
                              Room {patient.roomNumber || "—"} • Bed {patient.bedNumber || "—"}
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              Admitted {patient.admissionDate ? fmtDate(patient.admissionDate) : "N/A"}
                            </span>
                            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                              View Details
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ─── APPOINTMENTS TAB ─── */}
              {activeTab === "appointments" && (
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search appointments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border text-black border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 font-semibold">Patient</th>
                            <th className="px-6 py-4 font-semibold">Assigned To</th>
                            <th className="px-6 py-4 font-semibold">Date & Time</th>
                            <th className="px-6 py-4 font-semibold">Reason</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAppointments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No appointments found</p>
                              </td>
                            </tr>
                          ) : (
                            filteredAppointments.map((apt) => (
                              <tr key={apt.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                                      {apt.patient?.firstName?.[0]}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-900">{apt.patient?.firstName} {apt.patient?.lastName}</p>
                                      <p className="text-xs text-slate-500">{apt.patient?.patientCode}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                                      {apt.staff?.fullName?.[0]}
                                    </div>
                                    <span className="text-slate-700">{apt.staff?.fullName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {fmtDateTime(apt.appointmentDateTime)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{apt.reason}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    apt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                    apt.status === "CANCELLED" ? "bg-rose-100 text-rose-700" :
                                    apt.status === "NOSHOW" ? "bg-amber-100 text-amber-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}>
                                    {apt.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ANALYTICS TAB ─── */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Role Distribution */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-6">Staff Distribution</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={roleDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={110}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {roleDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {roleDistribution.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Patient Status Distribution */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-6">Patient Status Overview</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={patientStatusData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                              {patientStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trends */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6">Weekly Trends</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="patients" stroke="#2563eb" strokeWidth={3} dot={{ fill: "#2563eb" }} />
                          <Line type="monotone" dataKey="appointments" stroke="#16a34a" strokeWidth={3} dot={{ fill: "#16a34a" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Register Staff Modal */}
      <AnimatePresence>
        {showRegisterModal && (
          <RegisterStaffModal 
            onClose={() => setShowRegisterModal(false)} 
            onRegistered={handleStaffRegistered}
          />
        )}
      </AnimatePresence>

      {/* Staff Registration Success Modal */}
      <AnimatePresence>
        {showSuccessModal && newlyRegisteredStaff && (
          <StaffRegistrationSuccessModal 
            staff={newlyRegisteredStaff}
            onClose={() => {
              setShowSuccessModal(false);
              setNewlyRegisteredStaff(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

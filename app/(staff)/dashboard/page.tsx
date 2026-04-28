"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
  Bell,
  Calendar,
  User,
  FileText,
  Activity,
  Stethoscope,
  ClipboardList,
  ChevronRight,
  MapPin,
  Droplets,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Circle,
  Plus,
  Filter,
  RefreshCw,
  Heart,
  Thermometer,
  Pill,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Types (aligned with your Prisma schema)
type Role = "ADMIN" | "DOCTOR" | "NURSE" | "THERAPIST" | "PATIENT";
type Shift = "MORNING" | "AFTERNOON" | "NIGHT";
type VitalStatus = "STABLE" | "UNSTABLE" | "CRITICAL" | "RECOVERING";
type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "IN_PROGRESS";
type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type TaskType = "VITAL_CHECK" | "MEDICATION" | "REVIEW" | "DOCUMENTATION" | "FOLLOW_UP" | "THERAPY_SESSION" | "DISCHARGE_PLANNING";

type UserData = {
  id: number;
  fullName: string;
  email?: string;
  role: Role;
  department?: string;
  shift?: Shift;
  staffId?: string;
};

type Vital = {
  id: number;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  recordedAt?: string;
  recordedBy?: { fullName: string };
};

type Patient = {
  id: number;
  patientCode?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  roomNumber?: string;
  bedNumber?: string;
  vitalStatus?: VitalStatus;
  isActive?: boolean;
  vitals?: Vital[];
  pendingTasksCount?: number;
};

type Appointment = {
  id: number;
  patientId?: number;
  patient?: Patient;
  staffUserId?: number;
  appointmentDateTime: string;
  reason?: string;
  status?: AppointmentStatus;
  notes?: string;
  priority?: TaskPriority;
  duration?: number;
  time?: string;
  fullName?: string;
};

type Task = {
  id: number;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  patientId?: number;
  patient?: {
    id: number;
    firstName: string;
    lastName: string;
    patientCode?: string;
    roomNumber?: string;
    bedNumber?: string;
    vitalStatus?: VitalStatus;
  };
  assignedTo?: number;
  dueTime?: string;
  completedAt?: string;
  createdAt?: string;
  patientFullName?: string;
};

type Alert = {
  id: number;
  patientName: string;
  patientCode?: string;
  room?: string;
  bed?: string;
  status: VitalStatus;
  lastVitals?: Vital;
};

type Stats = {
  patientsSeenToday: number;
  pendingTasks: number;
  criticalPatients: number;
  totalMyPatients?: number;
  completedTasksToday?: number;
  appointmentsTodayTotal?: number;
};

type DashboardData = {
  me: UserData;
  patients: Patient[];
  appointments: Appointment[];
  tasks: Task[];
  alerts: Alert[];
  stats: Stats;
};

export default function ClinicalDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [me, setMe] = useState<UserData | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      if (!showRefreshing) setLoading(true);
      
      const response = await fetch("/api/clinical/dashboard", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please login again.");
          router.push("/login");
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch dashboard data");
      }

      if (result.data) {
        const data: DashboardData = result.data;
        
        // Ensure patients have fullName
        const processedPatients = (data.patients || []).map((p: Patient) => ({
          ...p,
          fullName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        }));
        
        // Ensure appointments have proper patient data
        const processedAppointments = (data.appointments || []).map((a: Appointment) => ({
          ...a,
          patient: a.patient ? {
            ...a.patient,
            fullName: a.patient.fullName || `${a.patient.firstName || ''} ${a.patient.lastName || ''}`.trim(),
          } : undefined,
        }));
        
        // Ensure tasks have proper patient data
        const processedTasks = (data.tasks || []).map((t: Task) => ({
          ...t,
          patient: t.patient ? {
            ...t.patient,
            fullName: t.patientFullName || `${t.patient.firstName || ''} ${t.patient.lastName || ''}`.trim(),
          } : undefined,
        }));

        setMe(data.me);
        setPatients(processedPatients);
        setAppointments(processedAppointments);
        setTasks(processedTasks);
        setAlerts(data.alerts || []);
        setStats(data.stats);
      } else {
        throw new Error("No data received from server");
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, [router]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const isDoctor = me?.role === "DOCTOR";
  const isNurse = me?.role === "NURSE";
  const isTherapist = me?.role === "THERAPIST";
  const isAdmin = me?.role === "ADMIN";

  // Filtered data
  const todayAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => 
      new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime()
    );
  }, [appointments]);

  const pendingTasks = tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS");
  const criticalAlerts = alerts.filter(a => a.status === "CRITICAL");

  const filteredPatients = patients.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(searchLower) ||
      p.roomNumber?.toLowerCase().includes(searchLower) ||
      p.patientCode?.toLowerCase().includes(searchLower) ||
      p.firstName?.toLowerCase().includes(searchLower) ||
      p.lastName?.toLowerCase().includes(searchLower)
    );
  });

  // Task completion handler
  const handleTaskComplete = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update task");
      }

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: "COMPLETED", completedAt: new Date().toISOString() } : t
        ));
        toast.success("Task completed!");
        
        // Refresh dashboard data
        setTimeout(() => fetchDashboardData(), 500);
      }
    } catch (error) {
      console.error("Task completion error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to complete task");
    }
  };

  const getVitalColor = (status?: VitalStatus) => {
    switch (status) {
      case "CRITICAL": return "bg-red-500 text-white";
      case "UNSTABLE": return "bg-amber-500 text-white";
      case "RECOVERING": return "bg-blue-500 text-white";
      default: return "bg-emerald-500 text-white";
    }
  };

  const getPriorityColor = (priority?: TaskPriority) => {
    switch (priority) {
      case "URGENT": return "text-red-600 bg-red-50 border-red-200";
      case "HIGH": return "text-amber-600 bg-amber-50 border-amber-200";
      case "NORMAL": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const getTaskTypeIcon = (type: TaskType) => {
    switch (type) {
      case "VITAL_CHECK": return <Activity className="h-4 w-4" />;
      case "MEDICATION": return <Pill className="h-4 w-4" />;
      case "REVIEW": return <FileText className="h-4 w-4" />;
      case "THERAPY_SESSION": return <Stethoscope className="h-4 w-4" />;
      case "DOCUMENTATION": return <ClipboardList className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors closeButton />
      
      {/* Top Navigation Bar */}
      {/* Modern Responsive Top Navigation */}
<header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
  <div className="flex items-center justify-between px-3 py-2.5 lg:px-6 lg:py-3">
    
    {/* Left: Logo/Mobile Menu + Welcome (Desktop) */}
    <div className="flex items-center gap-3">
      {/* Mobile Menu Button */}
      <button className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Desktop Welcome */}
      <div className="hidden lg:block">
        <h1 className="text-base font-semibold text-slate-900">
          Good {me?.shift === "MORNING" ? "Morning" : me?.shift === "AFTERNOON" ? "Afternoon" : "Evening"}
          {me?.fullName && `, ${me.fullName.split(" ")[0]}`}
        </h1>
        <p className="text-xs text-slate-500">
          {isDoctor && "Patient rounds & consultations"}
          {isNurse && "Assigned patients & care tasks"}
          {isTherapist && "Therapy sessions today"}
          {isAdmin && "Hospital overview"}
        </p>
      </div>
    </div>

    {/* Center: Search (Adapts to screen) */}
    <div className="flex-1 max-w-md mx-2 lg:mx-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 lg:h-10 pl-9 pr-8 rounded-lg lg:rounded-xl border text-black border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>

    {/* Right: Actions + Profile */}
    <div className="flex items-center gap-1 lg:gap-3">
      {/* Refresh - Hidden on smallest screens */}
      <button 
        onClick={() => fetchDashboardData(true)}
        className={`hidden sm:flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition ${refreshing ? 'animate-spin' : ''}`}
        disabled={refreshing}
        title="Refresh"
      >
        <RefreshCw className="h-4 w-4 lg:h-5 lg:w-5" />
      </button>
      
      {/* Notifications */}
      <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">
        <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
        {criticalAlerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
        )}
      </button>
      
      {/* Profile - Compact on mobile */}
      <div className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-slate-200">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-medium text-slate-900 leading-tight">{me?.fullName || "..."}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">{me?.role}</p>
        </div>
        <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm lg:text-base shadow-sm">
          {me?.fullName?.[0] || "?"}
        </div>
      </div>
    </div>
  </div>
  
  {/* Mobile-Only: Role indicator bar */}
  <div className="lg:hidden px-3 py-1.5 bg-slate-50 border-t border-slate-100">
    <p className="text-xs text-slate-600 truncate">
      <span className="font-medium">{me?.fullName}</span>
      <span className="mx-1.5 text-slate-400">•</span>
      <span className="text-slate-500">
        {isDoctor && "Patient rounds"}
        {isNurse && "Care tasks"}
        {isTherapist && "Therapy sessions"}
        {isAdmin && "Hospital overview"}
      </span>
    </p>
  </div>
</header>

      <main className="p-4 lg:p-6 max-w-[1600px] mx-auto">
        {/* Debug info - remove after testing */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            Status: {loading ? "Loading" : "Ready"} | 
            Patients: {patients.length} | 
            Appointments: {appointments.length} | 
            Tasks: {tasks.length} | 
            Alerts: {alerts.length}
          </div>
        )}

        {/* Critical Alerts Banner */}
        {criticalAlerts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-3"
          >
            {criticalAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">
                    Critical: {alert.patientName}
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Room {alert.room}, Bed {alert.bed} • Status: {alert.status}
                    {alert.lastVitals && (
                      <span className="block mt-1">
                        BP: {alert.lastVitals.bloodPressure}, HR: {alert.lastVitals.heartRate}, Temp: {alert.lastVitals.temperature}°C
                      </span>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => router.push(`/patients/${alert.id}`)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                >
                  Respond
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {/* Main Layout: 3 Columns on Desktop */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Column: Today's Schedule (5 cols) */}
          <div className="xl:col-span-5 space-y-6">
            {/* Schedule Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Schedule</h2>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">
                  <Filter className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => router.push("/appointments")}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New</span>
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
                    <Skeleton height={80} />
                  </div>
                ))
              ) : todayAppointments.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                  <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No appointments scheduled</p>
                  <p className="text-sm text-slate-400 mt-1">Your day is clear for walk-ins</p>
                </div>
              ) : (
                todayAppointments.map((apt, index) => {
                  const time = new Date(apt.appointmentDateTime);
                  const isPast = time < new Date();
                  const isNext = index === 0 && !isPast;
                  
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => apt.patient && setSelectedPatient(apt.patient)}
                      className={`group relative bg-white rounded-xl p-4 border-2 cursor-pointer transition-all hover:shadow-md ${
                        isNext ? "border-blue-500 shadow-md" : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {isNext && (
                        <div className="absolute -top-3 left-4 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          Next
                        </div>
                      )}
                      
                      <div className="flex gap-4">
                        {/* Time Column */}
                        <div className="flex flex-col items-center min-w-[60px]">
                          <span className={`text-lg font-bold ${isPast ? "text-slate-400" : "text-slate-900"}`}>
                            {apt.time || time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-xs text-slate-500">{apt.duration || 30}m</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-900 truncate">
                                {apt.patient?.fullName || "Unknown Patient"}
                              </h3>
                              <p className="text-sm text-slate-500 mt-0.5">{apt.reason || "No reason provided"}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(apt.priority)}`}>
                              {apt.priority || "NORMAL"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              Room {apt.patient?.roomNumber || "N/A"}
                            </span>
                            {apt.patient?.bloodGroup && (
                              <span className="flex items-center gap-1">
                                <Droplets className="h-3.5 w-3.5" />
                                {apt.patient.bloodGroup}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Indicator */}
                        <div className="self-center">
                          {apt.status === "COMPLETED" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : apt.status! === "IN_PROGRESS" ? (
                            <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Quick Stats for Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <User className="h-4 w-4" />
                  Patients Seen
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? <Skeleton width={40} /> : stats?.patientsSeenToday ?? 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">Today</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <ClipboardList className="h-4 w-4" />
                  Pending Tasks
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? <Skeleton width={40} /> : stats?.pendingTasks ?? 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">Requires attention</p>
              </div>
            </div>
          </div>

          {/* Middle Column: My Patients (4 cols) */}
          <div className="xl:col-span-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {isNurse ? "Assigned Patients" : "My Patients"}
                {stats?.totalMyPatients !== undefined && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({stats.totalMyPatients})
                  </span>
                )}
              </h2>
              <Link href="/patients" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
                    <Skeleton height={100} />
                  </div>
                ))
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                  <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    {searchQuery ? "No patients match your search" : "No patients assigned yet"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {searchQuery ? "Try a different search term" : "Check back later or contact admin"}
                  </p>
                </div>
              ) : (
                filteredPatients.map((patient, index) => (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedPatient(patient)}
                    className="group bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* Patient Avatar with Vital Indicator */}
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-lg">
                          {patient.firstName?.[0] || "?"}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${getVitalColor(patient.vitalStatus)}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900 truncate">{patient.fullName || "Unknown"}</h3>
                            <p className="text-sm text-slate-500">
                              {patient.sex ? `${patient.sex}, ` : ""}
                              {calculateAge(patient.dateOfBirth)} years
                              {patient.bloodGroup ? ` • ${patient.bloodGroup}` : ""}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVitalColor(patient.vitalStatus)}`}>
                            {patient.vitalStatus || "STABLE"}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {patient.roomNumber ? `${patient.roomNumber}-${patient.bedNumber || "?"}` : "No room"}
                          </span>
                          {patient.vitals && patient.vitals[0]?.recordedAt && (
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Activity className="h-3.5 w-3.5" />
                              {new Date(patient.vitals[0].recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Latest Vitals Preview */}
                        {patient.vitals && patient.vitals[0] && (
                          <div className="flex gap-3 mt-3 text-xs text-slate-600">
                            {patient.vitals[0].bloodPressure && <span>BP: {patient.vitals[0].bloodPressure}</span>}
                            {patient.vitals[0].heartRate && <span>HR: {patient.vitals[0].heartRate}</span>}
                            {patient.vitals[0].temperature && <span>Temp: {patient.vitals[0].temperature}°C</span>}
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/patients/${patient.id}/vitals`);
                            }}
                            className="flex-1 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                          >
                            Vitals
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/patients/${patient.id}/notes`);
                            }}
                            className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                          >
                            Notes
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/patients/${patient.id}`);
                            }}
                            className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Tasks & Quick Actions (3 cols) */}
          <div className="xl:col-span-3 space-y-6">
            {/* Tasks */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">My Tasks</h2>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                  {pendingTasks.length} pending
                </span>
              </div>
              
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="p-4">
                      <Skeleton height={40} />
                    </div>
                  ))
                ) : tasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">All caught up!</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className={`p-4 flex items-start gap-3 hover:bg-slate-50 transition ${
                        task.status === "COMPLETED" ? 'opacity-50' : ''
                      }`}
                    >
                      <button 
                        onClick={() => task.status !== "COMPLETED" && handleTaskComplete(task.id)}
                        disabled={task.status === "COMPLETED"}
                        className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition ${
                          task.status === "COMPLETED"
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-slate-300 hover:border-blue-500'
                        }`}
                      >
                        {task.status === "COMPLETED" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`${task.status === "COMPLETED" ? 'text-slate-400' : 'text-slate-900'}`}>
                            {getTaskTypeIcon(task.type)}
                          </span>
                          <p className={`text-sm font-medium ${task.status === "COMPLETED" ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {task.title}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {task.patient ? `${task.patient.firstName} ${task.patient.lastName}` : 'No patient'} 
                          {task.dueTime && ` • Due ${new Date(task.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      
                      {task.priority === "URGENT" && task.status !== "COMPLETED" && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
                          URGENT
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              {pendingTasks.length > 0 && (
                <div className="p-3 border-t border-slate-200 bg-slate-50">
                  <Link href="/tasks" className="w-full text-center text-sm text-blue-600 font-medium hover:text-blue-700 block">
                    View all tasks
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => router.push("/vitals")}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
                >
                  <div className="h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <Heart className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">Record Vitals</span>
                </button>
                
                <button 
                  onClick={() => router.push("/notes/new")}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">Add Note</span>
                </button>
                
                <button 
                  onClick={() => router.push("/diagnostics")}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
                >
                  <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Pill className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">Medication</span>
                </button>
                
                <button 
                  onClick={() => router.push("/treatment-plans")}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
                >
                  <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">Order Labs</span>
                </button>
              </div>
            </div>

            {/* Shift Info */}
            {me?.shift && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-200" />
                  <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Current Shift</span>
                </div>
                <p className="text-lg font-semibold">{me.shift} Shift</p>
                <p className="text-sm text-blue-100 mt-1">
                  {me.shift === "MORNING" ? "8:00 AM - 4:00 PM" : 
                   me.shift === "AFTERNOON" ? "4:00 PM - 12:00 AM" : 
                   "12:00 AM - 8:00 AM"}
                </p>
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-sm">
                  <span className="text-blue-100">Critical Patients</span>
                  <span className="font-semibold">{stats?.criticalPatients || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Patient Detail Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <PatientDetailModal 
            patient={selectedPatient} 
            onClose={() => setSelectedPatient(null)} 
            role={me?.role}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Patient Detail Modal Component
function PatientDetailModal({ patient, onClose, role }: { patient: Patient; onClose: () => void; role?: Role }) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "VITALS" | "NOTES" | "ORDERS">("OVERVIEW");
  const [loading, setLoading] = useState(false);
  const [fullPatient, setFullPatient] = useState<Patient | null>(null);
  const router = useRouter();

  // Fetch full patient details when modal opens
  useEffect(() => {
    const fetchPatientDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/patients/${patient.id}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setFullPatient({
              ...data.data,
              fullName: `${data.data.firstName || ''} ${data.data.lastName || ''}`.trim(),
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch patient details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientDetails();
  }, [patient.id]);

  const displayPatient = fullPatient || patient;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-2xl">
              {displayPatient.firstName?.[0] || "?"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{displayPatient.fullName || "Unknown Patient"}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span>
                  {displayPatient.sex ? `${displayPatient.sex}, ` : ""}
                  {calculateAge(displayPatient.dateOfBirth)} years
                </span>
                {displayPatient.bloodGroup && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3.5 w-3.5" />
                      {displayPatient.bloodGroup}
                    </span>
                  </>
                )}
                {displayPatient.roomNumber && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Room {displayPatient.roomNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <XCircle className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-6">
            {(["OVERVIEW", "VITALS", "NOTES", "ORDERS"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === tab 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="space-y-4">
              <Skeleton height={80} />
              <Skeleton height={120} />
            </div>
          ) : (
            <>
              {activeTab === "OVERVIEW" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500 mb-1">Patient Code</p>
                      <p className="font-semibold text-slate-900">{displayPatient.patientCode || "N/A"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500 mb-1">Vital Status</p>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getVitalColor(displayPatient.vitalStatus)}`}>
                        {displayPatient.vitalStatus || "STABLE"}
                      </span>
                    </div>
                  </div>
                  
                  {displayPatient.vitals && displayPatient.vitals[0] && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="font-semibold text-slate-900 mb-3">Latest Vitals</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {displayPatient.vitals[0].bloodPressure && (
                          <div>
                            <p className="text-slate-500">Blood Pressure</p>
                            <p className="font-semibold">{displayPatient.vitals[0].bloodPressure}</p>
                          </div>
                        )}
                        {displayPatient.vitals[0].heartRate && (
                          <div>
                            <p className="text-slate-500">Heart Rate</p>
                            <p className="font-semibold">{displayPatient.vitals[0].heartRate} bpm</p>
                          </div>
                        )}
                        {displayPatient.vitals[0].temperature && (
                          <div>
                            <p className="text-slate-500">Temperature</p>
                            <p className="font-semibold">{displayPatient.vitals[0].temperature}°C</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === "VITALS" && (
                <div className="space-y-3">
                  {displayPatient.vitals && displayPatient.vitals.length > 0 ? (
                    displayPatient.vitals.map((vital, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Activity className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">Vital Signs</p>
                            <p className="text-xs text-slate-500">
                              {vital.recordedAt && new Date(vital.recordedAt).toLocaleString()}
                              {vital.recordedBy && ` by ${vital.recordedBy.fullName}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          {vital.bloodPressure && <p>BP: {vital.bloodPressure}</p>}
                          {vital.heartRate && <p>HR: {vital.heartRate} bpm</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No vitals recorded yet</p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === "NOTES" && (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>Progress notes will appear here</p>
                </div>
              )}
              
              {activeTab === "ORDERS" && (
                <div className="text-center py-8 text-slate-500">
                  <Stethoscope className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>Active orders will appear here</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button 
            onClick={() => router.push(`/patients/${patient.id}`)}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {role === "DOCTOR" ? "Write Order" : role === "NURSE" ? "Record Vitals" : "View Record"}
          </button>
          <button 
            onClick={() => router.push(`/patients/${patient.id}`)}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-white transition"
          >
            View Full Record
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Utility functions
function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return "--";
  try {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return "--";
  }
}

function getVitalColor(status?: VitalStatus) {
  switch (status) {
    case "CRITICAL": return "bg-red-500 text-white";
    case "UNSTABLE": return "bg-amber-500 text-white";
    case "RECOVERING": return "bg-blue-500 text-white";
    default: return "bg-emerald-500 text-white";
  }
}

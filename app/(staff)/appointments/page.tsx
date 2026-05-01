'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  CalendarDays,
  LayoutList,
  LayoutGrid,
  Trash2,
  Edit3,
  ClipboardCheck,
  Play,
  Check,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus   = 'SCHEDULED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type ApiPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type ApiType     = 'CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE' | 'SURGERY' | 'EMERGENCY' | 'ROUTINE_CHECK';

interface Appointment {
  id: number;
  patientId: number;
  staffUserId: number;
  appointmentDateTime: string;
  endTime: string | null;
  reason: string | null;
  status: ApiStatus;
  priority: ApiPriority;
  appointmentType: ApiType;
  notes: string | null;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  patient?: { id: number; patientCode: string; firstName: string; lastName: string };
  staff?:   { id: number; fullName: string; role: string };
}

interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  patientCode: string;
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

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback = 'Request failed') =>
  error instanceof Error ? error.message : fallback;

// ─── Status / Priority config ─────────────────────────────────────────────────

const statusConfig: Record<ApiStatus, { label: string; color: string; icon: React.ElementType; next: ApiStatus[] }> = {
  SCHEDULED:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: Calendar,      next: ['CHECKED_IN', 'CANCELLED'] },
  CHECKED_IN:  { label: 'Checked In',  color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: ClipboardCheck,next: ['IN_PROGRESS', 'CANCELLED'] },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-sky-100 text-sky-700 border-sky-200',         icon: Play,          next: ['COMPLETED', 'NO_SHOW'] },
  COMPLETED:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, next: [] },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-slate-100 text-slate-500 border-slate-200',  icon: XCircle,       next: [] },
  NO_SHOW:     { label: 'No Show',     color: 'bg-rose-100 text-rose-700 border-rose-200',     icon: AlertCircle,   next: [] },
};

const priorityConfig: Record<ApiPriority, { color: string; label: string }> = {
  LOW:    { color: 'bg-slate-100 text-slate-600',              label: 'Low'    },
  NORMAL: { color: 'bg-blue-100 text-blue-700',                label: 'Normal' },
  HIGH:   { color: 'bg-amber-100 text-amber-700',              label: 'High'   },
  URGENT: { color: 'bg-rose-100 text-rose-700 animate-pulse',  label: 'URGENT' },
};

// ─── Input styles ─────────────────────────────────────────────────────────────

const fieldCls   = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';
const selectCls  = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPatientName = (a: Appointment) =>
  a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : `Patient #${a.patientId}`;

const getStaffName = (a: Appointment) =>
  a.staff?.fullName ?? `Staff #${a.staffUserId}`;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [me,           setMe]           = useState<Me | null>(null);
  const [meLoading,    setMeLoading]    = useState(true);
  const [meError,      setMeError]      = useState('');
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');

  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [currentView,   setCurrentView]   = useState<'list' | 'grid'>('list');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [dateFilter,    setDateFilter]    = useState<string>(new Date().toISOString().split('T')[0]);

  const [isModalOpen,          setIsModalOpen]          = useState(false);
  const [editingAppointment,   setEditingAppointment]   = useState<Appointment | null>(null);
  const [statusModalOpen,      setStatusModalOpen]      = useState(false);
  const [selectedAppointment,  setSelectedAppointment]  = useState<Appointment | null>(null);

  const [formData, setFormData] = useState({
    patientId:           '',
    appointmentDateTime: '',
    reason:              '',
  });

  // ── Fetch me — tries /api/dashboard first, falls back to /api/auth/me ────────
  const fetchMe = useCallback(async () => {
    setMeLoading(true);
    setMeError('');
    try {
      // ✅ Primary: dashboard endpoint returns data.me
      const res  = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.me) {
          setMe(json.data.me);
          setMeLoading(false);
          return;
        }
      }
      // ✅ Fallback: /api/auth/me if dashboard fails
      const res2  = await fetch('/api/auth/me');
      if (res2.ok) {
        const json2 = await res2.json();
        // Handles both { data: {...} } and the user object directly
        const user = json2?.data ?? json2;
        if (user?.id) {
          setMe({
            id:         user.id,
            fullName:   user.fullName   ?? user.name ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
            email:      user.email      ?? '',
            role:       user.role       ?? 'STAFF',
            department: user.department ?? null,
            shift:      user.shift      ?? null,
            staffId:    user.staffId    ?? null,
          });
          setMeLoading(false);
          return;
        }
      }
      setMeError('Could not load your staff profile. Please refresh the page.');
    } catch (e: unknown) {
      setMeError('Network error loading staff profile. Please refresh.');
      console.error('fetchMe error:', e);
    } finally {
      setMeLoading(false);
    }
  }, []);

  // ── Fetch appointments ────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    try {
      const res  = await fetch('/api/appointments?pageSize=100');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const arr  = Array.isArray(json) ? json : (json.data ?? []);
      setAppointments(arr);
    } catch (e) {
      console.error('fetchAppointments error:', e);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch patients ────────────────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    try {
      const res  = await fetch('/api/patients?pageSize=200');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const arr  = Array.isArray(json) ? json : (json.data ?? []);
      setPatients(arr);
    } catch (e) {
      console.error('fetchPatients error:', e);
      setPatients([]);
    }
  }, []);

  useEffect(() => {
    fetchMe();
    fetchAppointments();
    fetchPatients();
  }, [fetchMe, fetchAppointments, fetchPatients]);

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filteredAppointments = React.useMemo(() => {
    let list = [...appointments];
    if (currentFilter !== 'all') {
      list = list.filter(a => a.status === currentFilter);
    }
    if (dateFilter) {
      const d = new Date(dateFilter).toDateString();
      list = list.filter(a => new Date(a.appointmentDateTime).toDateString() === d);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        getPatientName(a).toLowerCase().includes(q) ||
        (a.reason ?? '').toLowerCase().includes(q) ||
        String(a.patientId).includes(q)
      );
    }
    return list.sort((a, b) =>
      new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime()
    );
  }, [appointments, currentFilter, dateFilter, searchQuery]);

  const stats = React.useMemo(() => {
    const today     = new Date().toDateString();
    const todayList = appointments.filter(a => new Date(a.appointmentDateTime).toDateString() === today);
    return {
      today:     todayList.length,
      pending:   appointments.filter(a => a.status === 'SCHEDULED').length,
      checkedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
      completed: todayList.filter(a => a.status === 'COMPLETED').length,
    };
  }, [appointments]);

  // ── Create / Update ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId)           { setSaveError('Please select a patient.');            return; }
    if (!formData.appointmentDateTime) { setSaveError('Please set a date and time.');         return; }
    if (!me?.id)                       { setSaveError('Staff profile not loaded. Please click Refresh Staff above and try again.'); return; }

    setSaving(true); setSaveError('');

    // ✅ Only send what the API accepts
    const payload: Record<string, unknown> = {
      patientId:           parseInt(formData.patientId),
      staffUserId:         me.id,
      appointmentDateTime: new Date(formData.appointmentDateTime).toISOString(),
    };
    if (formData.reason.trim()) payload.reason = formData.reason.trim();

    try {
      const url    = editingAppointment ? `/api/appointments/${editingAppointment.id}` : '/api/appointments';
      const method = editingAppointment ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
       const json: ApiResponse<Appointment> = await res.json();
       if (!res.ok || !json.success) throw new Error(json.error || `Failed (${res.status})`);
       if (!json.data) throw new Error('Appointment response is missing data');
       const appointment = json.data;

       // ✅ Add/update in state immediately from API response
       if (!editingAppointment) {
         setAppointments(prev => [appointment, ...prev]);
       } else {
         setAppointments(prev => prev.map(a => a.id === appointment.id ? appointment : a));
       }
      closeModal();
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Status update ─────────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!selectedAppointment) return;
    try {
      const res  = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
       const json: ApiResponse<Appointment> = await res.json();
       if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
       if (!json.data) throw new Error('Appointment response is missing data');
       const appointment = json.data;
       setAppointments(prev => prev.map(a => a.id === appointment.id ? appointment : a));
      setStatusModalOpen(false);
      setSelectedAppointment(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteAppointment = async (id: number) => {
    if (!confirm('Delete this appointment?')) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const openNewModal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormData({ patientId: '', appointmentDateTime: now.toISOString().slice(0, 16), reason: '' });
    setSaveError('');
    setEditingAppointment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (a: Appointment) => {
    setFormData({
      patientId:           String(a.patientId),
      appointmentDateTime: a.appointmentDateTime.slice(0, 16),
      reason:              a.reason ?? '',
    });
    setSaveError('');
    setEditingAppointment(a);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingAppointment(null); setSaveError(''); };

  // ── Formatters ────────────────────────────────────────────────────────────────
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const fmtDuration = (start: string, end: string | null) => {
    if (!end) return '—';
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return diff > 0 ? `${diff} min` : '—';
  };

  const fmtType = (t: string) =>
    t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <>
      <div className={`flex-1 overflow-hidden flex flex-col bg-slate-50 transition-all duration-300 ${isModalOpen || statusModalOpen ? 'blur-sm scale-[0.99]' : ''}`}>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ── Staff Banner ── */}
          {meLoading ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
              <span className="text-sm text-slate-500">Loading your staff profile...</span>
            </div>
          ) : meError ? (
            // ✅ Shows error with a retry button instead of blocking the whole page
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
                  {me.staffId    ? ` • ${me.staffId}`    : ''}
                  {me.shift      ? ` • ${me.shift} shift`: ''}
                </p>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">Appointments booked under your account</p>
              <button onClick={fetchMe} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition" title="Refresh staff profile">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Today"      value={stats.today}     subtitle="Total appointments"  icon={CalendarDays}   color="sky" />
            <StatCard title="Scheduled"  value={stats.pending}   subtitle="Awaiting check-in"   icon={Clock}          color="amber" />
            <StatCard title="Checked In" value={stats.checkedIn} subtitle="Currently in queue"  icon={ClipboardCheck} color="emerald" />
            <StatCard title="Completed"  value={stats.completed} subtitle="Finished today"       icon={CheckCircle}    color="slate" />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {[
                { key: 'all',         label: 'All' },
                { key: 'SCHEDULED',   label: 'Scheduled' },
                { key: 'CHECKED_IN',  label: 'Checked In' },
                { key: 'IN_PROGRESS', label: 'In Progress' },
                { key: 'COMPLETED',   label: 'Completed' },
              ].map(f => (
                <button key={f.key} onClick={() => setCurrentFilter(f.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    currentFilter === f.key
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-500/20 outline-none shadow-sm" />
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                <button onClick={() => setCurrentView('list')} className={`p-2 rounded-lg transition ${currentView === 'list' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700'}`}><LayoutList className="w-4 h-4" /></button>
                <button onClick={() => setCurrentView('grid')} className={`p-2 rounded-lg transition ${currentView === 'grid' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700'}`}><LayoutGrid className="w-4 h-4" /></button>
              </div>

              <div className="relative hidden md:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 outline-none shadow-sm w-48" />
              </div>

              <button onClick={openNewModal}
                className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-sky-500/30 transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">New</span>
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" placeholder="Search appointments..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 outline-none shadow-sm" />
            </div>
          </div>

          {/* Appointments */}
          {filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No appointments found</h3>
              <p className="text-slate-500 max-w-sm">No appointments match your current filters.</p>
            </div>
          ) : (
            <div className={currentView === 'list' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
              {filteredAppointments.map(a =>
                currentView === 'list' ? (
                  <ListViewCard key={a.id} appointment={a}
                    onEdit={() => openEditModal(a)}
                    onDelete={() => deleteAppointment(a.id)}
                    onStatusClick={() => { setSelectedAppointment(a); setStatusModalOpen(true); }}
                    fmtTime={fmtTime} fmtDuration={fmtDuration} fmtType={fmtType} />
                ) : (
                  <GridViewCard key={a.id} appointment={a}
                    onEdit={() => openEditModal(a)}
                    onDelete={() => deleteAppointment(a.id)}
                    onStatusClick={() => { setSelectedAppointment(a); setStatusModalOpen(true); }}
                    fmtTime={fmtTime} fmtType={fmtType} />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="flex min-h-screen items-center justify-center p-4 sm:p-0">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl sm:my-8 sm:w-full sm:max-w-lg">

              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-sky-500" />
                  {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
                </h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-white transition"><XCircle className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">

                {/* Error */}
                {saveError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}
                    {/* ✅ If me failed, show inline retry inside the error */}
                    {!me && (
                      <button type="button" onClick={fetchMe} className="ml-auto flex items-center gap-1 text-rose-600 underline text-xs">
                        <RefreshCw className="w-3 h-3" /> Reload staff
                      </button>
                    )}
                  </div>
                )}

                {/* ✅ Staff info card — from me object */}
                {me ? (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                    <p className="text-xs font-semibold text-sky-600 uppercase mb-1.5 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5" /> Booking Staff
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{me.fullName}</p>
                        <p className="text-xs text-slate-500">{me.role}{me.department ? ` • ${me.department}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-sky-700 font-semibold">{me.staffId ?? `ID: ${me.id}`}</p>
                        {me.shift && <p className="text-[10px] text-slate-400">{me.shift} shift</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  // ✅ If me is still null inside the modal, show a clear retry
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-700">Staff profile not loaded</p>
                      <p className="text-xs text-amber-600">Click Reload to try again before booking.</p>
                    </div>
                    <button type="button" onClick={fetchMe}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-xs font-medium transition">
                      <RefreshCw className="w-3.5 h-3.5" /> Reload
                    </button>
                  </div>
                )}

                {/* Patient */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" /> Patient *
                  </label>
                  <select required value={formData.patientId} onChange={e => setFormData({ ...formData, patientId: e.target.value })} className={selectCls}>
                    <option value="">Select patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} — {p.patientCode}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Appointment Date & Time *
                  </label>
                  <input type="datetime-local" required value={formData.appointmentDateTime}
                    onChange={e => setFormData({ ...formData, appointmentDateTime: e.target.value })}
                    className={fieldCls} />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-slate-400" /> Reason / Chief Complaint
                  </label>
                  <input type="text" value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g. Annual physical examination"
                    className={fieldCls} />
                </div>

                {/* ✅ Null fields explanation — what they mean and when they get filled */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields filled automatically by the system</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>• <span className="font-medium text-slate-600">endTime</span> — set when you close/complete</span>
                    <span>• <span className="font-medium text-slate-600">checkedInAt</span> — set on Check In</span>
                    <span>• <span className="font-medium text-slate-600">startedAt</span> — set on In Progress</span>
                    <span>• <span className="font-medium text-slate-600">completedAt</span> — set on Completed</span>
                    <span>• <span className="font-medium text-slate-600">notes</span> — added after creation</span>
                    <span>• <span className="font-medium text-slate-600">reminderSent</span> — auto by scheduler</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button type="button" onClick={closeModal} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">Cancel</button>
                  <button type="submit" disabled={saving || !me}
                    className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl font-medium shadow-lg shadow-sky-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                      : <><Check className="w-4 h-4" />{editingAppointment ? 'Update' : 'Create'} Appointment</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setStatusModalOpen(false)} />
          <div className="flex min-h-screen items-center justify-center p-4 sm:p-0">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl sm:my-8 sm:w-full sm:max-w-md">
              <div className="p-6 bg-white">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Update Status</h3>

                {/* Appointment summary */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
                  <p className="font-semibold text-slate-800 text-sm">{getPatientName(selectedAppointment)}</p>
                  {selectedAppointment.patient && (
                    <p className="text-xs text-slate-400 font-mono">{selectedAppointment.patient.patientCode}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedAppointment.reason ?? '(No reason specified)'} • {fmtDate(selectedAppointment.appointmentDateTime)} {fmtTime(selectedAppointment.appointmentDateTime)}
                  </p>
                  {/* ✅ Show which null timestamps will be filled by this status change */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">Status:</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusConfig[selectedAppointment.status].color}`}>
                      {React.createElement(statusConfig[selectedAppointment.status].icon, { className: 'w-3.5 h-3.5' })}
                      {statusConfig[selectedAppointment.status].label}
                    </span>
                  </div>
                  {/* Show null timestamps */}
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <span>Check-in: {selectedAppointment.checkedInAt ? fmtTime(selectedAppointment.checkedInAt) : <span className="text-slate-300">not yet</span>}</span>
                    <span>Started:  {selectedAppointment.startedAt   ? fmtTime(selectedAppointment.startedAt)   : <span className="text-slate-300">not yet</span>}</span>
                    <span>Completed:{selectedAppointment.completedAt ? fmtTime(selectedAppointment.completedAt) : <span className="text-slate-300">not yet</span>}</span>
                    <span>End time: {selectedAppointment.endTime     ? fmtTime(selectedAppointment.endTime)     : <span className="text-slate-300">not set</span>}</span>
                  </div>
                </div>

                {statusConfig[selectedAppointment.status].next.length > 0 ? (
                  <>
                    <p className="text-sm font-medium text-slate-700 mb-2">Change to:</p>
                    <div className="space-y-2">
                      {statusConfig[selectedAppointment.status].next.map(nextStatus => {
                        const cfg = statusConfig[nextStatus];
                        // ✅ Tell the user what will be auto-filled
                        const willFill: Record<string, string> = {
                          CHECKED_IN:  'Sets checkedInAt timestamp',
                          IN_PROGRESS: 'Sets startedAt timestamp',
                          COMPLETED:   'Sets completedAt timestamp',
                        };
                        return (
                          <button key={nextStatus} onClick={() => updateStatus(nextStatus)}
                            className={`w-full p-3 rounded-xl border ${cfg.color} hover:shadow-md transition flex items-center justify-between group bg-white`}>
                            <div>
                              <span className="font-medium flex items-center gap-2">
                                {React.createElement(cfg.icon, { className: 'w-4 h-4' })}
                                {cfg.label}
                              </span>
                              {willFill[nextStatus] && (
                                <p className="text-[10px] opacity-70 mt-0.5 ml-6">{willFill[nextStatus]}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No further status changes available.</p>
                )}

                <button onClick={() => setStatusModalOpen(false)}
                  className="mt-4 w-full py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: number; subtitle: string; icon: React.ElementType; color: string;
}) {
  const colorMap: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-600', amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600', slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`w-8 h-8 ${colorMap[color] ?? colorMap.slate} rounded-lg flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function ListViewCard({ appointment: a, onEdit, onDelete, onStatusClick, fmtTime, fmtDuration, fmtType }: {
  appointment: Appointment; onEdit: () => void; onDelete: () => void; onStatusClick: () => void;
  fmtTime: (s: string) => string; fmtDuration: (s: string, e: string | null) => string; fmtType: (s: string) => string;
}) {
  const status     = statusConfig[a.status];
  const priority   = priorityConfig[a.priority];
  const StatusIcon = status.icon;
  const isPast     = new Date() > new Date(a.appointmentDateTime) && a.status !== 'COMPLETED';

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 md:w-44 shrink-0">
          <div className={`w-12 h-12 rounded-xl ${isPast ? 'bg-slate-100' : 'bg-sky-100'} flex items-center justify-center`}>
            <Clock className={`w-5 h-5 ${isPast ? 'text-slate-400' : 'text-sky-600'}`} />
          </div>
          <div>
            <p className="font-bold text-slate-800">{fmtTime(a.appointmentDateTime)}</p>
            {/* ✅ endTime null handled gracefully */}
            <p className="text-xs text-slate-500">{fmtDuration(a.appointmentDateTime, a.endTime)}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate mb-0.5">{getPatientName(a)}</h3>
          {a.patient && <p className="text-xs text-slate-400 font-mono mb-1">{a.patient.patientCode}</p>}
          <p className="text-sm text-slate-600 truncate flex items-center gap-2">
            <Stethoscope className="w-3 h-3 text-slate-400 flex-shrink-0" />
            {/* ✅ reason null handled */}
            {a.reason ?? <span className="italic text-slate-400">No reason specified</span>}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{getStaffName(a)}</span>
            <span className="flex items-center gap-1"><Filter className="w-3 h-3" />{fmtType(a.appointmentType)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priority.color}`}>{priority.label}</span>
          <button onClick={onStatusClick} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${status.color} flex items-center gap-1.5 hover:shadow-md transition`}>
            <StatusIcon className="w-3 h-3" />{status.label}
          </button>
          <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit}   className="p-2 text-slate-400 hover:text-sky-600  hover:bg-sky-50  rounded-lg transition" title="Edit">  <Edit3  className="w-4 h-4" /></button>
            <button onClick={onDelete} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {a.status !== 'SCHEDULED' && a.status !== 'CANCELLED' && (
        <Timeline appointment={a} fmtTime={fmtTime} />
      )}
    </div>
  );
}

function GridViewCard({ appointment: a, onEdit, onDelete, onStatusClick, fmtTime, fmtType }: {
  appointment: Appointment; onEdit: () => void; onDelete: () => void; onStatusClick: () => void;
  fmtTime: (s: string) => string; fmtType: (s: string) => string;
}) {
  const status     = statusConfig[a.status];
  const priority   = priorityConfig[a.priority];
  const StatusIcon = status.icon;
  const name       = getPatientName(a);
  const initials   = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-lg">{initials}</div>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${priority.color}`}>{priority.label}</span>
      </div>
      <h3 className="font-bold text-slate-800 mb-0.5 truncate">{name}</h3>
      {a.patient && <p className="text-xs text-slate-400 font-mono mb-3">{a.patient.patientCode}</p>}
      <div className="space-y-2 mb-4 flex-1">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {fmtTime(a.appointmentDateTime)}{a.endTime ? ` – ${fmtTime(a.endTime)}` : ''}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Stethoscope className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{a.reason ?? <span className="italic text-slate-400">No reason</span>}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />{getStaffName(a)}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />{fmtType(a.appointmentType)}
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <button onClick={onStatusClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status.color} flex items-center gap-1.5 hover:shadow-md transition`}>
          <StatusIcon className="w-3 h-3" />{status.label}
        </button>
        <div className="flex gap-1">
          <button onClick={onEdit}   className="p-2 text-slate-400 hover:text-sky-600  hover:bg-sky-50  rounded-lg transition"><Edit3  className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Timeline({ appointment: a, fmtTime }: { appointment: Appointment; fmtTime: (s: string) => string }) {
  const steps = [
    { key: 'checkedInAt' as const, label: 'Checked In', icon: ClipboardCheck },
    { key: 'startedAt'   as const, label: 'Started',    icon: Play },
    { key: 'completedAt' as const, label: 'Completed',  icon: Check },
  ];
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 md:gap-4 text-xs overflow-x-auto">
      {steps.map((step, i) => {
        const done   = a[step.key] !== null;
        const isLast = i === steps.length - 1;
        const Icon   = step.icon;
        return (
          <React.Fragment key={step.key}>
            <div className={`flex items-center gap-2 ${done ? 'text-emerald-600' : 'text-slate-400'} shrink-0`}>
              <div className={`w-6 h-6 rounded-full ${done ? 'bg-emerald-100' : 'bg-slate-100'} flex items-center justify-center`}>
                <Icon className={`w-3 h-3 ${done ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <span className={`font-medium whitespace-nowrap ${done ? 'text-slate-700' : ''}`}>{step.label}</span>
              {/* ✅ null timestamp handled — only render if value exists */}
              {a[step.key] && <span className="text-slate-400 whitespace-nowrap">{fmtTime(a[step.key]!)}</span>}
            </div>
            {!isLast && <div className="flex-1 min-w-[2rem] h-px bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

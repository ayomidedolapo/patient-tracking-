"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, Plus, X, Heart, Activity, Thermometer, Droplets, Wind,
  FileText, Pill, FlaskConical, Calendar, Phone, MapPin, User,
  AlertCircle, CheckCircle2, Clock, Bed, TrendingUp, TrendingDown,
  Minus, Trash2, PenLine, Building2, Users, RefreshCw, Loader2,
  ClipboardList, CheckSquare, ChevronRight, CalendarClock, Edit,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "vitals" | "notes" | "medications" | "labs" | "tasks";
type VitalStatus = "STABLE" | "UNSTABLE" | "CRITICAL" | "RECOVERING";
type ModalType = "addPatient" | "editPatient" | "addNote" | "recordVitals" | "addMedication" | "addTask" | null;
type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback = "Request failed") =>
  error instanceof Error ? error.message : fallback;

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

interface TreatmentPlan {
  id: number;
  patientId: number;
  description: string;
  startDate: string;
  status: string;
  createdAt: string;
}

interface Appointment {
  id: number;
  patientId: number;
  appointmentDateTime: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface Task {
  id: number;
  patientId: number;
  assignedTo: number | null;
  createdBy: number | null;
  type: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueTime: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: number; fullName: string; role: string };
  creator?: { id: number; fullName: string };
  patient?: { id: number; firstName: string; lastName: string; roomNumber: string; bedNumber: string };
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
  admissionDate: string | null;
  bedNumber: string;
  roomNumber: string;
  dischargeDate: string | null;
  isActive: boolean;
  vitalStatus: VitalStatus;
  createdAt?: string;
  updatedAt?: string;
  lastVitals: ApiVital | null;
  vitalsHistory: ApiVital[];
  progressNotes: ProgressNote[];
  diagnosticReports: DiagnosticReport[];
  treatmentPlans: TreatmentPlan[];
  appointments: Appointment[];
  tasks: Task[];
  medications: Medication[];
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900";
const selectCls = inputCls;

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2 pb-1 border-b border-slate-100 mb-2">{children}</p>;
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {children}
      </motion.div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
    </div>
  );
}

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-blue-500`} />;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-200 flex items-center gap-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="text-xs underline whitespace-nowrap">Retry</button>}
    </div>
  );
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Patient Form Fields (shared by Add + Edit) ───────────────────────────────

type PatientFormData = {
  firstName: string; lastName: string; dateOfBirth: string; sex: string;
  bloodGroup: string; phone: string; address: string; maritalStatus: string;
  employerName: string; employerAddress: string;
  nextOfKinName: string; nextOfKinRelationship: string; nextOfKinPhone: string;
  roomNumber: string; bedNumber: string; admissionDate: string;
};

function PatientForm({ form, setForm }: { form: PatientFormData; setForm: (f: PatientFormData) => void }) {
  const set = (k: keyof PatientFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <SectionLabel>Patient Info</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="First Name *"><input className={inputCls} value={form.firstName} onChange={set("firstName")} placeholder="Ayomide" /></FormField>
        <FormField label="Last Name *"><input className={inputCls} value={form.lastName} onChange={set("lastName")} placeholder="Dolapo" /></FormField>
        <FormField label="Date of Birth"><input className={inputCls} type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></FormField>
        <FormField label="Sex">
          <select className={selectCls} value={form.sex} onChange={set("sex")}>
            <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
          </select>
        </FormField>
        <FormField label="Marital Status">
          <select className={selectCls} value={form.maritalStatus} onChange={set("maritalStatus")}>
            <option value="SINGLE">Single</option><option value="MARRIED">Married</option>
            <option value="DIVORCED">Divorced</option><option value="WIDOWED">Widowed</option>
          </select>
        </FormField>
        <FormField label="Blood Group">
          <select className={selectCls} value={form.bloodGroup} onChange={set("bloodGroup")}>
            {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(b => <option key={b}>{b}</option>)}
          </select>
        </FormField>
        <FormField label="Phone *"><input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="08012345678" /></FormField>
      </div>
      <FormField label="Address"><input className={inputCls} value={form.address} onChange={set("address")} placeholder="No 10 Hospital Road" /></FormField>

      <SectionLabel>Employer</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Employer Name"><input className={inputCls} value={form.employerName} onChange={set("employerName")} placeholder="ABC Company" /></FormField>
        <FormField label="Employer Address"><input className={inputCls} value={form.employerAddress} onChange={set("employerAddress")} placeholder="Ikeja Lagos" /></FormField>
      </div>

      <SectionLabel>Next of Kin</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Full Name"><input className={inputCls} value={form.nextOfKinName} onChange={set("nextOfKinName")} placeholder="Jane Doe" /></FormField>
        <FormField label="Relationship"><input className={inputCls} value={form.nextOfKinRelationship} onChange={set("nextOfKinRelationship")} placeholder="Sister" /></FormField>
        <FormField label="Phone"><input className={inputCls} value={form.nextOfKinPhone} onChange={set("nextOfKinPhone")} placeholder="08087654321" /></FormField>
      </div>

      <SectionLabel>Admission</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Room Number"><input className={inputCls} value={form.roomNumber} onChange={set("roomNumber")} placeholder="1A" /></FormField>
        <FormField label="Bed Number"><input className={inputCls} value={form.bedNumber} onChange={set("bedNumber")} placeholder="B3" /></FormField>
        <FormField label="Admission Date"><input className={inputCls} type="date" value={form.admissionDate} onChange={set("admissionDate")} /></FormField>
      </div>
    </div>
  );
}

// ─── Add Patient Modal ────────────────────────────────────────────────────────

function AddPatientModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<PatientFormData>({
    firstName: "", lastName: "", dateOfBirth: "", sex: "MALE", bloodGroup: "O+",
    phone: "", address: "", maritalStatus: "SINGLE", employerName: "", employerAddress: "",
    nextOfKinName: "", nextOfKinRelationship: "", nextOfKinPhone: "",
    roomNumber: "", bedNumber: "", admissionDate: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.phone) { setError("First name, last name and phone are required."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/api/patients", { method: "POST", body: JSON.stringify(form) });
      onAdded(); onClose();
    } catch (e: unknown) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Admit New Patient" onClose={onClose} />
      <div className="p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        <PatientForm form={form} setForm={setForm} />
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
        <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition">
          {loading ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Admit Patient
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Edit Patient Modal ───────────────────────────────────────────────────────

function EditPatientModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PatientFormData>({
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth ?? "",
    sex: patient.sex,
    bloodGroup: patient.bloodGroup,
    phone: patient.phone,
    address: patient.address ?? "",
    maritalStatus: patient.maritalStatus,
    employerName: patient.employerName ?? "",
    employerAddress: patient.employerAddress ?? "",
    nextOfKinName: patient.nextOfKinName ?? "",
    nextOfKinRelationship: patient.nextOfKinRelationship ?? "",
    nextOfKinPhone: patient.nextOfKinPhone ?? "",
    roomNumber: patient.roomNumber ?? "",
    bedNumber: patient.bedNumber ?? "",
    admissionDate: patient.admissionDate ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.phone) { setError("First name, last name and phone are required."); return; }
    setLoading(true); setError("");
    try {
      // PUT /api/patients/:id
      await apiFetch(`/api/patients/${patient.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth || undefined,
          sex: form.sex,
          bloodGroup: form.bloodGroup,
          phone: form.phone,
          address: form.address,
          maritalStatus: form.maritalStatus,
          employerName: form.employerName,
          employerAddress: form.employerAddress,
          nextOfKinName: form.nextOfKinName,
          nextOfKinRelationship: form.nextOfKinRelationship,
          nextOfKinPhone: form.nextOfKinPhone,
          roomNumber: form.roomNumber,
          bedNumber: form.bedNumber,
          admissionDate: form.admissionDate || undefined,
        }),
      });
      onSaved(); onClose();
    } catch (e: unknown) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={`Edit — ${patient.firstName} ${patient.lastName}`} onClose={onClose} />
      <div className="p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        <PatientForm form={form} setForm={setForm} />
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
        <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition">
          {loading ? <Spinner className="w-4 h-4" /> : <Edit className="w-4 h-4" />} Save Changes
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Record Vitals Modal ──────────────────────────────────────────────────────

function RecordVitalsModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const lv = patient.lastVitals;
  const [form, setForm] = useState({
    // All fields from your DB schema
    bloodPressure: lv?.bloodPressure ?? "",
    heartRate: String(lv?.heartRate ?? ""),
    temperature: String(lv?.temperature ?? ""),
    respiratoryRate: String(lv?.respiratoryRate ?? ""),
    oxygenSaturation: String(lv?.oxygenSaturation ?? ""),
    weight: String(lv?.weight ?? ""),
    height: String(lv?.height ?? ""),
    bmi: String(lv?.bmi ?? ""),
    painScore: String(lv?.painScore ?? ""),
    notes: "",
    recordedAt: new Date().toISOString().slice(0, 16) // For recordedAt field
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-calculate BMI when weight or height changes
  useEffect(() => {
    const weight = parseFloat(form.weight);
    const height = parseFloat(form.height);
    if (weight > 0 && height > 0) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      setForm(f => ({ ...f, bmi: bmi.toFixed(1) }));
    }
  }, [form.weight, form.height]);

  const handleSubmit = async () => {
    setLoading(true); 
    setError("");
    try {
      const body: Record<string, unknown> = {};
      
      // All fields matching your DB schema exactly
      if (form.bloodPressure)    body.bloodPressure    = form.bloodPressure;
      if (form.heartRate)        body.heartRate        = Number(form.heartRate);
      if (form.temperature)      body.temperature      = Number(form.temperature);
      if (form.respiratoryRate)  body.respiratoryRate  = Number(form.respiratoryRate);
      if (form.oxygenSaturation) body.oxygenSaturation = Number(form.oxygenSaturation);
      if (form.weight)           body.weight           = Number(form.weight);
      if (form.height)           body.height           = Number(form.height);
      if (form.bmi)              body.bmi              = Number(form.bmi);
      if (form.painScore)        body.painScore        = Number(form.painScore);
      if (form.notes)            body.notes            = form.notes;
      if (form.recordedAt)       body.recordedAt       = new Date(form.recordedAt).toISOString();

      await apiFetch(`/api/patients/${patient.id}/vitals`, { 
        method: "POST", 
        body: JSON.stringify(body) 
      });
      
      onSaved(); 
      onClose();
    } catch (e: unknown) { 
      setError(getErrorMessage(e)); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Record Vitals" onClose={onClose} />
      <div className="p-6 space-y-4">
        {error && <ErrorBanner message={error} />}
        
        {/* Recorded At - Required field from DB */}
        <FormField label="Recorded At *">
          <input 
            className={inputCls} 
            type="datetime-local" 
            value={form.recordedAt} 
            onChange={set("recordedAt")} 
            required 
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          {/* Blood Pressure */}
          <FormField label="Blood Pressure">
            <input 
              className={inputCls} 
              value={form.bloodPressure} 
              onChange={set("bloodPressure")} 
              placeholder="120/80" 
            />
          </FormField>

          {/* Heart Rate */}
          <FormField label="Heart Rate (bpm)">
            <input 
              className={inputCls} 
              type="number" 
              value={form.heartRate} 
              onChange={set("heartRate")} 
              placeholder="75" 
            />
          </FormField>

          {/* Temperature */}
          <FormField label="Temperature (°C)">
            <input 
              className={inputCls} 
              type="number" 
              step="0.1" 
              value={form.temperature} 
              onChange={set("temperature")} 
              placeholder="37.1" 
            />
          </FormField>

          {/* Respiratory Rate */}
          <FormField label="Respiratory Rate (rpm)">
            <input 
              className={inputCls} 
              type="number" 
              value={form.respiratoryRate} 
              onChange={set("respiratoryRate")} 
              placeholder="16" 
            />
          </FormField>

          {/* Oxygen Saturation */}
          <FormField label="O₂ Saturation (%)">
            <input 
              className={inputCls} 
              type="number" 
              value={form.oxygenSaturation} 
              onChange={set("oxygenSaturation")} 
              placeholder="98" 
            />
          </FormField>

          {/* Pain Score */}
          <FormField label="Pain Score (0–10)">
            <input 
              className={inputCls} 
              type="number" 
              min="0" 
              max="10" 
              value={form.painScore} 
              onChange={set("painScore")} 
              placeholder="0" 
            />
          </FormField>

          {/* Weight */}
          <FormField label="Weight (kg)">
            <input 
              className={inputCls} 
              type="number" 
              step="0.1" 
              value={form.weight} 
              onChange={set("weight")} 
              placeholder="70" 
            />
          </FormField>

          {/* Height */}
          <FormField label="Height (cm)">
            <input 
              className={inputCls} 
              type="number" 
              value={form.height} 
              onChange={set("height")} 
              placeholder="170" 
            />
          </FormField>

          {/* BMI - Auto-calculated, read-only */}
          <FormField label="BMI (auto)">
            <input 
              className={`${inputCls} bg-slate-100`} 
              type="number" 
              step="0.1" 
              value={form.bmi} 
              readOnly 
              placeholder="Calculated" 
            />
          </FormField>
        </div>

        {/* Notes */}
        <FormField label="Notes / Observations">
          <textarea 
            className={`${inputCls} resize-none`} 
            rows={3} 
            value={form.notes} 
            onChange={set("notes")} 
            placeholder="Any observations..." 
          />
        </FormField>
      </div>

      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button 
          onClick={onClose} 
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition"
        >
          {loading ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} 
          Save Vitals
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Add Note Modal ───────────────────────────────────────────────────────────

function AddNoteModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!note.trim()) { setError("Note content is required."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch(`/api/patients/${patient.id}/progress-notes`, { method: "POST", body: JSON.stringify({ note }) });
      onSaved(); onClose();
    } catch (e: unknown) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Add Progress Note" onClose={onClose} />
      <div className="p-6 space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
          Patient: <span className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</span>
        </div>
        <FormField label="Note *">
          <textarea className={`${inputCls} resize-none`} rows={6} value={note} onChange={e => setNote(e.target.value)} placeholder="Patient is stable and responding to treatment..." />
        </FormField>
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
        <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition">
          {loading ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Add Note
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Add Medication Modal (local) ─────────────────────────────────────────────

function AddMedicationModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Omit<Medication, "id">) => void }) {
  const [form, setForm] = useState({ name: "", dose: "", freq: "", route: "Oral", color: "blue" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Add Medication" onClose={onClose} />
      <div className="p-6 space-y-4">
        <FormField label="Medication Name *"><input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Amoxicillin" /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Dose *"><input className={inputCls} value={form.dose} onChange={set("dose")} placeholder="500mg" /></FormField>
          <FormField label="Frequency *"><input className={inputCls} value={form.freq} onChange={set("freq")} placeholder="Twice daily" /></FormField>
          <FormField label="Route"><select className={selectCls} value={form.route} onChange={set("route")}>{["Oral","IV","SubQ","Sublingual","Topical","Inhaled"].map(r => <option key={r}>{r}</option>)}</select></FormField>
          <FormField label="Color Tag"><select className={selectCls} value={form.color} onChange={set("color")}>{["rose","blue","amber","emerald","purple","teal"].map(c => <option key={c} value={c}>{c}</option>)}</select></FormField>
        </div>
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
        <button onClick={() => { if (!form.name || !form.dose || !form.freq) return; onAdd(form); onClose(); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────
// Matches your DB schema: patientId, type, title, description, priority, dueTime
// assignedTo is optional — defaults to current user on the server

function AddTaskModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", type: "REVIEW",
    priority: "NORMAL" as TaskPriority, dueTime: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.type.trim())  { setError("Type is required.");  return; }
    setLoading(true); setError("");
    try {
      const body: Record<string, unknown> = {
        patientId: patient.id,
        title: form.title.trim(),
        type: form.type,
        priority: form.priority,
      };
      if (form.description.trim()) body.description = form.description.trim();
      // dueTime must be a valid ISO string — only include if filled
      if (form.dueTime) body.dueTime = new Date(form.dueTime).toISOString();

      await apiFetch("/api/clinical/tasks", { method: "POST", body: JSON.stringify(body) });
      onSaved(); onClose();
    } catch (e: unknown) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Create Task" onClose={onClose} />
      <div className="p-6 space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
          Patient: <span className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</span>
          <span className="mx-2 text-slate-300">|</span>
          Room <span className="font-semibold text-slate-900">{patient.roomNumber || "—"}</span> • <span className="font-semibold text-slate-900">{patient.bedNumber || "—"}</span>
        </div>
        <FormField label="Task Title *">
          <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. Review patient chart" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type *">
            <select className={selectCls} value={form.type} onChange={set("type")}>
              {["REVIEW","GENERAL","MEDICATION","VITALS","LAB","PROCEDURE","ASSESSMENT","FOLLOW_UP"].map(t => (
                <option key={t} value={t}>{t.replace(/_/g," ")}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Priority">
            <select className={selectCls} value={form.priority} onChange={set("priority")}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </FormField>
          <FormField label="Due Date & Time">
            <input className={inputCls} type="datetime-local" value={form.dueTime} onChange={set("dueTime")} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={set("description")} placeholder="Check symptoms and write initial assessment..." />
        </FormField>
      </div>
      <div className="flex gap-3 px-6 pb-6 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
        <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition">
          {loading ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Create Task
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatientTrackingPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [filterStatus, setFilterStatus] = useState<"all" | VitalStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState<ModalType>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nextMedId, setNextMedId] = useState(1000);

  // ── Status config defined at top level so cards get correct colours on initial load ──
  const getStatusConfig = useCallback((status: VitalStatus | string) => {
    switch (status) {
      case "CRITICAL":   return { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    dot: "bg-rose-500",    badge: "bg-rose-100 text-rose-700 border-rose-200" };
      case "UNSTABLE":   return { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200" };
      case "STABLE":     return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "RECOVERING": return { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200" };
      default:           return { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  }, []);

  // ── Fetch patients list ──────────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setLoading(true); setGlobalError("");
    try {
      const query = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const res = await apiFetch<ApiResponse<Patient[]>>(`/api/patients?pageSize=100${query}`);
      // Preserve existing detail data if patient already loaded
      setPatients(prev => {
        const prevMap = new Map(prev.map(p => [p.id, p]));
        return (res.data || []).map((p: Patient) => {
          const existing = prevMap.get(p.id);
          return {
            ...p,
            // keep detail data if already fetched
            lastVitals:       existing?.lastVitals       ?? null,
            vitalsHistory:    existing?.vitalsHistory     ?? [],
            progressNotes:    existing?.progressNotes     ?? [],
            diagnosticReports:existing?.diagnosticReports ?? [],
            treatmentPlans:   existing?.treatmentPlans    ?? [],
            appointments:     existing?.appointments      ?? [],
            tasks:            existing?.tasks             ?? [],
            medications:      existing?.medications       ?? [],
          };
        });
      });
    } catch (e: unknown) { setGlobalError(getErrorMessage(e)); } finally { setLoading(false); }
  }, [searchQuery]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // ── Fetch full patient detail ────────────────────────────────────────────────
  const fetchPatientDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      // GET /api/patients/:id — returns demographics + nested: progressNotes, diagnosticReports, treatmentPlans, appointments
      const detailRes = await apiFetch<ApiResponse<Patient>>(`/api/patients/${id}`);
      const detail = detailRes.data;
      if (!detail) return;

      // GET /api/patients/:id/vitals — separate dedicated endpoint
      const vitalsRes = await apiFetch<ApiResponse<ApiVital[]>>(`/api/patients/${id}/vitals?pageSize=20`).catch(() => ({ data: [] }));
      const vitalsData: ApiVital[] = vitalsRes.data || [];

      // GET /api/tasks?patientId=:id
      const tasksRes = await apiFetch<ApiResponse<Task[]>>(`/api/clinical/tasks?patientId=${id}&pageSize=50`).catch(() => ({ data: [] }));
      const tasksData: Task[] = tasksRes.data || [];

      setPatients(ps => ps.map(p => p.id === id ? {
        ...p,
        ...detail,
        // nested from detail endpoint
        progressNotes:     detail.progressNotes     ?? [],
        diagnosticReports: detail.diagnosticReports ?? [],
        treatmentPlans:    detail.treatmentPlans     ?? [],
        appointments:      detail.appointments       ?? [],
        // vitals from dedicated endpoint
        vitalsHistory: vitalsData,
        lastVitals:    vitalsData.length > 0 ? vitalsData[0] : null,
        // tasks
        tasks: tasksData,
        // preserve local medications
        medications: p.medications,
      } : p));
    } catch {
      // silently fail — detail panel shows empty states
    } finally { setDetailLoading(false); }
  }, []);

  const handleSelectPatient = (id: number) => {
    setSelectedId(id);
    setActiveTab("overview");
    fetchPatientDetail(id);
  };

  const selectedPatient = useMemo(() => patients.find(p => p.id === selectedId) ?? null, [patients, selectedId]);

  const filteredPatients = useMemo(() =>
    patients.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || [p.firstName, p.lastName, p.patientCode, p.roomNumber, p.bedNumber, p.phone].some(v => v?.toLowerCase().includes(q));
      const matchFilter = filterStatus === "all" || p.vitalStatus === filterStatus;
      return matchSearch && matchFilter;
    }), [patients, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: patients.length,
    stable:   patients.filter(p => p.vitalStatus === "STABLE").length,
    unstable: patients.filter(p => p.vitalStatus === "UNSTABLE").length,
    critical: patients.filter(p => p.vitalStatus === "CRITICAL").length,
  }), [patients]);

  // ── Local medication helpers ─────────────────────────────────────────────────
  const updatePatient = (id: number, updater: (p: Patient) => Patient) =>
    setPatients(ps => ps.map(p => p.id === id ? updater(p) : p));

  const handleAddMedication = (med: Omit<Medication, "id">) => {
    if (!selectedId) return;
    updatePatient(selectedId, p => ({ ...p, medications: [...p.medications, { ...med, id: nextMedId }] }));
    setNextMedId(n => n + 1);
  };
  const handleDeleteMedication = (medId: number) => {
    if (!selectedId) return;
    updatePatient(selectedId, p => ({ ...p, medications: p.medications.filter(m => m.id !== medId) }));
  };

  // ── Task API actions ─────────────────────────────────────────────────────────
  const handleUpdateTaskStatus = async (taskId: number, status: TaskStatus) => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      updatePatient(selectedId, p => ({
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? {
          ...t, status,
          completedAt: status === "COMPLETED" ? new Date().toISOString() : null,
        } : t),
      }));
    } catch (e: unknown) { alert(getErrorMessage(e)); }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      updatePatient(selectedId, p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) }));
    } catch (e: unknown) { alert(getErrorMessage(e)); }
  };

  // ── Display helpers ──────────────────────────────────────────────────────────
  const calcAge = (dob: string) => {
    const b = new Date(dob), t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  };
  const fmtDate     = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const fmtTime     = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const taskPriorityBadge = (p: TaskPriority) => ({ URGENT: "bg-rose-100 text-rose-700 border-rose-200", HIGH: "bg-amber-100 text-amber-700 border-amber-200", NORMAL: "bg-blue-100 text-blue-700 border-blue-200", LOW: "bg-slate-100 text-slate-600 border-slate-200" }[p] ?? "bg-slate-100 text-slate-600 border-slate-200");
  const taskStatusBadge   = (s: TaskStatus)   => ({ PENDING: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-blue-100 text-blue-700", COMPLETED: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-rose-100 text-rose-600" }[s] ?? "bg-slate-100 text-slate-600");

  const medColorMap: Record<string, { bg: string; text: string }> = {
    rose: { bg: "bg-rose-100", text: "text-rose-600" }, blue: { bg: "bg-blue-100", text: "text-blue-600" },
    amber: { bg: "bg-amber-100", text: "text-amber-600" }, emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" }, teal: { bg: "bg-teal-100", text: "text-teal-600" },
  };

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "stable" }) =>
    trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;

  const deriveTrend = (a: number | null, b: number | null, threshold = 3): "up" | "down" | "stable" => {
    if (!a || !b) return "stable";
    if (a > b + threshold) return "up";
    if (a < b - threshold) return "down";
    return "stable";
  };

  const getVitalTrends = (p: Patient) => {
    const lv = p.lastVitals, prev = p.vitalsHistory?.[1] ?? null;
    return {
      hrTrend:   deriveTrend(lv?.heartRate ?? null, prev?.heartRate ?? null),
      bpTrend:   deriveTrend(lv?.bloodPressure ? parseInt(lv.bloodPressure) : null, prev?.bloodPressure ? parseInt(prev.bloodPressure) : null, 5),
      tempTrend: deriveTrend(lv?.temperature ?? null, prev?.temperature ?? null, 0.3),
      spo2Trend: deriveTrend(lv?.oxygenSaturation ?? null, prev?.oxygenSaturation ?? null),
    };
  };

  const trendColor = (trend: "up" | "down" | "stable", inverse = false) => {
    if (trend === "stable") return "text-slate-400";
    return (inverse ? trend === "down" : trend === "up") ? "text-rose-500" : "text-emerald-500";
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Modals */}
      <AnimatePresence>
        {modal === "addPatient"    && <AddPatientModal onClose={() => setModal(null)} onAdded={fetchPatients} />}
        {modal === "editPatient"   && selectedPatient && <EditPatientModal patient={selectedPatient} onClose={() => setModal(null)} onSaved={() => { fetchPatients(); fetchPatientDetail(selectedPatient.id); }} />}
        {modal === "addNote"       && selectedPatient && <AddNoteModal      patient={selectedPatient} onClose={() => setModal(null)} onSaved={() => fetchPatientDetail(selectedPatient.id)} />}
        {modal === "recordVitals"  && selectedPatient && <RecordVitalsModal patient={selectedPatient} onClose={() => setModal(null)} onSaved={() => fetchPatientDetail(selectedPatient.id)} />}
        {modal === "addMedication" && <AddMedicationModal onClose={() => setModal(null)} onAdd={handleAddMedication} />}
        {modal === "addTask"       && selectedPatient && <AddTaskModal patient={selectedPatient} onClose={() => setModal(null)} onSaved={() => fetchPatientDetail(selectedPatient.id)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Patient Tracking</h1>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? "Loading..." : `${stats.total} patients • ${stats.stable} stable • ${stats.unstable} unstable • ${stats.critical} critical`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchPatients} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => setModal("addPatient")} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">
                <Plus className="w-4 h-4" /> New Patient
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search by name, ID, room, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm text-slate-900" />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(["all","STABLE","UNSTABLE","CRITICAL"] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterStatus === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                  {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {globalError && <div className="mb-4"><ErrorBanner message={globalError} onRetry={fetchPatients} /></div>}

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded" /><div className="h-3 bg-slate-100 rounded w-2/3" /></div></div>
                <div className="grid grid-cols-4 gap-2"><div className="h-16 bg-slate-100 rounded-lg" /><div className="h-16 bg-slate-100 rounded-lg" /><div className="h-16 bg-slate-100 rounded-lg" /><div className="h-16 bg-slate-100 rounded-lg" /></div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="flex gap-6 items-start">

            {/* Patient Cards */}
            <div className={`transition-all duration-300 ${selectedPatient ? "w-[45%]" : "w-full"}`}>
              <div className={`grid gap-4 ${selectedPatient ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                {filteredPatients.map(patient => {
                  // ✅ FIX: getStatusConfig called here — colour always present on render, not only after click
                  const sc = getStatusConfig(patient.vitalStatus);
                  const trends = getVitalTrends(patient);
                  return (
                    <motion.div key={patient.id} layoutId={`patient-${patient.id}`}
                      onClick={() => handleSelectPatient(patient.id)}
                      className={`group relative bg-white rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedId === patient.id ? "border-blue-500 shadow-md ring-4 ring-blue-500/10" : "border-slate-200 hover:border-slate-300"}`}>
                      {/* ✅ Status strip — always coloured immediately from API vitalStatus */}
                      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${sc.dot}`} />
                      <div className="pl-3">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg font-semibold text-slate-700">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{patient.firstName} {patient.lastName}</h3>
                              <p className="text-xs text-slate-500 font-mono">{patient.patientCode}</p>
                            </div>
                          </div>
                          {/* ✅ Badge always coloured from API vitalStatus on initial render */}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.badge}`}>{patient.vitalStatus}</span>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mb-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />Room {patient.roomNumber || "—"} • {patient.bedNumber || "—"}</span>
                          <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5" />{patient.bloodGroup}</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {patient.sex === "MALE" ? "M" : patient.sex === "FEMALE" ? "F" : patient.sex}
                            {" • "}
                            {patient.age ?? (patient.dateOfBirth ? calcAge(patient.dateOfBirth) : "—")}y
                          </span>
                        </div>

                        {/* Vitals — shown if lastVitals loaded, else "no vitals" placeholder */}
                        {patient.lastVitals ? (
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {[
                              { icon: <Heart className={`w-3.5 h-3.5 ${sc.text}`} />, val: patient.lastVitals.heartRate ?? "—", unit: "bpm",    trend: trends.hrTrend,   cls: `${sc.bg} border ${sc.border}`, valCls: sc.text },
                              { icon: <Activity className="w-3.5 h-3.5 text-slate-500" />, val: patient.lastVitals.bloodPressure ?? "—", unit: "mmHg",  trend: trends.bpTrend,   cls: "bg-slate-50 border border-slate-100", valCls: "text-slate-900" },
                              { icon: <Thermometer className={`w-3.5 h-3.5 ${(patient.lastVitals.temperature ?? 0) > 37.0 ? "text-amber-600" : "text-slate-500"}`} />, val: patient.lastVitals.temperature ?? "—", unit: "°C", trend: trends.tempTrend, cls: (patient.lastVitals.temperature ?? 0) > 37.0 ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-slate-100", valCls: (patient.lastVitals.temperature ?? 0) > 37.0 ? "text-amber-700" : "text-slate-900" },
                              { icon: <Wind className="w-3.5 h-3.5 text-slate-500" />, val: patient.lastVitals.oxygenSaturation ?? "—", unit: "SpO2%", trend: trends.spo2Trend, cls: "bg-slate-50 border border-slate-100", valCls: "text-slate-900" },
                            ].map((v, i) => (
                              <div key={i} className={`p-2 rounded-lg ${v.cls}`}>
                                <div className="flex items-center gap-0.5 mb-1">{v.icon}<TrendIcon trend={v.trend} /></div>
                                <div className={`text-base font-bold leading-none ${v.valCls}`}>{v.val}</div>
                                <div className="text-[9px] text-slate-400 uppercase mt-0.5">{v.unit}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mb-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-400 text-center">No vitals recorded</div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {patient.admissionDate ? fmtDate(patient.admissionDate) : patient.createdAt ? fmtDate(patient.createdAt) : "—"}
                          </span>
                          <span className="text-slate-400">{patient.lastVitals ? fmtTime(patient.lastVitals.recordedAt) : "—"}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filteredPatients.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                  <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900 mb-1">No patients found</h3>
                  <p className="text-slate-500">Try adjusting your search or filters</p>
                </div>
              )}
            </div>

            {/* ── Detail Panel ── */}
            <AnimatePresence>
              {selectedPatient && (
                <motion.div
                  initial={{ opacity: 0, x: 20, width: 0 }} animate={{ opacity: 1, x: 0, width: "55%" }}
                  exit={{ opacity: 0, x: 20, width: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
                  className="sticky top-24 overflow-hidden"
                >
                  <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">

                    {/* Dark header */}
                    <div className="bg-slate-900 px-6 py-6">
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center text-2xl font-bold text-white">
                            {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white">{selectedPatient.firstName} {selectedPatient.lastName}</h2>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedPatient.patientCode}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 flex-wrap">
                              <span>{selectedPatient.age ?? (selectedPatient.dateOfBirth ? calcAge(selectedPatient.dateOfBirth) : "—")} yrs</span>
                              <span>•</span><span>{selectedPatient.sex}</span>
                              <span>•</span><span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{selectedPatient.bloodGroup}</span>
                              <span>•</span><span>{selectedPatient.maritalStatus}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {detailLoading && <Spinner className="w-4 h-4" />}
                          {/* Edit patient button */}
                          <button onClick={() => setModal("editPatient")} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Edit patient">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => fetchPatientDetail(selectedPatient.id)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button onClick={() => setSelectedId(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-700 flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5" />Room {selectedPatient.roomNumber || "—"} • {selectedPatient.bedNumber || "—"}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-700 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />{selectedPatient.phone}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-700 flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {selectedPatient.admissionDate ? fmtDate(selectedPatient.admissionDate) : selectedPatient.createdAt ? fmtDate(selectedPatient.createdAt) : "—"}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1.5 ${getStatusConfig(selectedPatient.vitalStatus).badge}`}>
                          <span className={`w-2 h-2 rounded-full ${getStatusConfig(selectedPatient.vitalStatus).dot}`} />
                          {selectedPatient.vitalStatus}
                        </span>
                        {!selectedPatient.isActive && (
                          <span className="px-2.5 py-1 bg-rose-900/40 text-rose-300 rounded-lg text-xs border border-rose-700 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Discharged
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-slate-200 px-4">
                      <div className="flex gap-0.5 -mb-px overflow-x-auto">
                        {([
                          { key: "overview"    as Tab, label: "Overview",  icon: User },
                          { key: "vitals"      as Tab, label: "Vitals",    icon: Activity },
                          { key: "notes"       as Tab, label: `Notes (${selectedPatient.progressNotes.length})`, icon: FileText },
                          { key: "medications" as Tab, label: `Meds (${selectedPatient.medications.length})`, icon: Pill },
                          { key: "tasks"       as Tab, label: `Tasks (${selectedPatient.tasks.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED").length})`, icon: ClipboardList },
                          { key: "labs"        as Tab, label: "Reports",   icon: FlaskConical },
                        ]).map(({ key, label, icon: Icon }) => (
                          <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-1.5 px-3 py-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tab content */}
                    <div className="p-5 max-h-[calc(100vh-380px)] overflow-y-auto">

                      {/* ── OVERVIEW ── */}
                      {activeTab === "overview" && (
                        <div className="space-y-6">
                          {/* Vitals summary */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Current Vitals</h3>
                              {selectedPatient.lastVitals && <span className="text-xs text-slate-400">Updated {fmtDateTime(selectedPatient.lastVitals.recordedAt)}</span>}
                            </div>
                            {selectedPatient.lastVitals ? (() => {
                              const lv = selectedPatient.lastVitals!;
                              const trends = getVitalTrends(selectedPatient);
                              return (
                                <div className="grid grid-cols-2 gap-2.5">
                                  {[
                                    { icon: <Heart className="w-4 h-4" />, label: "Heart Rate",    val: lv.heartRate ?? "—",        unit: "bpm",  trend: trends.hrTrend,   warn: (lv.heartRate ?? 0) > 100 },
                                    { icon: <Activity className="w-4 h-4" />, label: "Blood Pressure", val: lv.bloodPressure ?? "—",   unit: "mmHg", trend: trends.bpTrend },
                                    { icon: <Thermometer className="w-4 h-4" />, label: "Temperature", val: lv.temperature ?? "—",    unit: "°C",   trend: trends.tempTrend, warn: (lv.temperature ?? 0) > 37.0 },
                                    { icon: <Wind className="w-4 h-4" />, label: "SpO2",             val: lv.oxygenSaturation ?? "—", unit: "%",    trend: trends.spo2Trend, inverse: true, warn: (lv.oxygenSaturation ?? 100) < 95 },
                                    { icon: <Activity className="w-4 h-4" />, label: "Resp Rate",    val: lv.respiratoryRate ?? "—",  unit: "/min", trend: "stable" as const },
                                    { icon: <AlertCircle className="w-4 h-4" />, label: "Pain Score", val: lv.painScore != null ? `${lv.painScore}/10` : "—", unit: "", trend: "stable" as const, warn: (lv.painScore ?? 0) > 6 },
                                  ].map((v, i) => (
                                    <div key={i} className={`p-3 rounded-xl border ${v.warn ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <div className={`flex items-center gap-1.5 text-xs font-medium uppercase ${v.warn ? "text-amber-600" : "text-slate-400"}`}>{v.icon}{v.label}</div>
                                        <span className={`flex items-center gap-0.5 text-xs ${trendColor(v.trend, v.inverse)}`}><TrendIcon trend={v.trend} /></span>
                                      </div>
                                      <div className={`text-2xl font-bold ${v.warn ? "text-amber-700" : "text-slate-900"}`}>{v.val}</div>
                                      {v.unit && <div className="text-xs text-slate-400">{v.unit}</div>}
                                    </div>
                                  ))}
                                </div>
                              );
                            })() : (
                              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 text-center text-slate-400 text-sm">No vitals recorded — use &ldquo;Record Vitals&rdquo; below</div>
                            )}
                          </div>

                          {/* Patient info */}
                          <div>
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Patient Information</h3>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { icon: <Calendar className="w-3.5 h-3.5" />, label: "Date of Birth", val: selectedPatient.dateOfBirth ? fmtDate(selectedPatient.dateOfBirth) : "—", sub: selectedPatient.dateOfBirth ? `${calcAge(selectedPatient.dateOfBirth)} yrs old` : "" },
                                { icon: <Phone className="w-3.5 h-3.5" />, label: "Phone", val: selectedPatient.phone },
                                { icon: <MapPin className="w-3.5 h-3.5" />, label: "Address", val: selectedPatient.address || "—" },
                                { icon: <Users className="w-3.5 h-3.5" />, label: "Next of Kin", val: selectedPatient.nextOfKinName || "—", sub: [selectedPatient.nextOfKinRelationship, selectedPatient.nextOfKinPhone].filter(Boolean).join(" • ") },
                                { icon: <Building2 className="w-3.5 h-3.5" />, label: "Employer", val: selectedPatient.employerName || "—", sub: selectedPatient.employerAddress || "" },
                                { icon: <Bed className="w-3.5 h-3.5" />, label: "Room / Bed", val: `${selectedPatient.roomNumber || "—"} / ${selectedPatient.bedNumber || "—"}` },
                                { icon: <CalendarClock className="w-3.5 h-3.5" />, label: "Admitted", val: selectedPatient.admissionDate ? fmtDate(selectedPatient.admissionDate) : selectedPatient.createdAt ? fmtDate(selectedPatient.createdAt) : "—" },
                                { icon: <Clock className="w-3.5 h-3.5" />, label: "Discharge", val: selectedPatient.dischargeDate ? fmtDate(selectedPatient.dischargeDate) : "Active" },
                              ].map((d, i) => (
                                <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg">
                                  <span className="text-slate-400 mt-0.5 flex-shrink-0">{d.icon}</span>
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">{d.label}</p>
                                    <p className="font-medium text-slate-900 text-xs leading-snug">{d.val}</p>
                                    {d.sub && <p className="text-[10px] text-slate-500">{d.sub}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex gap-2">
                            <button onClick={() => setModal("addNote")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"><FileText className="w-3.5 h-3.5" />Add Note</button>
                            <button onClick={() => setModal("recordVitals")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"><Activity className="w-3.5 h-3.5" />Record Vitals</button>
                            <button onClick={() => setModal("addTask")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"><ClipboardList className="w-3.5 h-3.5" />Add Task</button>
                          </div>
                        </div>
                      )}

                      {/* ── VITALS TAB ── */}
                      {activeTab === "vitals" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Vitals History</h3>
                            <button onClick={() => setModal("recordVitals")} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"><Plus className="w-3.5 h-3.5" />Record New</button>
                          </div>
                          {detailLoading ? <div className="flex justify-center py-8"><Spinner /></div>
                          : selectedPatient.vitalsHistory.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No vitals recorded yet</div>
                          : selectedPatient.vitalsHistory.map((v, i) => (
                            <div key={v.id ?? i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-slate-900 text-sm">{fmtDateTime(v.recordedAt)}</span>
                                <span className="text-xs text-slate-500">{v.recordedBy?.fullName ?? "—"}{v.recordedBy?.role ? ` (${v.recordedBy.role})` : ""}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                                {[
                                  { label: "Heart Rate",    val: v.heartRate          ? `${v.heartRate} bpm`          : "—", warn: (v.heartRate ?? 0) > 100 },
                                  { label: "Blood Pressure",val: v.bloodPressure       ?? "—" },
                                  { label: "Temperature",   val: v.temperature         ? `${v.temperature}°C`          : "—", warn: (v.temperature ?? 0) > 37.0 },
                                  { label: "SpO2",          val: v.oxygenSaturation    ? `${v.oxygenSaturation}%`       : "—", warn: (v.oxygenSaturation ?? 100) < 95 },
                                  { label: "Resp Rate",     val: v.respiratoryRate     ? `${v.respiratoryRate}/min`     : "—" },
                                  { label: "Pain Score",    val: v.painScore != null   ? `${v.painScore}/10`            : "—", warn: (v.painScore ?? 0) > 6 },
                                  { label: "Weight",        val: v.weight              ? `${v.weight} kg`               : "—" },
                                  { label: "Height",        val: v.height              ? `${v.height} cm`               : "—" },
                                  { label: "BMI",           val: v.bmi                 ? `${v.bmi}`                     : "—" },
                                ].map((d, j) => (
                                  <div key={j}>
                                    <span className="text-slate-400 text-[10px] block mb-0.5">{d.label}</span>
                                    <span className={`font-semibold ${d.warn ? "text-amber-600" : "text-slate-900"}`}>{d.val}</span>
                                  </div>
                                ))}
                              </div>
                              {v.notes && <p className="text-xs text-slate-500 mt-2.5 pt-2 border-t border-slate-100 italic">{v.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── NOTES TAB ── */}
                      {activeTab === "notes" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Progress Notes</h3>
                            <button onClick={() => setModal("addNote")} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"><Plus className="w-3.5 h-3.5" />Add Note</button>
                          </div>
                          {detailLoading ? <div className="flex justify-center py-8"><Spinner /></div>
                          : selectedPatient.progressNotes.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No progress notes yet</div>
                          : selectedPatient.progressNotes.map(n => (
                            <div key={n.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{n.author?.fullName ?? "Staff"}</p>
                                  <p className="text-[10px] text-slate-400">{n.author?.role ?? ""} • {fmtDateTime(n.createdAt)}</p>
                                </div>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{n.note}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── MEDICATIONS TAB ── */}
                      {activeTab === "medications" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Active Medications</h3>
                            <button onClick={() => setModal("addMedication")} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"><Plus className="w-3.5 h-3.5" />Add</button>
                          </div>
                          {selectedPatient.medications.length === 0
                            ? <div className="text-center py-8 text-slate-400 text-sm">No medications prescribed</div>
                            : <div className="divide-y divide-slate-100">
                                {selectedPatient.medications.map(med => {
                                  const mc = medColorMap[med.color] ?? medColorMap.blue;
                                  return (
                                    <div key={med.id} className="py-3 flex items-center justify-between group">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl ${mc.bg} flex items-center justify-center`}><Pill className={`w-5 h-5 ${mc.text}`} /></div>
                                        <div><h4 className="font-semibold text-slate-900 text-sm">{med.name}</h4><p className="text-xs text-slate-500">{med.dose} • {med.freq} • {med.route}</p></div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200">Active</span>
                                        <button onClick={() => handleDeleteMedication(med.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                          }
                        </div>
                      )}

                      {/* ── TASKS TAB ── */}
                      {activeTab === "tasks" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Tasks</h3>
                            <button onClick={() => setModal("addTask")} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"><Plus className="w-3.5 h-3.5" />Add Task</button>
                          </div>
                          {detailLoading ? <div className="flex justify-center py-8"><Spinner /></div>
                          : selectedPatient.tasks.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No tasks yet</div>
                          : selectedPatient.tasks.map(task => (
                            <div key={task.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 group">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${taskPriorityBadge(task.priority)}`}>{task.priority}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${taskStatusBadge(task.status)}`}>{task.status.replace(/_/g," ")}</span>
                                    <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">{task.type.replace(/_/g," ")}</span>
                                  </div>
                                  <h4 className="font-semibold text-slate-900 text-sm">{task.title}</h4>
                                  {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                                    {task.dueTime && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />Due {fmtDateTime(task.dueTime)}</span>}
                                    {task.assignee && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{task.assignee.fullName}</span>}
                                    {task.creator && <span className="flex items-center gap-0.5"><PenLine className="w-3 h-3" />{task.creator.fullName}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
                                    <button onClick={() => handleUpdateTaskStatus(task.id, task.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED")}
                                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                      title={task.status === "PENDING" ? "Start" : "Mark complete"}>
                                      {task.status === "PENDING" ? <ChevronRight className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── REPORTS TAB ── */}
                      {activeTab === "labs" && (
                        <div className="space-y-6">

                          {/* Diagnostic Reports */}
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Diagnostic Reports</h3>
                            {detailLoading ? <div className="flex justify-center py-6"><Spinner /></div>
                            : selectedPatient.diagnosticReports.length === 0
                              ? <div className="text-center py-5 text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100">No diagnostic reports</div>
                              : <div className="space-y-2">
                                  {selectedPatient.diagnosticReports.map(r => (
                                    <div key={r.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">{r.reportType}</span>
                                            <span className="font-semibold text-slate-900 text-sm">{r.title}</span>
                                          </div>
                                          {r.description && <p className="text-xs text-slate-500 mb-1">{r.description}</p>}
                                          <p className="text-[10px] text-slate-400">{r.createdBy?.fullName ?? "Staff"} • {fmtDateTime(r.createdAt)}</p>
                                        </div>
                                        {r.fileUrl && (
                                          <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                                            className="ml-3 flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition flex-shrink-0">
                                            <FlaskConical className="w-3 h-3" />View
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                            }
                          </div>

                          {/* Treatment Plans */}
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Treatment Plans</h3>
                            {selectedPatient.treatmentPlans.length === 0
                              ? <div className="text-center py-5 text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100">No treatment plans</div>
                              : <div className="space-y-2">
                                  {selectedPatient.treatmentPlans.map(tp => (
                                    <div key={tp.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : tp.status === "COMPLETED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{tp.status}</span>
                                        <span className="text-[10px] text-slate-400">Started {fmtDate(tp.startDate)}</span>
                                      </div>
                                      <p className="text-sm text-slate-700">{tp.description}</p>
                                    </div>
                                  ))}
                                </div>
                            }
                          </div>

                          {/* Appointments */}
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Appointments</h3>
                            {selectedPatient.appointments.length === 0
                              ? <div className="text-center py-5 text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100">No appointments</div>
                              : <div className="space-y-2">
                                  {selectedPatient.appointments.map(a => (
                                    <div key={a.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-slate-900 text-sm">{a.reason}</p>
                                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><CalendarClock className="w-3 h-3" />{fmtDateTime(a.appointmentDateTime)}</p>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${a.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : a.status === "CANCELLED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{a.status}</span>
                                    </div>
                                  ))}
                                </div>
                            }
                          </div>

                        </div>
                      )}

                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}

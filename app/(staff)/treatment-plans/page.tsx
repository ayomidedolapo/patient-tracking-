'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
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
  Calendar,
  Loader2,
  RefreshCw,
  Shield,
  Edit3,
  Save,
  MoreVertical
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type TreatmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface Patient {
  id: number;
  patientCode: string;
  firstName: string;
  lastName: string;
  sex: string;
  age: number;
  bedNumber?: string;
  roomNumber?: string;
  vitalStatus?: string;
}

interface StaffMember {
  id: number;
  fullName: string;
  role: string;
  staffId: string;
}

interface Procedure {
  id: number;
  name: string;
  description?: string;
  scheduledDate: string;
  completed: boolean;
}

interface TreatmentPlan {
  id: number;
  patientId: number;
  description: string;
  status: TreatmentStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  createdBy?: StaffMember;
  assignedTo?: StaffMember | null;
  procedures?: Procedure[];
  _count?: {
    procedures: number;
  };
}

interface Me {
  id: number;
  fullName: string;
  email: string;
  role: string;
  staffId: string | null;
}

const statusConfig: Record<TreatmentStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  ACTIVE: { color: 'text-emerald-800', bg: 'bg-emerald-100', icon: Activity, label: 'Active' },
  COMPLETED: { color: 'text-blue-800', bg: 'bg-blue-100', icon: CheckCircle, label: 'Completed' },
  CANCELLED: { color: 'text-red-800', bg: 'bg-red-100', icon: X, label: 'Cancelled' }
};

const fieldCls = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';
const selectCls = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition';

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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
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

export default function TreatmentPlansPage() {
  const router = useRouter();
  
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TreatmentStatus | 'ALL'>('ALL');
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    patientId: '',
    description: '',
    status: 'ACTIVE' as TreatmentStatus,
    startDate: '',
    endDate: ''
  });

  const fetchMe = useCallback(async () => {
    setMeLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMe({
            id: data.data.id,
            fullName: data.data.fullName,
            email: data.data.email,
            role: data.data.role,
            staffId: data.data.staffId || null
          });
        }
      }
    } catch (e) {
      console.error('fetchMe error:', e);
    } finally {
      setMeLoading(false);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/patients?pageSize=1000', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (json.data ?? []);
      setPatients(arr);
    } catch (e) {
      console.error('fetchPatients error:', e);
      setPatients([]);
    }
  }, []);

  const fetchAllPlans = useCallback(async () => {
    if (patients.length === 0) return;
    
    try {
      const allPlans: TreatmentPlan[] = [];
      
      const planPromises = patients.slice(0, 100).map(async (patient: Patient) => {
        try {
          const res = await fetch(`/api/patients/${patient.id}/treatment-plans?pageSize=50`, {
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
              return data.data;
            }
          }
          return [];
        } catch (e) {
          console.error(`Failed to fetch plans for patient ${patient.id}:`, e);
          return [];
        }
      });

      const plansArrays = await Promise.all(planPromises);
      plansArrays.forEach(arr => allPlans.push(...arr));

      allPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPlans(allPlans);
    } catch (err) {
      console.error('fetchAllPlans error:', err);
    }
  }, [patients]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchMe();
      await fetchPatients();
    } catch (err) {
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
      fetchAllPlans();
    }
  }, [patients, fetchAllPlans]);

  const userRole = me?.role?.toString().trim().toUpperCase() || 'UNKNOWN';
  const canCreatePlan = userRole === 'ADMIN' || userRole === 'DOCTOR' || userRole === 'THERAPIST';
  const canEditPlan = (plan: TreatmentPlan) => {
    if (!me) return false;
    if (['ADMIN', 'DOCTOR'].includes(userRole)) return true;
    if (userRole === 'THERAPIST') {
      return plan.assignedTo?.id === me.id || plan.createdBy?.id === me.id;
    }
    return false;
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId) {
      setError('Please select a patient');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        description: formData.description,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate || null
      };

      const res = await fetch(`/api/patients/${formData.patientId}/treatment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to create plan (${res.status})`);
      }

      setIsCreateModalOpen(false);
      setSuccessMessage('Treatment plan created successfully');
      setFormData({
        patientId: '',
        description: '',
        status: 'ACTIVE',
        startDate: '',
        endDate: ''
      });
      
      fetchAllPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async (planId: number) => {
    if (!editingPlan) return;
    
    setSubmitting(true);
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const updateData: Partial<Pick<TreatmentPlan, "description" | "status" | "startDate" | "endDate">> = {};
      if (formData.description !== plan.description) updateData.description = formData.description;
      if (formData.status !== plan.status) updateData.status = formData.status;
      if (formData.startDate !== (plan.startDate ? plan.startDate.split('T')[0] : '')) updateData.startDate = formData.startDate;
      if (formData.endDate !== (plan.endDate ? plan.endDate.split('T')[0] : '')) updateData.endDate = formData.endDate || null;

      if (Object.keys(updateData).length === 0) {
        setEditingPlan(null);
        return;
      }

      const res = await fetch(`/api/treatment-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update plan');
      }

      setPlans(prev => prev.map(p => p.id === planId ? data.data : p));
      setEditingPlan(null);
      setSuccessMessage('Treatment plan updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (plan: TreatmentPlan) => {
    setEditingPlan(plan.id);
    setFormData({
      patientId: String(plan.patientId),
      description: plan.description,
      status: plan.status,
      startDate: plan.startDate ? plan.startDate.split('T')[0] : '',
      endDate: plan.endDate ? plan.endDate.split('T')[0] : ''
    });
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = 
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.patient?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.patient?.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.patient?.patientCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plan.assignedTo?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = filterStatus === 'ALL' || plan.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'ACTIVE').length,
    completed: plans.filter(p => p.status === 'COMPLETED').length,
    cancelled: plans.filter(p => p.status === 'CANCELLED').length
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
      <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCreateModalOpen ? 'blur-[2px]' : ''}`}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Stethoscope className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Treatment Plans</h1>
                  <p className="text-sm text-slate-500">Manage patient treatment plans and procedures</p>
                </div>
              </div>
              
              {canCreatePlan && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Plan</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Staff Banner */}
          {meLoading ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <span className="text-sm text-slate-500">Loading your profile...</span>
            </div>
          ) : me ? (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{me.fullName}</p>
                <p className="text-xs text-slate-500">
                  {me.role}
                  {me.staffId ? ` • ${me.staffId}` : ''}
                </p>
              </div>
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
              <div className="text-sm text-slate-500 mb-1 font-medium">Total Plans</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Active</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Completed</div>
              <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Cancelled</div>
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by patient, code, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={fieldCls + ' pl-10'}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TreatmentStatus | 'ALL')}
                className={selectCls}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Plans List */}
          <div className="space-y-4">
            {filteredPlans.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No treatment plans found</h3>
                <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
                {canCreatePlan && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Create Your First Plan
                  </button>
                )}
              </div>
            ) : (
              filteredPlans.map((plan) => {
                const StatusIcon = statusConfig[plan.status].icon;
                const isExpanded = expandedPlan === plan.id;
                const isEditing = editingPlan === plan.id;

                return (
                  <motion.div
                    key={plan.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => !isEditing && setExpandedPlan(isExpanded ? null : plan.id)}
                    >
                      <div className={`p-2 rounded-xl ${statusConfig[plan.status].bg} ${statusConfig[plan.status].color}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {plan.patient?.firstName} {plan.patient?.lastName}
                          </h3>
                          <span className="text-xs text-slate-400">({plan.patient?.patientCode})</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[plan.status].bg} ${statusConfig[plan.status].color}`}>
                            {plan.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                          <span className="truncate max-w-md">{plan.description}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(plan.startDate).toLocaleDateString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </span>
                          {plan.assignedTo && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Assigned to: {plan.assignedTo.fullName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canEditPlan(plan) && !isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(plan);
                            }}
                            className="p-2 hover:bg-indigo-100 rounded-full transition-colors text-indigo-600"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
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
                            {isEditing ? (
                              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                  <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className={fieldCls}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                      value={formData.status}
                                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TreatmentStatus })}
                                      className={selectCls}
                                    >
                                      <option value="ACTIVE">Active</option>
                                      <option value="COMPLETED">Completed</option>
                                      <option value="CANCELLED">Cancelled</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                    <input
                                      type="date"
                                      value={formData.startDate}
                                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                      className={fieldCls}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
                                  <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className={fieldCls}
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2">
                                  <button
                                    onClick={() => setEditingPlan(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdatePlan(plan.id)}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="bg-white p-3 rounded-xl border border-slate-200">
                                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Patient Information</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-slate-500">Name:</span>
                                      <p className="font-medium text-slate-900">{plan.patient?.firstName} {plan.patient?.lastName}</p>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Code:</span>
                                      <p className="font-medium text-slate-900">{plan.patient?.patientCode}</p>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Sex:</span>
                                      <p className="font-medium text-slate-900">{plan.patient?.sex}</p>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Age:</span>
                                      <p className="font-medium text-slate-900">{plan.patient?.age} years</p>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Full Description</h4>
                                  <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200">{plan.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Care Team</h4>
                                    <div className="space-y-2 text-sm">
                                      <div>
                                        <span className="text-slate-500">Created by:</span>
                                        <p className="font-medium text-slate-900">{plan.createdBy?.fullName} ({plan.createdBy?.role})</p>
                                      </div>
                                      {plan.assignedTo && (
                                        <div>
                                          <span className="text-slate-500">Assigned to:</span>
                                          <p className="font-medium text-slate-900">{plan.assignedTo.fullName} ({plan.assignedTo.role})</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Timeline</h4>
                                    <div className="space-y-2 text-sm">
                                      <div>
                                        <span className="text-slate-500">Start:</span>
                                        <p className="font-medium text-slate-900">{new Date(plan.startDate).toLocaleDateString()}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">End:</span>
                                        <p className="font-medium text-slate-900">{plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'Ongoing'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {plan.procedures && plan.procedures.length > 0 && (
                                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Procedures ({plan.procedures.length})</h4>
                                    <div className="space-y-2">
                                      {plan.procedures.map((proc) => (
                                        <div key={proc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                          <div>
                                            <p className="font-medium text-slate-900 text-sm">{proc.name}</p>
                                            <p className="text-xs text-slate-500">{new Date(proc.scheduledDate).toLocaleDateString()}</p>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${proc.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {proc.completed ? 'Done' : 'Pending'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                                  <div className="flex gap-4">
                                    <span>Plan ID: <span className="font-mono text-slate-900">{plan.id}</span></span>
                                  </div>
                                  <span>Last updated: <span className="text-slate-900">{new Date(plan.updatedAt).toLocaleString()}</span></span>
                                </div>
                              </>
                            )}
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

      {/* Create Plan Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !submitting && setIsCreateModalOpen(false)}
        title="Create New Treatment Plan"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreatePlan} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Enter treatment plan description..."
                className={fieldCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TreatmentStatus })}
                className={selectCls}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={fieldCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date (Optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={fieldCls}
              />
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
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><Plus className="w-4 h-4" /> Create Plan</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

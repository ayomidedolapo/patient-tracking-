// app/(staff)/vitals/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Heart, Thermometer, XCircle, Check } from 'lucide-react';

interface Vital {
  id: number;
  patientId: number;
  recordedByUserId: number;
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  recordedAt: string;
  recordedBy?: { fullName: string };
  patient?: { firstName: string; lastName: string; patientCode: string };
}

export default function VitalsPage() {
  const [allVitals, setAllVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patients, setPatients] = useState<{id: number, firstName: string, lastName: string}[]>([]);

  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');

  const loadAllVitals = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    // Step 1: Get all patients
    const patientsRes = await fetch('/api/patients');
    const patientsData = await patientsRes.json();
    const patientsList = Array.isArray(patientsData) ? patientsData : patientsData.data || [];
    setPatients(patientsList);

    // Step 2: Get vitals for each patient
    const allVitalsArray: Vital[] = [];
    
    for (const patient of patientsList) {
      try {
        const res = await fetch(`/api/patients/${patient.id}/vitals?pageSize=100`);
        const data = await res.json();
        const vitals = Array.isArray(data) ? data : data.data || [];
        allVitalsArray.push(...vitals);
      } catch {
        console.log(`No vitals for patient ${patient.id}`);
      }
    }

    // Sort by recordedAt descending (newest first)
    allVitalsArray.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    
    setAllVitals(allVitalsArray);
    setLoading(false);
  }, []);

  // Load ALL vitals from database on mount
  useEffect(() => {
    void Promise.resolve().then(() => loadAllVitals(false));
  }, [loadAllVitals]);

  const saveVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    const body: Record<string, string | number> = {};
    if (bloodPressure) body.bloodPressure = bloodPressure;
    if (heartRate) body.heartRate = parseInt(heartRate);
    if (temperature) body.temperature = parseFloat(temperature);

    await fetch(`/api/patients/${selectedPatientId}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    // Reset and reload
    setIsModalOpen(false);
    setSelectedPatientId('');
    setBloodPressure('');
    setHeartRate('');
    setTemperature('');
    void loadAllVitals();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 text-slate-700">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-7 h-7 text-sky-500" />
            All Vitals ({allVitals.length})
          </h1>
          
          {/* <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-sky-500 text-white px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Vital
          </button> */}
        </div>

        {/* Display ALL vitals from database */}
        {allVitals.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No vitals in database</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-slate-700">
            {allVitals.map((vital) => (
              <div key={vital.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold">
                    {vital.patient?.firstName?.[0] || 'P'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{vital.patient?.firstName} {vital.patient?.lastName}</p>
                    <p className="text-xs text-slate-400">{new Date(vital.recordedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-rose-50 p-3 rounded-xl text-center">
                    <Heart className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    <p className="font-bold text-rose-600">{vital.bloodPressure || '-'}</p>
                    <p className="text-xs text-rose-400">BP</p>
                  </div>
                  <div className="bg-rose-50 p-3 rounded-xl text-center">
                    <Activity className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    <p className="font-bold text-rose-600">{vital.heartRate ?? '-'}</p>
                    <p className="text-xs text-rose-400">HR</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl text-center">
                    <Thermometer className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                    <p className="font-bold text-amber-600">{vital.temperature ?? '-'}</p>
                    <p className="text-xs text-amber-400">Temp</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-3">
                  By: {vital.recordedBy?.fullName || `Staff #${vital.recordedByUserId}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Vital</h3>
              <button onClick={() => setIsModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400" /></button>
            </div>

            <form onSubmit={saveVital} className="space-y-4">
              <select
                required
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl"
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Blood Pressure (120/80)"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl"
              />
              <input
                type="number"
                placeholder="Heart Rate (bpm)"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Temperature (°C)"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl"
              />

              <button type="submit" className="w-full bg-sky-500 text-white py-2 rounded-xl flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

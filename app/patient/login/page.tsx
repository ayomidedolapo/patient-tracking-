// app/patient/login/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, X, User, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface PatientSearchResult {
  id: number;
  patientCode: string;
  firstName: string;
  lastName: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback = "Request failed") =>
  error instanceof Error ? error.message : fallback;

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function PatientLoginPage() {
  const router = useRouter();

  const [patientCode, setPatientCode] = useState("");
  const [showPatientCode, setShowPatientCode] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPatientName, setSuccessPatientName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    setErr(null);

    // Validate format PAT-XXXXXX
    const codeRegex = /^PAT-\d{6}$/;
    if (!codeRegex.test(patientCode.trim().toUpperCase())) {
      setErr("Invalid format. Use: PAT-000001");
      return;
    }

    try {
      setSending(true);

      // Search for patient by patientCode
      const res = await apiFetch<ApiResponse<PatientSearchResult[]>>(
        `/api/patients?search=${encodeURIComponent(patientCode.trim().toUpperCase())}&pageSize=100`
      );

      const patients = res.data || [];
      const matchedPatient = patients.find(
        (p) => p.patientCode === patientCode.trim().toUpperCase()
      );

      if (!matchedPatient) {
        setErr("Invalid patient code. Please check and try again.");
        return;
      }

      // Store patient info
      localStorage.setItem("patientId", String(matchedPatient.id));
      localStorage.setItem("patientCode", matchedPatient.patientCode);
      localStorage.setItem(
        "patientName",
        `${matchedPatient.firstName} ${matchedPatient.lastName}`
      );

      setSuccessPatientName(`${matchedPatient.firstName} ${matchedPatient.lastName}`);
      setSuccessOpen(true);

      setTimeout(() => {
        router.push("/patient/dashboard");
      }, 1400);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#eef5fb" }}
    >
      {/* background */}
      <div className="absolute inset-0">
        <Image
          src="/uploads/bg-fomr.jpeg"
          alt="Medical background"
          fill
          priority
          className="object-cover opacity-30"
        />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        {/* logo */}
        <Image
          src="/uploads/med-logo.png"
          alt="Medical logo"
          width={220}
          height={80}
          className="mb-6 h-auto w-[220px]"
          priority
        />

        {/* login card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[440px] rounded-[18px] border border-white/60 bg-white/95 px-8 pb-8 pt-7 shadow-[0_24px_80px_rgba(2,16,36,0.22)] backdrop-blur-xl"
        >
          <div className="text-center">
            <h1 className="text-[26px] font-semibold tracking-tight text-[#052659]">
              Patient Access
            </h1>

            <p className="mt-2 text-[14px] text-slate-500">
              View your health records and appointment details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {/* patient code */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#052659]">
                Patient Code
              </label>

              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />

                <input
                  type={showPatientCode ? "text" : "password"}
                  placeholder="Enter patient code (e.g., PAT-000001)"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value.toUpperCase())}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40 font-mono tracking-wide"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPatientCode((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7DA0CA] hover:text-[#052659]"
                  aria-label={showPatientCode ? "Hide code" : "Show code"}
                >
                  {showPatientCode ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Format: PAT- followed by 6 digits
              </p>
            </div>

            {/* error */}
            {err && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {err}
              </div>
            )}

            {/* button */}
            <button
              type="submit"
              disabled={sending}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#0A6DFF] text-sm font-semibold text-white shadow-[0_16px_34px_rgba(10,109,255,0.24)] transition hover:bg-[#005DE2] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending ? "Accessing..." : "Access My Records"}
            </button>

            <div className="rounded-2xl border border-[#C1E8FF] bg-[#C1E8FF]/20 px-4 py-4 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-[#7DA0CA] flex-shrink-0" />
                <p>
                  Lost your patient code? Contact hospital administration or check your admission documents.
                </p>
              </div>
            </div>
          </form>
        </motion.div>
      </div>

      {/* success notification */}
      <AnimatePresence>
        {successOpen && (
          <>
            {/* mobile: slide down from topsy */}
            <motion.div
              initial={{ opacity: 0, y: -32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -32 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed left-4 right-4 top-4 z-50 sm:hidden"
            >
              <div className="relative rounded-[24px] border border-white/60 bg-white/95 p-4 shadow-[0_24px_80px_rgba(2,16,36,0.20)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setSuccessOpen(false)}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-3 pr-7">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C1E8FF]/55">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A6DFF] text-white shadow-[0_8px_18px_rgba(10,109,255,0.22)]">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-[#052659]">
                      Access granted
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Welcome{" "}
                      <span className="font-semibold text-slate-700">
                        {successPatientName}
                      </span>
                      . Redirecting to your patient portal.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* desktop/tablet: slide from right */}
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed right-4 top-4 z-50 hidden w-full max-w-[380px] sm:block"
            >
              <div className="relative rounded-[24px] border border-white/60 bg-white/95 p-4 shadow-[0_24px_80px_rgba(2,16,36,0.20)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setSuccessOpen(false)}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-3 pr-7">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C1E8FF]/55">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A6DFF] text-white shadow-[0_8px_18px_rgba(10,109,255,0.22)]">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-[#052659]">
                      Access granted
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Welcome{" "}
                      <span className="font-semibold text-slate-700">
                        {successPatientName}
                      </span>
                      . Redirecting to your patient portal.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

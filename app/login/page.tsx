/* app/login/page.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
  UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type StaffRole = "DOCTOR" | "NURSE" | "THERAPIST";

type LoginResponse = {
  success: boolean;
  error?: string;
  data?: {
    id: number;
    email: string;
    fullName: string;
    staffId: string | null;
    role: StaffRole | "ADMIN" | "PATIENT";
  };
};

const roleOptions: { label: string; value: StaffRole }[] = [
  { label: "Doctor", value: "DOCTOR" },
  { label: "Nurse", value: "NURSE" },
  { label: "Therapist", value: "THERAPIST" },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffIdInput, setStaffIdInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<StaffRole>("DOCTOR");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successUserName, setSuccessUserName] = useState("");
  const [successRole, setSuccessRole] = useState<StaffRole | "ADMIN" | "PATIENT" | "">("");

  const selectedRoleLabel = useMemo(
    () => roleOptions.find((r) => r.value === selectedRole)?.label ?? "Doctor",
    [selectedRole]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    setErr(null);

    if (!email.trim()) {
      setErr("Email is required.");
      return;
    }

    if (!password.trim()) {
      setErr("Password is required.");
      return;
    }

    if (!staffIdInput.trim()) {
      setErr("Staff ID is required.");
      return;
    }

    if (!selectedRole) {
      setErr("Please select your role before signing in.");
      return;
    }

    try {
      setSending(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          staffId: staffIdInput.trim().toUpperCase(),
          role: selectedRole,
        }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok || !data.success || !data.data) {
        setErr(data.error || "Unable to sign in.");
        return;
      }

      if (data.data.role !== selectedRole) {
        setErr(
          `This account is registered as ${formatRoleLabel(
            data.data.role
          )}. Please select the correct role.`
        );
        return;
      }

      if (data.data.staffId !== staffIdInput.trim().toUpperCase()) {
        setErr("Invalid Staff ID. Please check your Staff ID and try again.");
        return;
      }

      setSuccessUserName(data.data.fullName || "User");
      setSuccessRole(data.data.role);
      setSuccessOpen(true);

      setTimeout(() => {
        router.push("/dashboard");
      }, 1400);
    } catch (error) {
      console.error("Login error:", error);
      setErr("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#eef5fb" }}
    >
      <div className="absolute inset-0">
        <Image
          src="/uploads/bg-fomr.jpeg"
          alt="Medical background"
          fill
          priority
          className="object-cover opacity-20"
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative grid w-full overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(2,16,36,0.12)] backdrop-blur-xl lg:grid-cols-[1fr_1.02fr]"
        >
          <FloatingShape className="left-[5%] top-[18%]" />
          <FloatingShape className="right-[7%] top-[8%]" delay={0.3} />
          <FloatingShape className="bottom-[12%] left-[52%]" delay={0.6} />
          <FloatingShape className="bottom-[8%] right-[12%]" delay={0.9} />

          <section className="relative hidden min-h-[760px] overflow-hidden px-8 py-8 lg:block xl:px-10">
            <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_left,rgba(193,232,255,0.8),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(84,131,179,0.12),transparent_28%)]" />

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center gap-3">
                <Image
                  src="/uploads/med-logo.png"
                  alt="Medic logo"
                  width={128}
                  height={38}
                  className="h-auto w-[118px]"
                />
              </div>

              <div className="relative mt-10 flex flex-1 items-end justify-center">
                <div className="absolute left-6 top-10 h-[520px] w-[78%] rounded-[34px] bg-gradient-to-br from-[#C1E8FF] via-[#5483B3] to-[#052659] shadow-[0_20px_60px_rgba(84,131,179,0.28)]" />
                <div className="absolute left-0 top-20 h-[300px] w-[240px] rounded-full bg-[#C1E8FF]/70 blur-3xl" />
                <div className="absolute bottom-10 right-2 h-[180px] w-[180px] rounded-full bg-white/30 blur-2xl" />

                <motion.div
                  initial={{ opacity: 0, x: -24, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
                  className="relative z-10 flex h-full w-full items-end justify-center"
                >
                  <Image
                    src="/uploads/DOCTOR.png"
                    alt="Doctor"
                    width={560}
                    height={760}
                    priority
                    className="h-auto max-h-[710px] w-auto object-contain drop-shadow-[0_18px_40px_rgba(2,16,36,0.18)]"
                  />
                </motion.div>

                <MetricBadge
                  className="left-0 top-[55%]"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Protected clinical access"
                />
                <MetricBadge
                  className="bottom-14 right-8"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Role-based workspace"
                />
              </div>
            </div>
          </section>

          <section className="relative flex min-h-[760px] items-center px-6 py-10 sm:px-10 lg:px-12 xl:px-14">
            <div className="mx-auto w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <h1 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight text-[#052659] sm:text-[38px]">
                  Let&apos;s protect your workflow and patient information with
                  secure access.
                </h1>
                <p className="mt-4 max-w-lg text-[15px] leading-7 text-slate-500">
                  Sign in with your verified staff role and Staff ID to access only the
                  medical tools and records assigned to your department.
                </p>
              </motion.div>

              <motion.form
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.22 }}
                className="mt-10 space-y-6"
                onSubmit={handleSubmit}
              >
                <FormField label="Email Address">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                    />
                  </div>
                </FormField>

                <FormField label="Password">
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7DA0CA] transition hover:text-[#052659]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Department / Role">
                    <div className="relative">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as StaffRole)}
                        className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm text-slate-700 outline-none transition focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />
                    </div>
                  </FormField>

                  <FormField label="Staff ID Number">
                    <div className="relative">
                      <UserCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />
                      <input
                        type="text"
                        placeholder="e.g., DOC-2024-001"
                        value={staffIdInput}
                        onChange={(e) => setStaffIdInput(e.target.value.toUpperCase())}
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                      />
                    </div>
                  </FormField>
                </div>

                {err ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {err}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={sending}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#0A6DFF] text-sm font-semibold text-white shadow-[0_16px_34px_rgba(10,109,255,0.24)] transition duration-300 hover:translate-y-[-1px] hover:bg-[#005DE2] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {sending ? "Signing In..." : "Sign In"}
                </button>

                <div className="rounded-2xl border border-[#C1E8FF] bg-[#C1E8FF]/20 px-4 py-4 text-sm text-slate-600">
                  You are signing in as{" "}
                  <span className="font-semibold text-[#052659]">
                    {selectedRoleLabel}
                  </span>
                  . Your Staff ID, email, and role must match the authenticated account before access is granted.
                </div>
              </motion.form>
            </div>
          </section>
        </motion.div>
      </div>

      <AnimatePresence>
        {successOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#021024]/35 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white p-7 shadow-[0_28px_80px_rgba(2,16,36,0.22)]"
            >
              <button
                type="button"
                onClick={() => setSuccessOpen(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#C1E8FF]/55">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0A6DFF] text-white shadow-[0_12px_24px_rgba(10,109,255,0.25)]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
              </div>

              <h2 className="mt-6 text-center text-2xl font-semibold tracking-tight text-[#052659]">
                Sign in successful
              </h2>

              <p className="mt-3 text-center text-sm leading-7 text-slate-500">
                Welcome back,{" "}
                <span className="font-semibold text-slate-700">
                  {successUserName}
                </span>
                . Your{" "}
                <span className="font-semibold text-[#052659]">
                  {formatRoleLabel(successRole)}
                </span>{" "}
                workspace is ready and syncing securely.
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Redirecting you to the dashboard...
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#0A6DFF] text-sm font-semibold text-white transition hover:bg-[#005DE2]"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-semibold text-[#052659]">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricBadge({
  className,
  icon,
  label,
}: {
  className?: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`absolute z-20 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-sm font-medium text-[#052659] shadow-[0_18px_40px_rgba(2,16,36,0.12)] ${
        className || ""
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C1E8FF] text-[#5483B3]">
        {icon}
      </span>
      <span>{label}</span>
    </motion.div>
  );
}

function FloatingShape({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={{
        duration: 3.2,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`absolute z-20 h-6 w-6 ${className || ""}`}
    >
      <div className="absolute left-1/2 top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5483B3]" />
      <div className="absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5483B3]" />
      <div className="absolute inset-0 rotate-45">
        <div className="absolute left-1/2 top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7DA0CA]" />
        <div className="absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7DA0CA]" />
      </div>
    </motion.div>
  );
}

function formatRoleLabel(role?: string) {
  if (role === "ADMIN") return "Administrator";
  if (role === "DOCTOR") return "Doctor";
  if (role === "NURSE") return "Nurse";
  if (role === "THERAPIST") return "Therapist";
  if (role === "PATIENT") return "Patient";
  return "Staff";
}
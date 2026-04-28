"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, LockKeyhole, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  success: boolean;
  error?: string;
  data?: {
    id: number;
    email: string;
    fullName: string;
    role: string;
  };
};

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successUserName, setSuccessUserName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    setErr(null);

    try {
      setSending(true);

      // Login with just email and password - backend will check role
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          // No staffId needed - backend validates role
        }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok || !data.success) {
        setErr(data.error || "Unable to sign in.");
        return;
      }

      // Check if user is admin on the frontend as well
      if (data.data?.role !== "ADMIN") {
        setErr("Access denied. Admin privileges required.");
        return;
      }

      setSuccessUserName(data.data?.fullName || "Administrator");
      setSuccessOpen(true);

      setTimeout(() => {
        router.push("/admin/dashboard");
      }, 1400);
    } catch {
      setErr("Something went wrong. Please try again.");
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
              Admin Sign In
            </h1>

            <p className="mt-2 text-[14px] text-slate-500">
              Securely access the medical administration workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {/* email */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#052659]">
                Email Address
              </label>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />

                <input
                  type="email"
                  placeholder="Enter admin email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                  required
                />
              </div>
            </div>

            {/* password */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#052659]">
                Password
              </label>

              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7DA0CA]" />

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5483B3] focus:bg-white focus:ring-4 focus:ring-[#C1E8FF]/40"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7DA0CA] hover:text-[#052659]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
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
              {sending ? "Signing In..." : "Continue"}
            </button>

            <div className="rounded-2xl border border-[#C1E8FF] bg-[#C1E8FF]/20 px-4 py-4 text-sm text-slate-600">
              Only authorized administrators can access this portal.
            </div>
          </form>
        </motion.div>
      </div>

      {/* success notification */}
      <AnimatePresence>
        {successOpen && (
          <>
            {/* mobile: slide down from top */}
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
                      Sign in successful
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Welcome back{" "}
                      <span className="font-semibold text-slate-700">
                        {successUserName}
                      </span>
                      . Redirecting to admin dashboard.
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
                      Sign in successful
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Welcome back{" "}
                      <span className="font-semibold text-slate-700">
                        {successUserName}
                      </span>
                      . Redirecting to admin dashboard.
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
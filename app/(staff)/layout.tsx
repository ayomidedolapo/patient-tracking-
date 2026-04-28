"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldPlus,
  Stethoscope,
  Users,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type MeResponse = {
  success: boolean;
  data?: {
    id: number;
    fullName?: string;
    email?: string;
    role?: "ADMIN" | "DOCTOR" | "NURSE" | "THERAPIST" | "PATIENT";
  };
  error?: string;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  roles?: ("ADMIN" | "DOCTOR" | "NURSE" | "THERAPIST" | "PATIENT")[];
};

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Patients", href: "/patients", icon: Users },
  { 
    label: "Appointments", 
    href: "/appointments", 
    icon: CalendarDays,
    roles: ["ADMIN", "DOCTOR", "NURSE", "THERAPIST"] 
  },
  { 
    label: "Vitals", 
    href: "/vitals", 
    icon: Activity,
    roles: ["ADMIN", "DOCTOR", "NURSE"] 
  },
  { 
    label: "Diagnostics", 
    href: "/diagnostics", 
    icon: FlaskConical,
    roles: ["ADMIN", "DOCTOR", "NURSE"] 
  },
  { 
    label: "Treatment Plans", 
    href: "/treatment-plans", 
    icon: Stethoscope,
    roles: ["ADMIN", "DOCTOR", "THERAPIST"] 
  },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<MeResponse["data"] | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json: MeResponse = await res.json();
        if (!active) return;
        if (res.ok && json.success) setMe(json.data || null);
      } catch {
        if (!active) return;
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  const profileName = useMemo(() => {
    return me?.fullName || "Medical User";
  }, [me]);

  const profileRole = useMemo(() => {
    const role = me?.role || "STAFF";
    if (role === "DOCTOR") return "Doctor";
    if (role === "NURSE") return "Nurse";
    if (role === "THERAPIST") return "Therapist";
    if (role === "ADMIN") return "Administrator";
    return "Staff";
  }, [me]);

  const userRole = me?.role;

  // Filter items based on role
  const visibleItems = useMemo(() => {
    if (!userRole || userRole === "ADMIN") return sidebarItems;
    return sidebarItems.filter(
      (item) => !item.roles || item.roles.includes(userRole)
    );
  }, [userRole]);

  async function handleLogout() {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function SidebarContent({ isMobile = false }: { isMobile?: boolean }) {
    return (
      <div className="flex h-full flex-col">
        {/* Logo Section - Fixed */}
        <div className={`flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'justify-between'} px-4 py-5`}>
          <Link href="/dashboard" className="flex items-center gap-3">
            {!isCollapsed || isMobile ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div className={isCollapsed && !isMobile ? 'hidden' : 'block'}>
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">MEDICAL CARE</h1>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Hospital System</p>
                </div>
              </>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Activity className="h-5 w-5" />
              </div>
            )}
          </Link>
          
          {/* Collapse toggle - Desktop only */}
          {!isMobile && !isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {!isMobile && isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700"
              title="Expand sidebar"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {!isCollapsed && (
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Main Menu
            </div>
          )}
          
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setMobileOpen(false)}
                className={`group relative flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                  isActive 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm"
                }`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                
                {(!isCollapsed || isMobile) && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <motion.div
                        layoutId={isMobile ? "mobileActiveIndicator" : "activeIndicator"}
                        className="h-1.5 w-1.5 rounded-full bg-blue-600"
                      />
                    ) : null}
                  </>
                )}
                
                {/* Tooltip for collapsed desktop state */}
                {isCollapsed && !isMobile && (
                  <div className="absolute left-full ml-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-all group-hover:block group-hover:opacity-100 z-50">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - User Profile Only */}
        <div className="border-t border-slate-100 px-3 py-4">
          {!isCollapsed || isMobile ? (
            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
                  {profileName[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {profileName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{profileRole}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
                {profileName[0]?.toUpperCase() || "U"}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`flex w-full items-center ${isCollapsed && !isMobile ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50`}
          >
            <LogOut className="h-4 w-4" />
            {(!isCollapsed || isMobile) && (loggingOut ? "Logging out..." : "Log out")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside 
        className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-slate-200 bg-white transition-all duration-300 ease-in-out lg:block ${
          isCollapsed ? "w-[80px]" : "w-[260px]"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 z-50 h-screen w-[280px] border-r border-slate-200 bg-white shadow-2xl lg:hidden"
            >
              <SidebarContent isMobile={true} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main 
        className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "lg:ml-[80px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Mobile Header - Fixed Responsiveness */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition active:scale-95 hover:bg-slate-50"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Activity className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900">MEDICALCARE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
              {profileName[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>

        {/* Page Content - Fixed Padding */}
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
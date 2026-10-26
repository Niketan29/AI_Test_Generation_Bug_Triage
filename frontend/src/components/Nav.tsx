"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/api";
import {
  LayoutDashboard,
  FileCheck2,
  Bug,
  Layers,
  Sparkles,
  Database,
  LogOut,
  Zap,
  Activity,
  ShieldCheck,
} from "lucide-react";

const items = [
  {
    href: "/",
    label: "Dashboard",
    hint: "Overview & system analytics",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    href: "/test-cases",
    label: "Test Case Generator",
    hint: "Requirements to Word & Excel",
    icon: FileCheck2,
    badge: "AI",
  },
  {
    href: "/bugs",
    label: "Bug Triage",
    hint: "Duplicates, severity & priority",
    icon: Bug,
    badge: null,
  },
  {
    href: "/batch",
    label: "Batch Triage",
    hint: "Triage up to 25 reports at once",
    icon: Layers,
    badge: "Batch",
  },
  {
    href: "/chat",
    label: "QA Copilot",
    hint: "Autonomous conversational agent",
    icon: Sparkles,
    badge: "Copilot",
  },
  {
    href: "/data",
    label: "Ask the Data",
    hint: "Natural language over SQL DB",
    icon: Database,
    badge: null,
  },
];

export default function Nav({ user, onLogout }: { user: SessionUser | null; onLogout: () => void }) {
  const path = usePathname();

  return (
    <aside className="flex flex-col bg-[#070c18] border-r border-white/[0.08] text-slate-300 md:sticky md:top-0 md:h-screen md:overflow-y-auto z-30">
      {/* Brand Header */}
      <div className="p-5 pb-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/25 transition-transform duration-200 group-hover:scale-105">
            <Zap className="h-5 w-5 fill-slate-950 stroke-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400"></span>
            </span>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 font-bold text-white text-[15px] tracking-tight">
              <span>TestPilot</span>
              <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 border border-teal-500/30">QA</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              <span>MagOneAI Active</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-3 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">Main Navigation</div>
      </div>

      {/* Navigation Items */}
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible" aria-label="Main">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-transparent text-white border border-teal-500/30 shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-teal-400 to-emerald-400 shadow-sm shadow-teal-400" aria-hidden="true" />
              )}
              
              <div className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
                active ? "bg-teal-500 text-slate-950 font-semibold" : "bg-white/[0.04] text-slate-400 group-hover:bg-white/[0.08] group-hover:text-slate-200"
              }`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`block truncate ${active ? "font-semibold text-white" : "font-medium"}`}>
                    {it.label}
                  </span>
                  {it.badge && (
                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.2 text-[9px] font-bold text-slate-300 uppercase tracking-wider">
                      {it.badge}
                    </span>
                  )}
                </div>
                <span className="hidden text-[11px] text-slate-400 truncate md:block">
                  {it.hint}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* System Status Pill Box */}
      <div className="mt-auto px-4 py-2 hidden md:block">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-slate-400">
          <div className="flex items-center justify-between font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Activity className="h-3.5 w-3.5 text-teal-400" />
              Pipeline Telemetry
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">100% OK</span>
          </div>
          <div className="grid gap-1 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span>Database</span>
              <span className="text-slate-300 font-mono text-[10px]">Neon PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Orchestrator</span>
              <span className="text-slate-300 font-mono text-[10px]">MagOneAI Server</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Section */}
      <div className="border-t border-white/[0.08] p-3">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 text-xs font-bold text-white shadow-sm" aria-hidden="true">
              {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#070c18]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-white">{user.name}</div>
              <div className="truncate text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-teal-400 shrink-0" />
                <span className="truncate">{user.role}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 px-2 py-1">Guest Session</div>
        )}
      </div>
    </aside>
  );
}

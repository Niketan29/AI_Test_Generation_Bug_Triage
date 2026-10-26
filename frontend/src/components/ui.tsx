"use client";

import type { RunStatus, StoredRun } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  History,
  Trash2,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <header className="relative flex flex-wrap items-end justify-between gap-4 pb-2 border-b border-line/60">
      <div className="grid gap-1.5">
        {eyebrow && (
          <div className="flex items-center gap-2">
            <span className="eyebrow">
              <Sparkles className="h-3 w-3" />
              {eyebrow}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent border border-accent/20">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <h1 className="page-title">{title}</h1>
        </div>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2.5">{right}</div>}
    </header>
  );
}

export function RunBar({
  status,
  elapsed,
  error,
  label,
}: {
  status: RunStatus;
  elapsed: number;
  error: string | null;
  label?: string;
}) {
  if (status === "idle") return null;
  const busy = status !== "completed" && status !== "failed";
  
  const tone =
    status === "failed"
      ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
      : status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-200";

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all ${tone}`} role="status">
      {busy && (
        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-teal-500/20">
          <div className="h-full w-1/3 bg-teal-500 animate-[shimmer_1.5s_infinite_linear] rounded-full" />
        </div>
      )}
      
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          {busy ? (
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-300">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : status === "completed" ? (
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/20 text-red-600 dark:text-red-300">
              <XCircle className="h-4 w-4" />
            </div>
          )}

          <div>
            <div className="font-semibold text-sm">
              {status === "starting" && "Initiating MagOneAI Agent Workflow…"}
              {(status === "pending" || status === "running") && (label ?? "Running workflow on MagOneAI…")}
              {status === "waiting_for_input" && "Workflow waiting for human input"}
              {status === "completed" && "Execution completed successfully"}
              {status === "failed" && "Execution encountered an error"}
            </div>
            {busy && (
              <div className="text-xs opacity-75 mt-0.5">
                Results will automatically appear below when ready
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-surface/50 border border-line px-2.5 py-1 text-xs font-mono font-medium">
          <Clock className="h-3 w-3 opacity-60" />
          <span>{elapsed}s</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="font-mono">{error}</span>
        </div>
      )}
    </div>
  );
}

const tones: Record<string, { bg: string; dot: string }> = {
  Critical: { bg: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", dot: "bg-red-500" },
  High: { bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  Medium: { bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
  Low: { bg: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500" },
  P0: { bg: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", dot: "bg-red-500" },
  P1: { bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  P2: { bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
  P3: { bg: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500" },
  duplicate: { bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", dot: "bg-purple-500" },
  possible_duplicate: { bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  new: { bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  positive: { bg: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30", dot: "bg-teal-500" },
  negative: { bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", dot: "bg-rose-500" },
  boundary: { bg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30", dot: "bg-indigo-500" },
  ok: { bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  invalid: { bg: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500" },
  completed: { bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  failed: { bg: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", dot: "bg-red-500" },
};

export function Chip({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted text-xs">—</span>;
  const t = tones[value] ?? { bg: "bg-surface-2 text-muted border-line", dot: "bg-muted" };
  return (
    <span className={`chip border ${t.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      <span>{value.replace(/_/g, " ")}</span>
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: string | React.ElementType;
}) {
  return (
    <div className="tile group hover:border-accent/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {label}
        </span>
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent transition-transform group-hover:scale-110">
          {typeof icon === "string" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon} />
            </svg>
          ) : icon ? (
            <>{(() => { const Comp = icon; return <Comp className="h-4 w-4" />; })()}</>
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
      <div className="text-[1.85rem] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {hint && <div className="text-xs text-muted leading-tight">{hint}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Section({
  title,
  children,
  right,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <section className="card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/50 pb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-accent" />}
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  const Fallback = Icon ?? FileText;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 px-6 py-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-muted mb-3">
        <Fallback className="h-5 w-5" />
      </div>
      <div className="text-sm text-muted font-medium max-w-sm mx-auto">{children}</div>
    </div>
  );
}

export function Bars({ data, order }: { data: Record<string, number>; order: string[] }) {
  const max = Math.max(1, ...Object.values(data));
  const keys = [...order.filter((k) => k in data), ...Object.keys(data).filter((k) => !order.includes(k))];
  if (keys.length === 0) return <Empty>No breakdown data</Empty>;
  return (
    <div className="grid gap-3.5">
      {keys.map((k) => {
        const count = data[k] ?? 0;
        const pct = Math.round((count / max) * 100);
        return (
          <div key={k} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <Chip value={k} />
              <span className="tabular-nums font-semibold text-xs text-foreground">
                {count} <span className="text-muted font-normal">({pct}%)</span>
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RunHistory<T>({
  history,
  currentId,
  onPick,
  onClear,
}: {
  history: StoredRun<T>[];
  currentId?: string | null;
  onPick: (r: StoredRun<T>) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;
  return (
    <details className="card group overflow-hidden text-sm">
      <summary className="flex cursor-pointer items-center justify-between p-4 font-semibold text-foreground hover:bg-surface-2/50 transition-colors">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <span>Execution History</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
            {history.length} runs saved
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted hover:text-red-500 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
        </div>
      </summary>
      
      <div className="border-t border-line divide-y divide-line p-2">
        {history.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            className={`w-full flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl text-left transition-colors ${
              r.id === currentId
                ? "bg-accent-soft/80 text-foreground border border-accent/20"
                : "hover:bg-surface-2 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
              <span className="truncate font-medium text-xs md:text-sm">{r.label}</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Chip value={r.status} />
              <span className="text-[11px] text-muted font-mono">{fmtDate(r.startedAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </details>
  );
}

export function fmtDate(s?: string | number | null) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

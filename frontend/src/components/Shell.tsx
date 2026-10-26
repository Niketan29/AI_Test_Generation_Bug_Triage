"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { auth, type SessionUser } from "@/lib/api";
import { Sparkles, Cpu } from "lucide-react";

const UserContext = createContext<SessionUser | null>(null);
export const useUser = () => useContext(UserContext);

const PATH_TITLES: Record<string, string> = {
  "/": "Overview & Analytics",
  "/test-cases": "Test Case Generator",
  "/bugs": "Bug Triage & De-duplication",
  "/batch": "High-Volume Batch Triage",
  "/chat": "QA Autonomous Copilot",
  "/data": "Natural Language DB Query",
};

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<"checking" | "ok" | "anon">("checking");
  const isLogin = path.startsWith("/login");

  useEffect(() => {
    if (isLogin) return;
    let alive = true;
    auth.me()
      .then((u) => { if (alive) { setUser(u); setState("ok"); } })
      .catch(() => { if (alive) { setState("anon"); router.replace(`/login?next=${encodeURIComponent(path)}`); } });
    return () => { alive = false; };
  }, [isLogin, path, router]);

  if (isLogin) return <>{children}</>;

  if (state !== "ok") {
    return (
      <div className="min-h-screen bg-[#070c18] grid place-items-center text-slate-400 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-teal-500/20 animate-pulse">
              <Cpu className="h-6 w-6" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">TestPilot QA Environment</h2>
            <p className="text-xs text-slate-400 mt-1">
              {state === "checking" ? "Authenticating session with Trinity Auth…" : "Redirecting to secure login…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentTitle = PATH_TITLES[path] || "Workspace";

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen md:grid md:grid-cols-[260px_minmax(0,1fr)] bg-background">
        <Nav
          user={user}
          onLogout={async () => {
            try {
              await auth.logout();
            } finally {
              setUser(null);
              setState("anon");
              router.replace("/login");
            }
          }}
        />
        
        <div className="flex flex-col min-w-0">
          {/* Top Bar Navigation */}
          <header className="sticky top-0 z-20 hidden md:flex items-center justify-between border-b border-line bg-surface/80 backdrop-blur-md px-8 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>TestPilot</span>
                <span>/</span>
                <span className="font-semibold text-foreground">{currentTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-xl bg-surface-2 border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:border-accent/40 transition-colors shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                <span>Ask QA Copilot anything</span>
                <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted border border-line">Ctrl + K</kbd>
              </Link>
              
              <div className="h-4 w-[1px] bg-line" />
              
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-[11px] text-foreground">Neon DB Online</span>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}

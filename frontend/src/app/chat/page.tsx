"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, loadJSON, saveJSON, type RunResponse } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import {
  Sparkles,
  Send,
  Plus,
  User,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  FileCheck2,
  Bug,
  Database,
  ArrowUpRight,
} from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}
interface ChatState {
  messages: Msg[];
  sessionId: string | null;
  pendingToken: string | null;
}

const KEY = "chat:state";
const STARTERS = [
  {
    icon: FileCheck2,
    title: "Generate Test Cases",
    prompt: "Write test cases for: as a shopper I can apply one coupon code at checkout; invalid codes show an error and the total is unchanged.",
  },
  {
    icon: Bug,
    title: "Triage Defect Report",
    prompt: "Triage this bug: gift card balance is applied twice when the same code is entered twice on the payment step, so a $50 card covers a $100 order. Production, all users.",
  },
  {
    icon: Database,
    title: "Query Historical Telemetry",
    prompt: "How many bug reports have been filed so far, and what severity did each get?",
  },
  {
    icon: Sparkles,
    title: "Duplicate Investigation",
    prompt: "Is 'search returns nothing when the query has a leading space' already reported?",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pendingToken = useRef<string | null>(null);

  const persist = (m: Msg[], s: string | null, t: string | null) =>
    saveJSON(KEY, { messages: m, sessionId: s, pendingToken: t } satisfies ChatState);

  useEffect(() => {
    const st = loadJSON<ChatState | null>(KEY, null);
    if (st) {
      setMessages(st.messages);
      setSessionId(st.sessionId);
      pendingToken.current = st.pendingToken;
      if (st.pendingToken) void finish(st.pendingToken, st.messages, st.sessionId);
    }
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function finish(token: string, base: Msg[], session: string | null) {
    setBusy(true);
    try {
      let cur = await apiGet<RunResponse>(`/api/runs/${token}`);
      while (cur.status !== "completed" && cur.status !== "failed") {
        await new Promise((r) => setTimeout(r, 3000));
        cur = await apiGet<RunResponse>(`/api/runs/${token}`);
      }
      const reply =
        cur.status === "failed"
          ? `The copilot run failed: ${typeof cur.error === "string" ? cur.error : JSON.stringify(cur.error)}`
          : String((cur.output as { response?: string } | null)?.response ?? "(no response)");
      const next = base.map((x, i) =>
        i === base.length - 1 && x.pending ? { role: "assistant" as const, text: reply } : x
      );
      setMessages(next);
      pendingToken.current = null;
      persist(next, session, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      const next = base.filter((x) => !x.pending);
      setMessages(next);
      pendingToken.current = null;
      persist(next, session, null);
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null);
    setInput("");
    const withUser: Msg[] = [
      ...messages,
      { role: "user", text },
      { role: "assistant", text: "", pending: true },
    ];
    setMessages(withUser);
    persist(withUser, sessionId, null);
    setBusy(true);

    try {
      const first = await apiPost<RunResponse>("/api/chat", {
        message: text,
        session_id: sessionId ?? undefined,
      });
      const sid = first.session_id ?? sessionId;
      if (sid !== sessionId) setSessionId(sid);
      if (first.status === "completed" || first.status === "failed" || !first.poll_token) {
        const reply =
          first.status === "failed"
            ? `The copilot run failed: ${JSON.stringify(first.error)}`
            : String((first.output as { response?: string } | null)?.response ?? "(no response)");
        const next = withUser.map((x, i) =>
          i === withUser.length - 1 ? { role: "assistant" as const, text: reply } : x
        );
        setMessages(next);
        persist(next, sid, null);
        setBusy(false);
        return;
      }
      pendingToken.current = first.poll_token;
      persist(withUser, sid, first.poll_token);
      await finish(first.poll_token, withUser, sid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      const next = withUser.filter((x) => !x.pending);
      setMessages(next);
      persist(next, sessionId, null);
      setBusy(false);
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    pendingToken.current = null;
    persist([], null, null);
  }

  const copyText = (t: string, idx: number) => {
    navigator.clipboard.writeText(t);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] gap-4">
      <PageHeader
        icon={Sparkles}
        eyebrow="Autonomous Agent"
        title="QA Copilot"
        sub="One conversational agent routing requests to all QA engines: test cases, duplicate analysis, severity estimation, and SQL database queries."
        right={
          <>
            {sessionId && (
              <span className="mono text-xs text-muted bg-surface-2 border border-line px-2.5 py-1 rounded-md">
                Session {sessionId.slice(0, 8)}…
              </span>
            )}
            <button type="button" className="btn-ghost" onClick={newChat}>
              <Plus className="h-3.5 w-3.5" />
              <span>New Conversation</span>
            </button>
          </>
        }
      />

      {/* Chat Messages Panel */}
      <div className="card flex-1 min-h-0 overflow-y-auto p-4 md:p-6 border-teal-500/20">
        {hydrated && messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center max-w-2xl mx-auto py-8">
            <div className="text-center mb-6">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/20 mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">How can I assist your QA testing today?</h3>
              <p className="text-xs md:text-sm text-muted mt-1">
                Select a workflow template below or type your request in natural language.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {STARTERS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(s.prompt)}
                    className="group flex flex-col justify-between rounded-xl border border-line bg-surface-2/40 p-3.5 text-left transition-all hover:bg-surface-2 hover:border-accent/50 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between font-semibold text-xs text-foreground mb-1">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-accent" />
                        {s.title}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted group-hover:text-accent transition-colors" />
                    </div>
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">{s.prompt}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 max-w-3xl mx-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 text-sm ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-sm mt-1">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                    m.role === "user"
                      ? "bg-accent text-white shadow-md shadow-accent/20"
                      : "bg-surface-2/60 border border-line text-foreground"
                  }`}
                >
                  {m.pending ? (
                    <div className="flex items-center gap-3 text-muted py-1">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      <span className="text-xs">
                        Synthesizing response and routing through MagOneAI pipelines…
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap font-sans">{m.text}</div>
                      {m.role === "assistant" && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => copyText(m.text, i)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
                          >
                            {copiedIdx === i ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-3 text-foreground border border-line shadow-sm mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Floating Query Prompt Bar */}
      <form
        className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          id="chat-input"
          className="flex-1 bg-transparent px-3 py-1.5 text-sm outline-none text-foreground placeholder:text-muted"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask copilot to generate cases, triage defects, or query data..."
          disabled={busy}
        />
        <button
          type="submit"
          className="btn h-9 px-4 text-xs shrink-0"
          disabled={busy || !input.trim()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}

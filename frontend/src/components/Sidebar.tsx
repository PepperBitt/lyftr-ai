import React from "react";
import {
  Activity,
  Check,
  Clock,
  Copy,
  Cpu,
  Database,
  MessageSquare,
  Plus,
  Settings2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { HealthResponse } from "../types";

interface SidebarProps {
  sessionId: string;
  savedSessions: string[];
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError?: string | null;
  onOpenSystemPrompt: () => void;
  systemPrompt: string;
  onToggleResilienceLab: () => void;
  isResilienceLabOpen: boolean;
  activeSimulation: string | null;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessionId,
  savedSessions,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  health,
  healthLoading,
  healthError,
  onOpenSystemPrompt,
  systemPrompt,
  onToggleResilienceLab,
  isResilienceLabOpen,
  activeSimulation,
  onCloseMobile,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHealthy = health?.status === "ok";
  const isNoKeys = healthError?.includes("no API keys");

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col bg-[#F8FAFC] dark:bg-[#0b1120] border-r border-[#E2E8F0] dark:border-[#1f2d47] h-full text-[#172033] dark:text-slate-300 select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20 border border-emerald-400/40">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-wide text-[#172033] dark:text-white flex items-center gap-2">
                LYFTR AI
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 font-semibold">
                  GATEWAY
                </span>
              </div>
              <div className="text-xs text-[#64748B] dark:text-slate-400 font-mono">
                Inference Control Center
              </div>
            </div>
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1f2d47] transition-colors"
              aria-label="Close sidebar drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Workspace Pill */}
        <div className="mt-2 px-2.5 py-1.5 rounded-md bg-white dark:bg-[#161f33] border border-[#E2E8F0] dark:border-[#1f2d47] flex items-center justify-between text-xs shadow-xs">
          <span className="text-[#64748B] dark:text-slate-400">Workspace:</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            default
          </span>
        </div>
      </div>

      {/* Primary Actions: New Session */}
      <div className="p-4 flex flex-col gap-3 border-b border-[#E2E8F0] dark:border-[#1f2d47]/70">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-md shadow-emerald-700/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Session</span>
        </button>

        {/* Current Active Session Card */}
        <div className="p-3 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-1.5 shadow-xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Current Session</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              data-testid="session-id-display"
              className="font-mono text-xs text-[#172033] dark:text-slate-200 font-medium truncate max-w-[190px]"
            >
              {sessionId}
            </span>
            <button
              onClick={copySessionId}
              title="Copy Session ID"
              className="p-1 rounded text-slate-400 hover:text-[#172033] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1f2d47] transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation: Saved Sessions History & Controls */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-4 overflow-y-auto">
        {/* Usable Session Navigation List */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-500 uppercase tracking-wider px-2 flex items-center justify-between">
            <span>Sessions History</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
              {savedSessions.length}
            </span>
          </div>

          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
            {savedSessions.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-600 italic px-2 py-1">
                No saved sessions yet.
              </div>
            ) : (
              savedSessions.map((id) => {
                const isActive = id === sessionId;
                return (
                  <div
                    key={id}
                    data-testid={`session-item-${id}`}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono transition-all ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold"
                        : "hover:bg-slate-200/60 dark:hover:bg-[#161f33] text-[#64748B] hover:text-[#172033] dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <button
                      onClick={() => onSelectSession(id)}
                      className="flex-1 text-left flex items-center gap-2 truncate"
                      title={`Switch to session ${id}`}
                    >
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{id}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </button>

                    {!isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(id);
                        }}
                        title="Remove from history list"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Control Panel Items */}
        <div className="flex flex-col gap-1 pt-2 border-t border-[#E2E8F0] dark:border-[#1f2d47]/50">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-500 uppercase tracking-wider px-2 py-1">
            Control Panel
          </div>

          {/* System Prompt Settings */}
          <button
            onClick={onOpenSystemPrompt}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-200/60 dark:hover:bg-[#161f33] text-sm text-[#172033] dark:text-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>System Prompt</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-medium">
              {systemPrompt.length > 20 ? "Custom" : "Default"}
            </span>
          </button>

          {/* Resilience Lab Toggle */}
          <button
            onClick={onToggleResilienceLab}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
              isResilienceLabOpen || activeSimulation
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 font-medium"
                : "hover:bg-slate-200/60 dark:hover:bg-[#161f33] text-[#172033] dark:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Resilience Lab</span>
            </div>
            {activeSimulation ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold animate-pulse">
                ARMED
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-medium">
                Test
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Persistence & Gateway Health Footer */}
      <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-2.5 bg-slate-100/70 dark:bg-[#070b14]/60">
        {/* SQLite Indicator */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#64748B] dark:text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>SQLite WAL</span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
            /data/app.db
          </span>
        </div>

        {/* Backend Gateway Health */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#64748B] dark:text-slate-400">
            <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Gateway</span>
          </div>
          {healthLoading ? (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Checking...</span>
          ) : isHealthy ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {health?.last_inference_verified ? "Gemini Verified" : `${health?.keys_configured} Keys Active`}
            </span>
          ) : isNoKeys ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              0 Keys (Unset)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Degraded
            </span>
          )}
        </div>

        {/* Version */}
        <div className="text-[10px] text-slate-400 dark:text-slate-600 font-mono text-center pt-1 border-t border-[#E2E8F0] dark:border-[#1f2d47]/50">
          LYFTR AI v1.0.0 • LiteLLM Gateway
        </div>
      </div>
    </aside>
  );
};

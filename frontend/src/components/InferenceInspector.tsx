import React from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Database,
  History,
  Layers,
  Server,
  X,
  Zap,
} from "lucide-react";
import { HealthResponse, MessageMetadata, MessagesApiResponse } from "../types";
import { formatLatency } from "../lib/utils";
import { fetchSessionHistory } from "../api/client";

interface InferenceInspectorProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError?: string | null;
  latestMetadata: MessageMetadata | null;
  sessionId: string;
  totalMessages: number;
  onCloseMobile?: () => void;
}

export const InferenceInspector: React.FC<InferenceInspectorProps> = ({
  health,
  healthLoading,
  healthError,
  latestMetadata,
  sessionId,
  totalMessages,
  onCloseMobile,
}) => {
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyData, setHistoryData] = React.useState<MessagesApiResponse | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchSessionHistory(sessionId);
      setHistoryData(data);
      setHistoryOpen(true);
    } catch (err: any) {
      setHistoryError(err.message || "Failed to fetch history");
      setHistoryOpen(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const isHealthy = health?.status === "ok";
  const isNoKeys = healthError?.includes("no API keys");

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-[#F8FAFC] dark:bg-[#0b1120] border-l border-[#E2E8F0] dark:border-[#1f2d47] h-full overflow-y-auto text-[#172033] dark:text-slate-300 p-4 gap-4 select-none transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1f2d47]">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-semibold text-sm text-[#172033] dark:text-slate-100 tracking-wide">
            Inference Inspector
          </h2>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="xl:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1f2d47] transition-colors"
            aria-label="Close inspector drawer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Gateway Health Status */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
            Gateway Cluster
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
              isHealthy
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                : isNoKeys
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthy
                  ? "bg-emerald-500 animate-pulse"
                  : isNoKeys
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            ></span>
            {healthLoading
              ? "Checking..."
              : isHealthy
              ? (health?.last_inference_verified ? "Verified Live" : "Operational")
              : isNoKeys
              ? "Keys Unset (.env)"
              : "Offline"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded bg-slate-100 dark:bg-[#161f33] border border-[#E2E8F0] dark:border-[#1f2d47]/70">
            <div className="text-[10px] text-[#64748B] dark:text-slate-400">
              Key Pool ({health?.provider?.toUpperCase() || "GEMINI"})
            </div>
            <div className="text-sm font-bold text-[#172033] dark:text-slate-100 mt-0.5">
              {health?.keys_configured ?? 0} Keys
            </div>
          </div>
          <div className="p-2 rounded bg-slate-100 dark:bg-[#161f33] border border-[#E2E8F0] dark:border-[#1f2d47]/70">
            <div className="text-[10px] text-[#64748B] dark:text-slate-400">LiteLLM Cache</div>
            <div className="text-sm font-bold text-cyan-700 dark:text-cyan-400 mt-0.5">
              {health?.cache_enabled ? "Active" : "Disabled"}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Inference Telemetry */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
            Latest Telemetry
          </span>
          {latestMetadata && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                latestMetadata.resolution_source === "LLM_CACHE"
                  ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30"
                  : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
              }`}
            >
              {latestMetadata.resolution_source}
            </span>
          )}
        </div>

        {latestMetadata ? (
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Model:
              </span>
              <span className="text-[#172033] dark:text-slate-200 text-[11px] truncate max-w-[140px] font-medium" title={latestMetadata.model}>
                {latestMetadata.model}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Latency:
              </span>
              <span className="text-amber-700 dark:text-amber-300 font-semibold">
                {formatLatency(latestMetadata.latency_ms)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Input Tokens:
              </span>
              <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                {latestMetadata.input_tokens}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Output Tokens:
              </span>
              <span className="text-purple-700 dark:text-purple-300 font-semibold">
                {latestMetadata.output_tokens}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Served By:
              </span>
              <span className="text-[#172033] dark:text-slate-200 font-bold">
                {latestMetadata.key_id ? (
                  <span className="text-emerald-700 dark:text-emerald-400">{latestMetadata.key_id}</span>
                ) : (
                  <span className="text-cyan-700 dark:text-cyan-400">In-Memory Cache</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-[#161f33]">
              <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Fallback Attempts:
              </span>
              <span className={latestMetadata.fallback_attempts > 0 ? "text-amber-700 dark:text-amber-400 font-bold" : "text-[#64748B] dark:text-slate-400"}>
                {latestMetadata.fallback_attempts}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">
            No inference requests made yet in this session.
          </div>
        )}
      </div>

      {/* Verified SQLite History Inspector */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] flex flex-col gap-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
            SQLite Storage
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {totalMessages} msgs
          </span>
        </div>

        <button
          onClick={loadHistory}
          disabled={historyLoading}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#161f33] dark:hover:bg-[#1f2d47] border border-[#E2E8F0] dark:border-[#1f2d47] text-xs font-medium text-[#172033] dark:text-slate-200 transition-colors"
        >
          <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{historyLoading ? "Querying SQLite..." : "Verify Stored History"}</span>
        </button>

        {historyOpen && (
          <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#070b14] border border-[#E2E8F0] dark:border-[#1f2d47] text-xs font-mono max-h-48 overflow-y-auto">
            {historyError ? (
              <div className="text-rose-600 dark:text-rose-400">{historyError}</div>
            ) : historyData?.messages.length ? (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold border-b border-[#E2E8F0] dark:border-[#1f2d47] pb-1">
                  GET /sessions/{sessionId}/messages
                </div>
                {historyData.messages.map((m, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5 text-[11px] border-b border-[#E2E8F0] dark:border-[#1f2d47]/40 pb-1">
                    <span className={m.role === "user" ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-[#172033] dark:text-slate-300 font-bold"}>
                      [{m.role}]:
                    </span>
                    <span className="text-[#64748B] dark:text-slate-400 truncate">{m.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 dark:text-slate-500">No messages saved yet for this session.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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
  Zap,
} from "lucide-react";
import { HealthResponse, MessageMetadata, MessagesApiResponse } from "../types";
import { formatLatency } from "../lib/utils";
import { fetchSessionHistory } from "../api/client";

interface InferenceInspectorProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  latestMetadata: MessageMetadata | null;
  sessionId: string;
  totalMessages: number;
}

export const InferenceInspector: React.FC<InferenceInspectorProps> = ({
  health,
  healthLoading,
  latestMetadata,
  sessionId,
  totalMessages,
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

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-[#0b1120] border-l border-[#1f2d47] h-full overflow-y-auto text-slate-300 p-4 gap-4 select-none">
      <div className="flex items-center gap-2 pb-3 border-b border-[#1f2d47]">
        <Server className="w-4 h-4 text-emerald-400" />
        <h2 className="font-semibold text-sm text-slate-100 tracking-wide">
          Inference Inspector
        </h2>
      </div>

      {/* Gateway Health Status */}
      <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1f2d47] flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Gateway Cluster
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
              isHealthy
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthy ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            ></span>
            {healthLoading ? "Checking..." : isHealthy ? "Operational" : "Offline"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded bg-[#161f33] border border-[#1f2d47]/70">
            <div className="text-[10px] text-slate-400">Key Pool</div>
            <div className="text-sm font-bold text-slate-100 mt-0.5">
              {health?.keys_configured ?? 0} Keys
            </div>
          </div>
          <div className="p-2 rounded bg-[#161f33] border border-[#1f2d47]/70">
            <div className="text-[10px] text-slate-400">LiteLLM Cache</div>
            <div className="text-sm font-bold text-cyan-400 mt-0.5">
              {health?.cache_enabled ? "Active" : "Disabled"}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Inference Telemetry */}
      <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1f2d47] flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Latest Telemetry
          </span>
          {latestMetadata && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                latestMetadata.resolution_source === "LLM_CACHE"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {latestMetadata.resolution_source}
            </span>
          )}
        </div>

        {latestMetadata ? (
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                Model:
              </span>
              <span className="text-slate-200 text-[11px] truncate max-w-[140px]" title={latestMetadata.model}>
                {latestMetadata.model}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Latency:
              </span>
              <span className="text-amber-300 font-semibold">
                {formatLatency(latestMetadata.latency_ms)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-400" />
                Input Tokens:
              </span>
              <span className="text-indigo-300 font-semibold">
                {latestMetadata.input_tokens}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" />
                Output Tokens:
              </span>
              <span className="text-purple-300 font-semibold">
                {latestMetadata.output_tokens}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Served By:
              </span>
              <span className="text-slate-200 font-bold">
                {latestMetadata.key_id ? (
                  <span className="text-emerald-400">{latestMetadata.key_id}</span>
                ) : (
                  <span className="text-cyan-400">In-Memory Cache</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#161f33]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Fallback Attempts:
              </span>
              <span className={latestMetadata.fallback_attempts > 0 ? "text-amber-400 font-bold" : "text-slate-400"}>
                {latestMetadata.fallback_attempts}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic text-center py-4">
            No inference requests made yet in this session.
          </div>
        )}
      </div>

      {/* Verified SQLite History Inspector */}
      <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1f2d47] flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            SQLite Storage
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {totalMessages} msgs
          </span>
        </div>

        <button
          onClick={loadHistory}
          disabled={historyLoading}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#161f33] hover:bg-[#1f2d47] border border-[#1f2d47] text-xs font-medium text-slate-200 transition-colors"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>{historyLoading ? "Querying SQLite..." : "Verify Stored History"}</span>
        </button>

        {historyOpen && (
          <div className="mt-2 p-2.5 rounded-lg bg-[#070b14] border border-[#1f2d47] text-xs font-mono max-h-48 overflow-y-auto">
            {historyError ? (
              <div className="text-rose-400">{historyError}</div>
            ) : historyData?.messages.length ? (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-emerald-400 font-bold border-b border-[#1f2d47] pb-1">
                  GET /sessions/{sessionId}/messages
                </div>
                {historyData.messages.map((m, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5 text-[11px] border-b border-[#1f2d47]/40 pb-1">
                    <span className={m.role === "user" ? "text-emerald-400 font-bold" : "text-slate-300 font-bold"}>
                      [{m.role}]:
                    </span>
                    <span className="text-slate-400 truncate">{m.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500">No messages saved yet for this session.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

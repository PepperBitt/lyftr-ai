import React from "react";
import { Check, Copy, Terminal, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "../types";
import { formatLatency } from "../lib/utils";

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-2xl bg-emerald-950/40 border border-emerald-700/30 text-emerald-100 rounded-2xl px-5 py-3 shadow-md">
          <div className="text-xs font-mono text-emerald-400/80 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            User
          </div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-2xl bg-rose-950/30 border border-rose-500/30 text-rose-200 rounded-2xl px-5 py-3 shadow-md">
          <div className="text-xs font-mono text-rose-400 font-bold mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
            Gateway Error
          </div>
          <div className="text-sm font-mono leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant response with required data-testids
  const meta = message.metadata;
  const isCache = meta?.resolution_source === "LLM_CACHE";

  return (
    <div
      data-testid="assistant-message"
      className="flex flex-col mb-6 bg-[#0f172a]/60 border border-[#1f2d47] rounded-2xl p-5 shadow-lg relative group transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1f2d47]/70">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
              isCache
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {isCache ? <Zap className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
          </div>
          <span className="font-semibold text-xs text-slate-200 font-mono tracking-wide">
            LYFTR Assistant
          </span>
          <span
            data-testid="meta-model"
            className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-[#161f33] border border-[#1f2d47]"
          >
            {meta?.model || "unknown-model"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 bg-[#161f33] px-2 py-1 rounded border border-[#1f2d47] transition-colors"
          title="Copy message content"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Message content formatted in Markdown */}
      <div className="text-sm text-slate-200 leading-relaxed prose prose-invert prose-emerald max-w-none break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>

      {/* Metadata Telemetry Badges */}
      {meta && (
        <div className="mt-4 pt-3 border-t border-[#1f2d47]/70 flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Resolution Source */}
          <div
            data-testid="meta-source"
            className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${
              isCache
                ? "bg-cyan-950/40 text-cyan-300 border-cyan-500/30"
                : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isCache ? "bg-cyan-400" : "bg-emerald-400"}`}
            ></span>
            {meta.resolution_source}
          </div>

          {/* Key ID or Cached */}
          <div className="px-2 py-1 rounded bg-[#161f33] text-slate-300 border border-[#1f2d47] text-[11px]">
            Key:{" "}
            {isCache ? (
              <span className="text-cyan-300 font-semibold">Cached</span>
            ) : (
              <span className="text-emerald-300 font-semibold">{meta.key_id || "none"}</span>
            )}
          </div>

          {/* Latency */}
          <div className="px-2 py-1 rounded bg-[#161f33] text-slate-300 border border-[#1f2d47] text-[11px]">
            Latency:{" "}
            <span data-testid="meta-latency" className="text-amber-300 font-semibold">
              {formatLatency(meta.latency_ms)}
            </span>
          </div>

          {/* Input Tokens */}
          <div className="px-2 py-1 rounded bg-[#161f33] text-slate-300 border border-[#1f2d47] text-[11px]">
            Input:{" "}
            <span data-testid="meta-input-tokens" className="text-indigo-300 font-semibold">
              {meta.input_tokens}
            </span>
          </div>

          {/* Output Tokens */}
          <div className="px-2 py-1 rounded bg-[#161f33] text-slate-300 border border-[#1f2d47] text-[11px]">
            Output:{" "}
            <span data-testid="meta-output-tokens" className="text-purple-300 font-semibold">
              {meta.output_tokens}
            </span>
          </div>

          {/* Fallback Attempts */}
          {meta.fallback_attempts > 0 && (
            <div className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
              ⚡ Fallbacks: {meta.fallback_attempts}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

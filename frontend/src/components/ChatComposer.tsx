import React from "react";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatComposerProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onSelectPrompt: (prompt: string) => void;
  showSuggestions: boolean;
}

const SUGGESTED_PROMPTS = [
  "Explain how LLM key failover works.",
  "What happens when an API key receives HTTP 429?",
  "How does response caching reduce latency?",
  "Explain multi-turn conversation context.",
];

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isLoading,
  onSelectPrompt,
  showSuggestions,
}) => {
  const [input, setInput] = React.useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-[#1f2d47] bg-[#070b14]/90 flex flex-col gap-3">
      {/* Suggested Prompts Cards */}
      {showSuggestions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSelectPrompt(prompt)}
              className="text-left p-3 rounded-lg bg-[#111827] hover:bg-[#161f33] border border-[#1f2d47] hover:border-emerald-500/40 text-xs text-slate-300 hover:text-white transition-all shadow-sm"
            >
              <div className="font-medium text-slate-200">{prompt}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                Click to send prompt
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Composer Input Box */}
      <div className="relative rounded-xl bg-[#0b1120] border border-[#1f2d47] focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40 transition-all shadow-inner">
        <textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or enter inference query (Enter to send, Shift+Enter for newline)..."
          disabled={isLoading}
          rows={2}
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 p-3 pr-14 text-sm focus:outline-none resize-none disabled:opacity-50"
        />

        <button
          data-testid="send-button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="absolute right-2.5 bottom-2.5 w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1f2d47] disabled:text-slate-600 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
          title="Send message"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <span>Non-streaming REST Gateway • Exact-match LiteLLM Cache</span>
        <span>Enter ↵ send • Shift+Enter ↵ new line</span>
      </div>
    </div>
  );
};

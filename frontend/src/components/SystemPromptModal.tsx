import React from "react";
import { Settings2, X } from "lucide-react";

interface SystemPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSavePrompt: (prompt: string) => void;
}

const DEFAULT_PROMPT = "You are a helpful AI assistant.";

export const SystemPromptModal: React.FC<SystemPromptModalProps> = ({
  isOpen,
  onClose,
  systemPrompt,
  onSavePrompt,
}) => {
  const [draft, setDraft] = React.useState(systemPrompt);

  React.useEffect(() => {
    setDraft(systemPrompt);
  }, [systemPrompt]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePrompt(draft.trim() || DEFAULT_PROMPT);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_PROMPT);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-[#0b1120] border border-[#E2E8F0] dark:border-[#1f2d47] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1f2d47] flex items-center justify-between bg-slate-50 dark:bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#172033] dark:text-slate-100">
                System Prompt Settings
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Configures the system instruction sent with session queries.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1f2d47] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3">
          <label className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider font-mono">
            System Instruction
          </label>
          <textarea
            data-testid="system-prompt-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="Enter custom system prompt..."
            className="w-full bg-slate-50 dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] rounded-xl p-3 text-sm text-[#172033] dark:text-slate-100 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 resize-none font-sans leading-relaxed"
          />
          <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-slate-500 font-mono">
            <span>{draft.length} characters</span>
            <button
              onClick={handleReset}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1f2d47] bg-slate-50 dark:bg-[#111827] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-[#161f33] hover:bg-slate-300 dark:hover:bg-[#1f2d47] text-[#172033] dark:text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-md shadow-emerald-700/20"
          >
            Save Prompt
          </button>
        </div>
      </div>
    </div>
  );
};

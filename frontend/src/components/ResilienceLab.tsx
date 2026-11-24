import React from "react";
import { AlertTriangle, CheckCircle, Flame, ShieldAlert, Sparkles, X } from "lucide-react";

interface ResilienceLabProps {
  isOpen: boolean;
  onClose: () => void;
  activeSimulation: string | null;
  onSelectSimulation: (header: string | null) => void;
}

const PRESETS = [
  {
    id: "p1",
    label: "Fail primary key with 429",
    header: "key_1=429",
    description: "key_1 simulates rate limit. Gateway falls over to key_2 with 1 fallback attempt.",
  },
  {
    id: "p2",
    label: "Fail primary key with 500",
    header: "key_1=500",
    description: "key_1 simulates server 500 error. Gateway falls over to key_2.",
  },
  {
    id: "p3",
    label: "Fail all keys (*=429)",
    header: "*=429",
    description: "All keys return 429. Gateway returns clean HTTP 503 'all providers unavailable'.",
  },
  {
    id: "p4",
    label: "Fail both keys with different statuses",
    header: "key_1=429,key_2=500",
    description: "key_1 fails with 429, key_2 fails with 500. Gateway returns HTTP 503.",
  },
];

export const ResilienceLab: React.FC<ResilienceLabProps> = ({
  isOpen,
  onClose,
  activeSimulation,
  onSelectSimulation,
}) => {
  const [customInput, setCustomInput] = React.useState("");

  if (!isOpen) return null;

  const handleApplyCustom = () => {
    if (!customInput.trim()) return;
    onSelectSimulation(customInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white dark:bg-[#0b1120] border border-[#E2E8F0] dark:border-[#1f2d47] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1f2d47] flex items-center justify-between bg-slate-50 dark:bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#172033] dark:text-slate-100 flex items-center gap-2">
                Resilience Lab
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-500/30">
                  FAILOVER TEST HOOK
                </span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Simulate provider failures using the real backend <code className="text-amber-700 dark:text-amber-300 font-mono font-semibold">X-Simulate-Failure</code> header.
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
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Active status banner */}
          {activeSimulation ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    SIMULATION ARMED FOR NEXT REQUEST
                  </div>
                  <div className="font-mono text-xs text-amber-900 dark:text-amber-200 font-semibold">
                    Header: {activeSimulation}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onSelectSimulation(null)}
                className="px-2.5 py-1 text-xs rounded bg-amber-200 dark:bg-amber-500/20 hover:bg-amber-300 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-semibold transition-colors"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] text-[#64748B] dark:text-slate-400 text-xs flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Normal mode: All requests hit provider keys normally.</span>
            </div>
          )}

          {/* Presets */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider font-mono">
              Simulation Presets
            </span>

            {PRESETS.map((preset) => {
              const isSelected = activeSimulation === preset.header;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectSimulation(isSelected ? null : preset.header)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/50 shadow-sm"
                      : "bg-white hover:bg-slate-50 dark:bg-[#111827] dark:hover:bg-[#161f33] border-[#E2E8F0] dark:border-[#1f2d47]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#172033] dark:text-slate-100">
                      {preset.label}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-[#070b14] text-amber-700 dark:text-amber-300 border border-[#E2E8F0] dark:border-[#1f2d47]">
                      {preset.header}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom Header Input */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[#E2E8F0] dark:border-[#1f2d47]">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider font-mono">
              Custom Failure Specification
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g. key_1=429,key_2=500 or *=429"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1f2d47] text-xs font-mono text-[#172033] dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleApplyCustom}
                className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1f2d47] bg-slate-50 dark:bg-[#111827] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-[#161f33] hover:bg-slate-300 dark:hover:bg-[#1f2d47] text-[#172033] dark:text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

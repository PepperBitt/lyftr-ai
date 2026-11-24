import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Cpu,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { MessageItem } from "./components/MessageItem";
import { ChatComposer } from "./components/ChatComposer";
import { InferenceInspector } from "./components/InferenceInspector";
import { ResilienceLab } from "./components/ResilienceLab";
import { SystemPromptModal } from "./components/SystemPromptModal";
import {
  ChatMessage,
  HealthResponse,
  MessageMetadata,
} from "./types";
import { fetchHealth, sendChatMessage } from "./api/client";
import { generateSessionId } from "./lib/utils";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

export const App: React.FC = () => {
  // Session state: fresh ID generated on page load
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // System prompt
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState<boolean>(false);

  // Resilience Lab & Simulation
  const [isResilienceLabOpen, setIsResilienceLabOpen] = useState<boolean>(false);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

  // Gateway health
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);

  // Inspector & Telemetry
  const [latestMetadata, setLatestMetadata] = useState<MessageMetadata | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Health check on mount and poll every 30s
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        if (isMounted) {
          setHealth(data);
          setHealthLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setHealth(null);
          setHealthLoading(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // New session button handler
  const handleNewSession = () => {
    const newId = generateSessionId();
    setSessionId(newId);
    setMessages([]);
    setLatestMetadata(null);
    setErrorBanner(null);
  };

  // Send message
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    setErrorBanner(null);

    // Append user message in memory
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const simulationToUse = activeSimulation;
    // Simulation is request-scoped; clear after arming this request
    if (activeSimulation) {
      setActiveSimulation(null);
    }

    try {
      const response = await sendChatMessage(
        {
          session_id: sessionId,
          message: userText,
          system_prompt: systemPrompt !== DEFAULT_SYSTEM_PROMPT ? systemPrompt : undefined,
        },
        simulationToUse,
      );

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        metadata: response.metadata,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLatestMetadata(response.metadata);
    } catch (err: any) {
      const errorText = err.detail || err.message || "Failed to complete inference request";
      setErrorBanner(errorText);

      // Append readable error message in chat area
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "error",
        content: `Inference failed: ${errorText}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans">
      {/* Zone A: Left Sidebar */}
      <Sidebar
        sessionId={sessionId}
        onNewSession={handleNewSession}
        health={health}
        healthLoading={healthLoading}
        onOpenSystemPrompt={() => setIsSystemPromptOpen(true)}
        systemPrompt={systemPrompt}
        onToggleResilienceLab={() => setIsResilienceLabOpen((prev) => !prev)}
        isResilienceLabOpen={isResilienceLabOpen}
        activeSimulation={activeSimulation}
      />

      {/* Zone B: Main Conversation Area */}
      <main className="flex-1 flex flex-col h-full bg-[#070b14] relative overflow-hidden">
        {/* Active Simulation Warning Banner */}
        {activeSimulation && (
          <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>
                Resilience Lab Active: Next request sends{" "}
                <code className="font-bold underline">X-Simulate-Failure: {activeSimulation}</code>
              </span>
            </div>
            <button
              onClick={() => setActiveSimulation(null)}
              className="text-xs text-amber-200 hover:text-white px-2 py-0.5 rounded bg-amber-500/20"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Conversation Header */}
        <div className="px-6 py-3 border-b border-[#1f2d47] bg-[#0b1120]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-slate-400">Session:</span>
            <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {sessionId}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>SQLite Active</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto text-center my-auto p-4 select-none">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-500/10 border border-emerald-400/30 mb-4">
                <Cpu className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Inference Control Center
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Production AI inference workspace with automatic multi-key failover, LiteLLM response caching, and persistent SQLite session state.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl w-full mx-auto flex flex-col">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}

              {/* In-flight loading indicator */}
              {isLoading && (
                <div className="flex justify-start mb-6">
                  <div className="bg-[#0f172a]/70 border border-[#1f2d47] rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-xs font-mono text-slate-400">
                      Processing inference across provider key pool...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <div className="max-w-3xl w-full mx-auto">
          <ChatComposer
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onSelectPrompt={(prompt) => handleSendMessage(prompt)}
            showSuggestions={messages.length === 0}
          />
        </div>
      </main>

      {/* Zone C: Right Technical Inspector */}
      <InferenceInspector
        health={health}
        healthLoading={healthLoading}
        latestMetadata={latestMetadata}
        sessionId={sessionId}
        totalMessages={messages.length}
      />

      {/* Modals */}
      <SystemPromptModal
        isOpen={isSystemPromptOpen}
        onClose={() => setIsSystemPromptOpen(false)}
        systemPrompt={systemPrompt}
        onSavePrompt={(p) => setSystemPrompt(p)}
      />

      <ResilienceLab
        isOpen={isResilienceLabOpen}
        onClose={() => setIsResilienceLabOpen(false)}
        activeSimulation={activeSimulation}
        onSelectSimulation={(header) => {
          setActiveSimulation(header);
          if (header) setIsResilienceLabOpen(false);
        }}
      />
    </div>
  );
};

export default App;

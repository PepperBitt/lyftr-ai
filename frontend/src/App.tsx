import React, { useEffect, useRef, useState, useMemo } from "react";
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
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
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
import { fetchHealth, fetchSessionHistory, sendChatMessage } from "./api/client";
import { generateSessionId } from "./lib/utils";
import {
  getActiveSessionId,
  getSavedSessions,
  getSessionSystemPrompt,
  removeSavedSession,
  setActiveSessionId,
  setSessionSystemPrompt,
  DEFAULT_SYSTEM_PROMPT,
} from "./lib/sessionStorage";

export const App: React.FC = () => {
  // Session persistence: restore active session ID from localStorage on page refresh
  const [sessionId, setSessionId] = useState<string>(() => getActiveSessionId());
  const [savedSessions, setSavedSessions] = useState<string[]>(() => getSavedSessions());

  // Per-session isolated state to prevent cross-session contamination and handle concurrent requests
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  const [sessionLoading, setSessionLoading] = useState<Record<string, boolean>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<string, string | null>>({});
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, MessageMetadata | null>>({});
  const [sessionPrompts, setSessionPrompts] = useState<Record<string, string>>({});

  // Active session derived properties
  const messages = sessionMessages[sessionId] || [];
  const isLoading = Boolean(sessionLoading[sessionId]);
  const errorBanner = sessionErrors[sessionId] || null;
  const latestMetadata = sessionMetadata[sessionId] || null;
  const currentSystemPrompt = sessionPrompts[sessionId] ?? getSessionSystemPrompt(sessionId);

  // System prompt modal
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState<boolean>(false);

  // Resilience Lab & Simulation
  const [isResilienceLabOpen, setIsResilienceLabOpen] = useState<boolean>(false);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

  // Gateway health
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);

  // Stable references for in-flight requests during concurrent session switches
  const activeSessionIdRef = useRef(sessionId);
  activeSessionIdRef.current = sessionId;

  const sessionPromptsRef = useRef(sessionPrompts);
  sessionPromptsRef.current = sessionPrompts;

  const activeSimulationRef = useRef(activeSimulation);
  activeSimulationRef.current = activeSimulation;

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

  // Restore conversation history and session-specific system prompt on session switch or refresh
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      // Ensure system prompt for this session is loaded
      const promptForSession = getSessionSystemPrompt(sessionId);
      if (isMounted) {
        setSessionPrompts((prev) => ({
          ...prev,
          [sessionId]: prev[sessionId] ?? promptForSession,
        }));
      }

      // Fetch message history from SQLite if not already loaded in memory
      if (!sessionMessages[sessionId]) {
        try {
          const historyData = await fetchSessionHistory(sessionId);
          if (isMounted && historyData && Array.isArray(historyData.messages)) {
            const loaded: ChatMessage[] = historyData.messages.map((m, idx) => ({
              id: `restored-${sessionId}-${idx}`,
              role: m.role as "user" | "assistant",
              content: m.content,
              metadata: m.metadata as MessageMetadata | undefined,
              createdAt: new Date().toISOString(),
            }));

            setSessionMessages((prev) => ({
              ...prev,
              [sessionId]: loaded,
            }));

            // Restore metadata from the last assistant response
            const lastAsst = [...loaded].reverse().find(
              (m) => m.role === "assistant" && m.metadata
            );
            if (lastAsst?.metadata) {
              setSessionMetadata((prev) => ({
                ...prev,
                [sessionId]: lastAsst.metadata ?? null,
              }));
            }
          }
        } catch {
          if (isMounted) {
            setSessionMessages((prev) => ({
              ...prev,
              [sessionId]: prev[sessionId] || [],
            }));
          }
        }
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // Create a clean new session
  const handleNewSession = () => {
    const newId = generateSessionId();
    setActiveSessionId(newId);
    setSessionId(newId);
    activeSessionIdRef.current = newId;
    setSavedSessions(getSavedSessions());
    setSessionMessages((prev) => ({ ...prev, [newId]: [] }));
    setSessionMetadata((prev) => ({ ...prev, [newId]: null }));
    setSessionErrors((prev) => ({ ...prev, [newId]: null }));
    setSessionLoading((prev) => ({ ...prev, [newId]: false }));
    setSessionPrompts((prev) => ({ ...prev, [newId]: DEFAULT_SYSTEM_PROMPT }));
  };

  // Switch to a saved session
  const handleSelectSession = (targetId: string) => {
    if (targetId === sessionId) return;
    setActiveSessionId(targetId);
    setSessionId(targetId);
    activeSessionIdRef.current = targetId;
    setSavedSessions(getSavedSessions());
  };

  // Delete a saved session
  const handleDeleteSession = (targetId: string) => {
    const remaining = removeSavedSession(targetId);
    setSavedSessions(remaining);
    setSessionMessages((prev) => {
      const copy = { ...prev };
      delete copy[targetId];
      return copy;
    });
    setSessionPrompts((prev) => {
      const copy = { ...prev };
      delete copy[targetId];
      return copy;
    });
    if (targetId === sessionId) {
      handleNewSession();
    }
  };

  // Save or reset session-specific system prompt
  const handleSaveSystemPrompt = (newPrompt: string) => {
    const trimmed = newPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
    setSessionPrompts((prev) => ({ ...prev, [sessionId]: trimmed }));
    setSessionSystemPrompt(sessionId, trimmed);
    setIsSystemPromptOpen(false);
  };

  // Assistant-UI ChatModelAdapter properly connected to the FastAPI REST API
  const chatModelAdapter: ChatModelAdapter = useMemo(
    () => ({
      async run({ messages: adapterMessages }) {
        const targetSessionId = activeSessionIdRef.current;
        const lastMsg = adapterMessages[adapterMessages.length - 1];
        let textContent = "";
        if (typeof lastMsg?.content === "string") {
          textContent = lastMsg.content;
        } else if (Array.isArray(lastMsg?.content)) {
          textContent = lastMsg.content
            .map((c: any) => c.text || (c.type === "text" ? c.text : ""))
            .join("");
        }

        const promptToUse =
          sessionPromptsRef.current[targetSessionId] ?? getSessionSystemPrompt(targetSessionId);
        const simulationToUse = activeSimulationRef.current;
        if (activeSimulationRef.current) {
          setActiveSimulation(null);
        }

        try {
          const res = await sendChatMessage(
            {
              session_id: targetSessionId,
              message: textContent || "Hello",
              system_prompt: promptToUse,
            },
            simulationToUse
          );

          // Update telemetry and metadata for the specific target session
          setSessionMetadata((prev) => ({
            ...prev,
            [targetSessionId]: res.metadata,
          }));

          const asstMsg: ChatMessage = {
            id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            role: "assistant",
            content: res.reply,
            metadata: res.metadata,
            createdAt: new Date().toISOString(),
          };

          // Store response strictly in targetSessionId's history (prevents cross-session leaks)
          setSessionMessages((prev) => ({
            ...prev,
            [targetSessionId]: [...(prev[targetSessionId] || []), asstMsg],
          }));

          return {
            content: [{ type: "text", text: res.reply }],
            metadata: {
              custom: res.metadata as unknown as Record<string, unknown>,
            },
          };
        } catch (err: any) {
          const errorText = err.detail || err.message || "Failed to complete inference request";
          setSessionErrors((prev) => ({
            ...prev,
            [targetSessionId]: errorText,
          }));

          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            role: "error",
            content: `Inference failed: ${errorText}`,
            createdAt: new Date().toISOString(),
          };

          setSessionMessages((prev) => ({
            ...prev,
            [targetSessionId]: [...(prev[targetSessionId] || []), errorMsg],
          }));

          throw err;
        } finally {
          setSessionLoading((prev) => ({
            ...prev,
            [targetSessionId]: false,
          }));
        }
      },
    }),
    []
  );

  const runtime = useLocalRuntime(chatModelAdapter);

  // Send message delegates to assistant-ui ChatModelAdapter
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;
    const targetSessionId = sessionId;
    activeSessionIdRef.current = targetSessionId;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setSessionMessages((prev) => ({
      ...prev,
      [targetSessionId]: [...(prev[targetSessionId] || []), userMsg],
    }));
    setSessionLoading((prev) => ({ ...prev, [targetSessionId]: true }));
    setSessionErrors((prev) => ({ ...prev, [targetSessionId]: null }));

    try {
      await chatModelAdapter.run({
        messages: [{ role: "user", content: userText } as any],
        abortSignal: new AbortController().signal,
        runConfig: {} as any,
        context: {} as any,
        unstable_getMessage: () => ({ role: "user", content: userText } as any),
      });
    } catch {
      // Errors handled within chatModelAdapter.run
    }
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans">
        {/* Zone A: Left Sidebar with usable session navigation */}
        <Sidebar
          sessionId={sessionId}
          savedSessions={savedSessions}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          health={health}
          healthLoading={healthLoading}
          onOpenSystemPrompt={() => setIsSystemPromptOpen(true)}
          systemPrompt={currentSystemPrompt}
          onToggleResilienceLab={() => setIsResilienceLabOpen((prev) => !prev)}
          isResilienceLabOpen={isResilienceLabOpen}
          activeSimulation={activeSimulation}
        />

        {/* Zone B: Main Conversation Area with assistant-ui ThreadPrimitive */}
        <ThreadPrimitive.Root className="flex-1 flex flex-col h-full bg-[#070b14] relative overflow-hidden">
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

          {/* Error Banner */}
          {errorBanner && (
            <div className="px-6 py-2.5 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{errorBanner}</span>
              </div>
              <button
                onClick={() => setSessionErrors((prev) => ({ ...prev, [sessionId]: null }))}
                className="text-xs text-rose-300 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Message Feed with assistant-ui ThreadPrimitive.Viewport */}
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-6 flex flex-col">
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
          </ThreadPrimitive.Viewport>

          {/* Message Composer with assistant-ui ComposerPrimitive */}
          <div className="max-w-3xl w-full mx-auto">
            <ChatComposer
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              showSuggestions={messages.length === 0}
            />
          </div>
        </ThreadPrimitive.Root>

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
          systemPrompt={currentSystemPrompt}
          onSavePrompt={handleSaveSystemPrompt}
        />

        <ResilienceLab
          isOpen={isResilienceLabOpen}
          onClose={() => setIsResilienceLabOpen(false)}
          activeSimulation={activeSimulation}
          onSelectSimulation={(sim) => setActiveSimulation(sim)}
        />
      </div>
    </AssistantRuntimeProvider>
  );
};

export default App;

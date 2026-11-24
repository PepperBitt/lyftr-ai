import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import * as client from "../api/client";

// Mock client functions
vi.mock("../api/client", () => ({
  API_BASE_URL: "http://localhost:8000",
  fetchHealth: vi.fn(),
  sendChatMessage: vi.fn(),
  fetchSessionHistory: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

describe("LYFTR AI Frontend — Complete Application Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (client.fetchHealth as any).mockResolvedValue({
      status: "ok",
      keys_configured: 2,
      cache_enabled: true,
    });
  });

  it("renders with exact required data-testids on initial load", async () => {
    render(<App />);

    // Chat input exists with exact testid
    const chatInput = screen.getByTestId("chat-input");
    expect(chatInput).toBeInTheDocument();
    expect(chatInput).toHaveValue("");

    // Send button exists with exact testid
    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).toBeInTheDocument();

    // Suggested prompt cards exist in empty state
    expect(
      screen.getByText("Explain how LLM key failover works.")
    ).toBeInTheDocument();
  });

  it("sends a message, clears the input, and displays assistant response with exact metadata testids", async () => {
    const mockChatResponse = {
      session_id: "s-test-1",
      reply: "The capital of France is Paris.",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 812,
        input_tokens: 42,
        output_tokens: 9,
        key_id: "key_1",
        fallback_attempts: 0,
      },
    };

    (client.sendChatMessage as any).mockResolvedValueOnce(mockChatResponse);

    render(<App />);

    const chatInput = screen.getByTestId("chat-input");
    const sendButton = screen.getByTestId("send-button");

    // Type user message
    await userEvent.type(chatInput, "What is the capital of France?");
    expect(chatInput).toHaveValue("What is the capital of France?");

    // Send message
    await userEvent.click(sendButton);

    // Input must be cleared after sending
    expect(chatInput).toHaveValue("");

    // User message should appear
    expect(
      screen.getByText("What is the capital of France?")
    ).toBeInTheDocument();

    // Wait for assistant response to render
    await waitFor(() => {
      expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
    });

    // Verify all mandatory data-testid metadata fields
    const assistantContainer = screen.getByTestId("assistant-message");
    expect(assistantContainer).toBeInTheDocument();

    const metaSource = screen.getByTestId("meta-source");
    expect(metaSource).toHaveTextContent("LIVE_INFERENCE");

    const metaModel = screen.getByTestId("meta-model");
    expect(metaModel).toHaveTextContent("gemini/gemini-2.0-flash");

    const metaLatency = screen.getByTestId("meta-latency");
    expect(metaLatency).toHaveTextContent("812 ms");

    const metaInputTokens = screen.getByTestId("meta-input-tokens");
    expect(metaInputTokens).toHaveTextContent("42");

    const metaOutputTokens = screen.getByTestId("meta-output-tokens");
    expect(metaOutputTokens).toHaveTextContent("9");

    // Reply text rendered
    expect(
      screen.getByText("The capital of France is Paris.")
    ).toBeInTheDocument();
  });

  it("correctly displays LLM_CACHE source on cached replies", async () => {
    const mockCachedResponse = {
      session_id: "s-test-2",
      reply: "Cached answer text.",
      metadata: {
        resolution_source: "LLM_CACHE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 15,
        input_tokens: 42,
        output_tokens: 9,
        key_id: null,
        fallback_attempts: 0,
      },
    };

    (client.sendChatMessage as any).mockResolvedValueOnce(mockCachedResponse);

    render(<App />);

    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "What is the capital of France?");
    await userEvent.click(screen.getByTestId("send-button"));

    await waitFor(() => {
      const metaSource = screen.getByTestId("meta-source");
      expect(metaSource).toHaveTextContent("LLM_CACHE");
    });
  });

  it("renders multi-turn conversation with separate per-message metadata", async () => {
    const resp1 = {
      session_id: "s-multi",
      reply: "First answer",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gpt-model",
        latency_ms: 500,
        input_tokens: 20,
        output_tokens: 10,
        key_id: "key_1",
        fallback_attempts: 0,
      },
    };

    const resp2 = {
      session_id: "s-multi",
      reply: "Second answer",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gpt-model",
        latency_ms: 600,
        input_tokens: 45,
        output_tokens: 15,
        key_id: "key_1",
        fallback_attempts: 0,
      },
    };

    (client.sendChatMessage as any)
      .mockResolvedValueOnce(resp1)
      .mockResolvedValueOnce(resp2);

    render(<App />);

    // Turn 1
    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Message 1");
    await userEvent.click(screen.getByTestId("send-button"));

    await waitFor(() => {
      expect(screen.getByText("First answer")).toBeInTheDocument();
    });

    // Turn 2
    await userEvent.type(chatInput, "Message 2");
    await userEvent.click(screen.getByTestId("send-button"));

    await waitFor(() => {
      expect(screen.getByText("Second answer")).toBeInTheDocument();
    });

    const assistantMessages = screen.getAllByTestId("assistant-message");
    expect(assistantMessages.length).toBe(2);

    const inputTokens = screen.getAllByTestId("meta-input-tokens");
    expect(inputTokens[0]).toHaveTextContent("20");
    expect(inputTokens[1]).toHaveTextContent("45");
  });

  it("handles 503 error cleanly without blanking the screen", async () => {
    (client.sendChatMessage as any).mockRejectedValueOnce(
      new (client.ApiError as any)(503, "all providers unavailable")
    );

    render(<App />);

    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Trigger failure");
    await userEvent.click(screen.getByTestId("send-button"));

    await waitFor(() => {
      expect(
        screen.getByText(/Inference failed: all providers unavailable/i)
      ).toBeInTheDocument();
    });

    // Chat input remains interactive
    expect(chatInput).toBeEnabled();
  });

  it("system prompt modal opens and contains system-prompt-input", async () => {
    render(<App />);

    const sysPromptBtn = screen.getByText("System Prompt");
    await userEvent.click(sysPromptBtn);

    const sysInput = screen.getByTestId("system-prompt-input");
    expect(sysInput).toBeInTheDocument();
    expect(sysInput).toHaveValue("You are a helpful AI assistant.");

    // Update prompt
    await userEvent.clear(sysInput);
    await userEvent.type(sysInput, "You are a senior DevOps engineer.");
    await userEvent.click(screen.getByText("Save Prompt"));

    expect(screen.queryByTestId("system-prompt-input")).not.toBeInTheDocument();
  });

  it("generates a new session ID when clicking New Session", async () => {
    render(<App />);

    const initialSessionId = screen.getByTestId("session-id-display").textContent;

    const newSessionBtn = screen.getByText("New Session");
    await userEvent.click(newSessionBtn);

    const newSessionId = screen.getByTestId("session-id-display").textContent;

    expect(newSessionId).not.toBe(initialSessionId);
    expect(newSessionId).toMatch(/^s-[a-z0-9]+$/);
  });

  it("arms failover header in Resilience Lab and sends X-Simulate-Failure", async () => {
    render(<App />);

    // Open Resilience Lab
    await userEvent.click(screen.getByText("Resilience Lab"));

    // Click preset "Fail primary key with 429"
    const presetBtn = screen.getByText("Fail primary key with 429");
    await userEvent.click(presetBtn);

    // Modal closes automatically when preset is selected
    // Check banner is present
    expect(
      screen.getByText(/Resilience Lab Active: Next request sends/i)
    ).toBeInTheDocument();

    (client.sendChatMessage as any).mockResolvedValueOnce({
      session_id: "s-failover",
      reply: "Fallback successful to key_2",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 950,
        input_tokens: 30,
        output_tokens: 12,
        key_id: "key_2",
        fallback_attempts: 1,
      },
    });

    // Send message
    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Test failover");
    await userEvent.click(screen.getByTestId("send-button"));

    // Verify simulation header was passed
    expect(client.sendChatMessage).toHaveBeenCalledWith(
      expect.anything(),
      "key_1=429"
    );

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText("Fallback successful to key_2")).toBeInTheDocument();
      expect(screen.getByText(/Fallbacks: 1/i)).toBeInTheDocument();
    });
  });

  it("restores active session messages from history endpoint on mount", async () => {
    localStorage.setItem("lyftr_active_session_id", "s-restored-123");
    (client.fetchSessionHistory as any).mockResolvedValueOnce({
      session_id: "s-restored-123",
      messages: [
        { role: "user", content: "Previous question from session" },
        {
          role: "assistant",
          content: "Previous answer from session",
          metadata: {
            resolution_source: "LIVE_INFERENCE",
            model: "gemini/gemini-2.0-flash",
            latency_ms: 700,
            input_tokens: 25,
            output_tokens: 15,
            key_id: "key_1",
            fallback_attempts: 0,
          },
        },
      ],
    });

    render(<App />);

    expect(client.fetchSessionHistory).toHaveBeenCalledWith("s-restored-123");

    await waitFor(() => {
      expect(screen.getByText("Previous question from session")).toBeInTheDocument();
      expect(screen.getByText("Previous answer from session")).toBeInTheDocument();
    });
  });

  it("switches between saved sessions in the sidebar navigation", async () => {
    localStorage.setItem("lyftr_saved_sessions", JSON.stringify(["s-first", "s-second"]));
    localStorage.setItem("lyftr_active_session_id", "s-first");

    (client.fetchSessionHistory as any).mockImplementation((sId: string) => {
      if (sId === "s-second") {
        return Promise.resolve({
          session_id: "s-second",
          messages: [
            { role: "user", content: "Message from second session" },
            {
              role: "assistant",
              content: "Reply from second session",
              metadata: {
                resolution_source: "LIVE_INFERENCE",
                model: "gemini/gemini-2.0-flash",
                latency_ms: 500,
                input_tokens: 10,
                output_tokens: 10,
                key_id: "key_1",
                fallback_attempts: 0,
              },
            },
          ],
        });
      }
      return Promise.resolve({ session_id: sId, messages: [] });
    });

    render(<App />);

    expect(screen.getByTestId("session-id-display")).toHaveTextContent("s-first");

    // Click on s-second in sidebar session history list
    const sessionSecondBtn = screen.getByText("s-second");
    await userEvent.click(sessionSecondBtn);

    expect(screen.getByTestId("session-id-display")).toHaveTextContent("s-second");

    await waitFor(() => {
      expect(screen.getByText("Message from second session")).toBeInTheDocument();
      expect(screen.getByText("Reply from second session")).toBeInTheDocument();
    });
  });

  it("persists system prompt per session and restores it upon switching", async () => {
    localStorage.clear();
    render(<App />);

    // Session 1: customize system prompt
    await userEvent.click(screen.getByText("System Prompt"));
    const input1 = screen.getByTestId("system-prompt-input");
    await userEvent.clear(input1);
    await userEvent.type(input1, "You are a Python security specialist.");
    await userEvent.click(screen.getByText("Save Prompt"));

    // Verify modal closed
    expect(screen.queryByTestId("system-prompt-input")).not.toBeInTheDocument();

    // Create a new session (Session 2)
    await userEvent.click(screen.getByText("New Session"));

    // Check system prompt in Session 2 -> must be default, not leaked from Session 1
    await userEvent.click(screen.getByText("System Prompt"));
    const input2 = screen.getByTestId("system-prompt-input");
    expect(input2).toHaveValue("You are a helpful AI assistant.");

    // Customize Session 2 prompt
    await userEvent.clear(input2);
    await userEvent.type(input2, "You are a database architect.");
    await userEvent.click(screen.getByText("Save Prompt"));

    // Switch back to Session 1 via sidebar
    const savedSessions = screen.getAllByRole("button").filter(
      (btn) => btn.textContent && /^s-[a-z0-9]+$/.test(btn.textContent.trim())
    );
    // Click the older session
    if (savedSessions.length > 1) {
      await userEvent.click(savedSessions[1]);
      // Verify Session 1 system prompt is restored
      await userEvent.click(screen.getByText("System Prompt"));
      expect(screen.getByTestId("system-prompt-input")).toHaveValue(
        "You are a Python security specialist."
      );
      await userEvent.click(screen.getByText("Cancel"));
    }
  });

  it("resets custom system prompt back to default and passes default prompt to backend", async () => {
    localStorage.clear();
    render(<App />);

    // Set custom prompt first
    await userEvent.click(screen.getByText("System Prompt"));
    const sysInput = screen.getByTestId("system-prompt-input");
    await userEvent.clear(sysInput);
    await userEvent.type(sysInput, "Temporary specialized prompt");
    await userEvent.click(screen.getByText("Save Prompt"));

    // Now open again and click Reset to Default
    await userEvent.click(screen.getByText("System Prompt"));
    await userEvent.click(screen.getByText("Reset to Default"));
    expect(screen.getByTestId("system-prompt-input")).toHaveValue(
      "You are a helpful AI assistant."
    );
    await userEvent.click(screen.getByText("Save Prompt"));

    // Mock inference call
    (client.sendChatMessage as any).mockResolvedValueOnce({
      session_id: "s-reset-test",
      reply: "Default prompt acknowledged",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 400,
        input_tokens: 15,
        output_tokens: 10,
        key_id: "key_1",
        fallback_attempts: 0,
      },
    });

    // Send a message
    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Hello with reset prompt");
    await userEvent.click(screen.getByTestId("send-button"));

    // Verify system_prompt sent to backend is the default prompt, not the old custom prompt
    expect(client.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system_prompt: "You are a helpful AI assistant.",
      }),
      null
    );
  });

  it("handles session switching during pending inference without cross-session pollution", async () => {
    localStorage.clear();

    let resolveInferenceA: any;
    const pendingPromiseA = new Promise((resolve) => {
      resolveInferenceA = resolve;
    });

    (client.sendChatMessage as any).mockReturnValueOnce(pendingPromiseA);

    render(<App />);

    const sessionAId = screen.getByTestId("session-id-display").textContent;

    // Send message in Session A
    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Pending message in Session A");
    await userEvent.click(screen.getByTestId("send-button"));

    // Session A is loading
    expect(
      screen.getByText("Processing inference across provider key pool...")
    ).toBeInTheDocument();

    // While Session A is in-flight, user switches to a brand new session
    await userEvent.click(screen.getByText("New Session"));

    const sessionBId = screen.getByTestId("session-id-display").textContent;
    expect(sessionBId).not.toBe(sessionAId);

    // Session B must NOT show Session A's message or loading spinner
    expect(screen.queryByText("Pending message in Session A")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Processing inference across provider key pool...")
    ).not.toBeInTheDocument();

    // Now resolve Session A's inference
    resolveInferenceA({
      session_id: sessionAId,
      reply: "Late response belonging to Session A",
      metadata: {
        resolution_source: "LIVE_INFERENCE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 900,
        input_tokens: 25,
        output_tokens: 15,
        key_id: "key_1",
        fallback_attempts: 0,
      },
    });

    // Wait microtask tick
    await new Promise((r) => setTimeout(r, 50));

    // Session B must STILL NOT contain Session A's response
    expect(
      screen.queryByText("Late response belonging to Session A")
    ).not.toBeInTheDocument();

    // Switch back to Session A via sidebar
    const sessionABtn = screen.getByText(sessionAId!);
    await userEvent.click(sessionABtn);

    // Now Session A displays its message and newly received response
    await waitFor(() => {
      expect(screen.getByText("Pending message in Session A")).toBeInTheDocument();
      expect(screen.getByText("Late response belonging to Session A")).toBeInTheDocument();
    });
  });

  it("handles error in pending session without polluting switched active session", async () => {
    localStorage.clear();

    let rejectInferenceA: any;
    const pendingPromiseA = new Promise((_, reject) => {
      rejectInferenceA = reject;
    });

    (client.sendChatMessage as any).mockReturnValueOnce(pendingPromiseA);

    render(<App />);

    const sessionAId = screen.getByTestId("session-id-display").textContent;

    // Send message in Session A
    const chatInput = screen.getByTestId("chat-input");
    await userEvent.type(chatInput, "Will fail in Session A");
    await userEvent.click(screen.getByTestId("send-button"));

    // Switch to new session before failure occurs
    await userEvent.click(screen.getByText("New Session"));

    // Reject Session A's request with 503 error
    rejectInferenceA(new (client.ApiError as any)(503, "all providers unavailable"));

    await new Promise((r) => setTimeout(r, 50));

    // Active session (Session B) must NOT show Session A's error banner
    expect(
      screen.queryByText(/Inference failed: all providers unavailable/i)
    ).not.toBeInTheDocument();

    // Switch back to Session A
    const sessionABtn = screen.getByText(sessionAId!);
    await userEvent.click(sessionABtn);

    // Session A displays its error
    await waitFor(() => {
      expect(
        screen.getByText(/Inference failed: all providers unavailable/i)
      ).toBeInTheDocument();
    });
  });

  it("toggles between dark and light themes, updating localStorage and HTML class", async () => {
    localStorage.clear();
    render(<App />);

    const themeToggle = screen.getByTestId("theme-toggle");
    expect(themeToggle).toBeInTheDocument();

    // Default or initial theme in dark mode
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Click theme toggle to switch to light mode
    await userEvent.click(themeToggle);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("lyftr_theme")).toBe("light");

    // Click again to switch back to dark mode
    await userEvent.click(themeToggle);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("lyftr_theme")).toBe("dark");
  });

  it("displays informative key configuration status when health returns no API keys configured", async () => {
    (client.fetchHealth as any).mockRejectedValueOnce(
      new (client.ApiError as any)(503, "no API keys configured")
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Keys Unset/i)).toBeInTheDocument();
    });
  });

  it("opens and closes mobile sidebar drawer", async () => {
    render(<App />);

    const menuBtn = screen.getByLabelText("Open sessions sidebar");
    expect(menuBtn).toBeInTheDocument();

    await userEvent.click(menuBtn);

    // Mobile sidebar close button is rendered
    const closeBtn = screen.getByLabelText("Close sidebar drawer");
    expect(closeBtn).toBeInTheDocument();

    await userEvent.click(closeBtn);
    expect(screen.queryByLabelText("Close sidebar drawer")).not.toBeInTheDocument();
  });
});

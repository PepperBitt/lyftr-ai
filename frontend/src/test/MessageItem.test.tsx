import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageItem } from "../components/MessageItem";
import { ChatMessage } from "../types";

describe("MessageItem Component", () => {
  it("renders assistant message with all required data-testid attributes", () => {
    const assistantMsg: ChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "Paris is the capital of France.",
      createdAt: new Date().toISOString(),
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

    render(<MessageItem message={assistantMsg} />);

    expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
    expect(screen.getByTestId("meta-source")).toHaveTextContent("LIVE_INFERENCE");
    expect(screen.getByTestId("meta-model")).toHaveTextContent("gemini/gemini-2.0-flash");
    expect(screen.getByTestId("meta-latency")).toHaveTextContent("812 ms");
    expect(screen.getByTestId("meta-input-tokens")).toHaveTextContent("42");
    expect(screen.getByTestId("meta-output-tokens")).toHaveTextContent("9");
  });

  it("renders LLM_CACHE source badge accurately", () => {
    const cachedMsg: ChatMessage = {
      id: "msg-2",
      role: "assistant",
      content: "Cached text.",
      createdAt: new Date().toISOString(),
      metadata: {
        resolution_source: "LLM_CACHE",
        model: "gemini/gemini-2.0-flash",
        latency_ms: 12,
        input_tokens: 42,
        output_tokens: 9,
        key_id: null,
        fallback_attempts: 0,
      },
    };

    render(<MessageItem message={cachedMsg} />);

    expect(screen.getByTestId("meta-source")).toHaveTextContent("LLM_CACHE");
    expect(screen.getByText("Key:")).toBeInTheDocument();
    expect(screen.getByText("Cached")).toBeInTheDocument();
  });

  it("renders user message with proper role indicator", () => {
    const userMsg: ChatMessage = {
      id: "msg-3",
      role: "user",
      content: "Hello from user",
      createdAt: new Date().toISOString(),
    };

    render(<MessageItem message={userMsg} />);

    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();
  });
});

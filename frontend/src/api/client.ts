import {
  ChatApiResponse,
  ChatRequestPayload,
  HealthResponse,
  MessagesApiResponse,
} from "../types";

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/health`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let detail = `Health check failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) detail = String(errJson.detail);
    } catch {
      // ignore
    }
    throw new ApiError(response.status, detail);
  }

  return response.json();
}

export async function sendChatMessage(
  payload: ChatRequestPayload,
  simulationHeader?: string | null,
): Promise<ChatApiResponse> {
  const url = `${API_BASE_URL}/chat`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (simulationHeader && simulationHeader.trim()) {
    headers["X-Simulate-Failure"] = simulationHeader.trim();
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        detail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiError(response.status, detail);
  }

  return response.json();
}

export async function fetchSessionHistory(
  sessionId: string,
): Promise<MessagesApiResponse> {
  const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let detail = `Failed to fetch session history (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) detail = String(errJson.detail);
    } catch {
      // ignore
    }
    throw new ApiError(response.status, detail);
  }

  return response.json();
}

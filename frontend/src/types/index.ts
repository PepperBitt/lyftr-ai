export type ResolutionSource = "LIVE_INFERENCE" | "LLM_CACHE";

export interface MessageMetadata {
  resolution_source: ResolutionSource;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  key_id: string | null;
  fallback_attempts: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  metadata?: MessageMetadata;
  createdAt: string;
}

export interface HealthResponse {
  status: string;
  keys_configured: number;
  cache_enabled: boolean;
}

export interface ChatRequestPayload {
  session_id: string;
  message: string;
  system_prompt?: string;
}

export interface ChatApiResponse {
  session_id: string;
  reply: string;
  metadata: MessageMetadata;
}

export interface StoredMessageItem {
  role: string;
  content: string;
  metadata?: Partial<MessageMetadata>;
}

export interface MessagesApiResponse {
  session_id: string;
  messages: StoredMessageItem[];
}

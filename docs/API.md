# LYFTR AI — API Specification

The LYFTR AI backend exposes **strictly three application endpoints**. FastAPI's default OpenAPI and documentation routes (`/docs`, `/redoc`, `/openapi.json`) are disabled.

---

## Endpoint 1: Health Check

Returns the operational status of the gateway, database reachability, configured key count, and caching status.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: None required

### Response: HTTP 200 OK
```json
{
  "status": "ok",
  "keys_configured": 2,
  "cache_enabled": true
}
```

### Error Responses
- **HTTP 503 Service Unavailable** (Database unreachable or no keys configured):
```json
{
  "detail": "database unavailable"
}
```

---

## Endpoint 2: Chat Inference

Processes a multi-turn conversation turn with automatic key failover and response caching.

- **Method**: `POST`
- **Path**: `/chat`
- **Headers**:
  - `Content-Type: application/json` (Required)
  - `X-Simulate-Failure: <key_id>=<status>[,...]` (Optional failover test hook)

### Request Body Schema
```json
{
  "session_id": "s-7f3a",
  "message": "What is the capital of France?",
  "system_prompt": "You are a helpful assistant."
}
```

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `session_id` | `string` | **Yes** | 1–128 characters | Client-generated session identifier. |
| `message` | `string` | **Yes** | 1–4000 characters | User message after trimming whitespace. |
| `system_prompt` | `string` | No | Any string | Overrides the default system prompt for this session. |

### Response: HTTP 200 OK (Live Inference)
```json
{
  "session_id": "s-7f3a",
  "reply": "The capital of France is Paris.",
  "metadata": {
    "resolution_source": "LIVE_INFERENCE",
    "model": "gemini/gemini-2.0-flash",
    "latency_ms": 812,
    "input_tokens": 42,
    "output_tokens": 9,
    "key_id": "key_1",
    "fallback_attempts": 0
  }
}
```

### Response: HTTP 200 OK (Cache Hit)
```json
{
  "session_id": "s-other-session",
  "reply": "The capital of France is Paris.",
  "metadata": {
    "resolution_source": "LLM_CACHE",
    "model": "gemini/gemini-2.0-flash",
    "latency_ms": 3,
    "input_tokens": 42,
    "output_tokens": 9,
    "key_id": null,
    "fallback_attempts": 0
  }
}
```

### Metadata Fields
| Field | Type | Values | Description |
| :--- | :--- | :--- | :--- |
| `resolution_source` | `string` | `"LIVE_INFERENCE"` or `"LLM_CACHE"` | Execution pathway. |
| `model` | `string` | e.g. `"gemini/gemini-2.0-flash"` | LiteLLM model identifier. |
| `latency_ms` | `integer` | $\ge 0$ | Total server-measured latency in milliseconds. |
| `input_tokens` | `integer` | $\ge 0$ | Prompt tokens for this individual request. |
| `output_tokens` | `integer` | $\ge 0$ | Completion tokens for this reply. |
| `key_id` | `string` or `null` | `"key_1"`, `"key_2"`, or `null` | Key identifier on live; `null` on cache hit. |
| `fallback_attempts` | `integer` | $\ge 0$ | Number of failed keys prior to success; `0` on cache. |

### Error Cases
- **HTTP 422 Unprocessable Entity** (Validation Failure):
```json
{
  "detail": "message: message must not be empty or whitespace"
}
```
- **HTTP 503 Service Unavailable** (All Keys Failed):
```json
{
  "detail": "all providers unavailable"
}
```

---

## Endpoint 3: Session Message History

Retrieves the persisted conversation history for a session from SQLite in oldest-first chronological order.

- **Method**: `GET`
- **Path**: `/sessions/{session_id}/messages`

### Response: HTTP 200 OK
```json
{
  "session_id": "s-7f3a",
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    },
    {
      "role": "assistant",
      "content": "The capital of France is Paris.",
      "metadata": {
        "resolution_source": "LIVE_INFERENCE",
        "input_tokens": 42,
        "output_tokens": 9
      }
    }
  ]
}
```

### Error Cases
- **HTTP 404 Not Found** (Unknown Session):
```json
{
  "detail": "session not found"
}
```

---

## Failover Test Hook: `X-Simulate-Failure`

Supported only when `ENABLE_FAILURE_SIMULATION=true`.

### Header Syntax
- Format: comma-separated `<key_id>=<status>` pairs.
- Wildcard `*` targets all configured keys.
- Supported status codes: `429`, `500`, `502`, `503`.

### Examples
- Primary key failover:
  `X-Simulate-Failure: key_1=429`
- Server 500 error failover:
  `X-Simulate-Failure: key_1=500`
- Exhaust all keys (returns 503):
  `X-Simulate-Failure: *=429`
- Multiple simulated failures:
  `X-Simulate-Failure: key_1=429,key_2=500`

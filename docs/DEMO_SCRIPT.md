# LYFTR AI — 2-3 Minute Spoken Demonstration Script

Spoken walkthrough script for recording the video submission.

---

## Demonstration Timeline & Script

### 0:00 – 0:25 | Introduction & Architecture Overview
**Visual**: Show deployed LYFTR AI web application in dark theme desktop view.
> *"Hello! This is LYFTR AI — the Inference Control Center. It's a full-stack AI inference gateway designed for high reliability, automatic key failover, response caching, and persistent multi-turn conversations. On the left is our session navigator and SQLite WAL persistence indicator; in the center is our conversational workspace; and on the right is our real-time technical inference inspector."*

---

### 0:25 – 0:50 | Multi-Turn Context & Per-Message Token Tracking
**Visual**: Click suggested prompt card *"Explain how LLM key failover works."* Wait for reply. Then send follow-up *"Summarize that in one bullet point."*
> *"Let's send our first prompt. Notice the immediate response: the assistant message displays its individual request metadata: resolution source is LIVE_INFERENCE, model is Gemini 2.0 Flash, latency is 810 milliseconds, 32 input tokens, 45 output tokens, and key_id is key_1. When I ask a follow-up, the backend loads the full session context from SQLite. Notice that each reply has its own distinct token count — never a cumulative total."*

---

### 0:50 – 1:20 | Exact-Match LiteLLM Caching
**Visual**: Click **New Session** button. Send the exact same first query: *"Explain how LLM key failover works."*
> *"Now let's demonstrate LiteLLM response caching. I'll click 'New Session' to generate a fresh session ID in memory. When I send the exact same initial query in this new session, watch what happens:*
> *The resolution source immediately reports LLM_CACHE with a cyan badge. Latency dropped to just 4 milliseconds — more than 100 times faster! Notice that key_id is null and fallback attempts is zero, while the original token counts and reply are preserved. This proves that our LiteLLM caching is session-agnostic and based on the exact message payload."*

---

### 1:20 – 1:55 | Automatic Provider Key Failover (Resilience Lab)
**Visual**: Open the **Resilience Lab** panel. Click *"Fail primary key with 429"*. Send query *"What is quantum entanglement?"*
> *"Now let's test system resilience using our built-in Resilience Lab. I'll select the preset 'Fail primary key with 429'. This sends the real backend HTTP header X-Simulate-Failure: key_1=429. When I send the query, the primary key simulates a rate limit; our LiteLLM fallback engine intercepts the 429 and immediately fails over to key_2. In the telemetry bar, you can see served by key_2, with Fallbacks: 1 and a successful HTTP 200 response. The user never experiences an interruption."*

---

### 1:55 – 2:25 | Complete Failure Handling & Database Verification
**Visual**: In Resilience Lab, click *"Fail all keys (*=429)"*. Send message. Show clean error banner. Then click *"Verify Stored History"* in the right inspector.
> *"Next, let's simulate total exhaustion with wildcard *=429. The gateway cleanly returns HTTP 503 'all providers unavailable' as a readable in-chat error card without crashing or exposing stack traces. Failed requests are never saved to SQLite. Finally, I'll click 'Verify Stored History' in the right inspector, which queries GET /sessions/{session_id}/messages to prove that our conversation is stored in SQLite under /data/app.db."*

---

### 2:25 – 2:45 | Docker & Code Quality Wrap-up
**Visual**: Switch briefly to terminal showing `make test` running with all 62 tests passing.
> *"The entire application runs locally with `make up` using multi-stage Dockerfiles and persistent named volumes. All 62 backend and frontend automated tests pass with 100% success. Thank you!"*

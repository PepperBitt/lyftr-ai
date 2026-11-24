# LYFTR AI — Testing Documentation

Complete guide to running automated and manual verification tests for LYFTR AI.

---

## Test Execution Summary

The repository contains **62 automated tests**:
- **Backend**: 51 pytest unit & integration tests covering health, validation, multi-turn history, key failover, caching, SQLite transactions, and error safety.
- **Frontend**: 11 vitest application flow tests verifying component rendering, data-testid attributes, user interactions, loading states, error boundaries, and failover header generation.

---

## Running Automated Tests

Run the full end-to-end test suite:
```bash
make test
```

### Running Backend Tests Only
```bash
make test-backend
```
Or directly with pytest and coverage reporting:
```bash
cd backend
python3 -m pytest tests/ -v --cov=app --cov-report=term-missing
```

### Running Frontend Tests Only
```bash
make test-frontend
```
Or directly with vitest:
```bash
cd frontend
npm test
```

---

## Test Coverage Matrix

| Area | Test File | Test Count | Key Invariants Verified |
| :--- | :--- | :--- | :--- |
| **Health** | `tests/test_health.py` | 5 | HTTP 200, keys count match, cache enabled, no key secrets exposed |
| **Validation** | `tests/test_validation.py` | 9 | Missing/empty/whitespace session_id & message (422), 4000 char boundary, JSON errors |
| **Conversation** | `tests/test_conversation.py` | 9 | Oldest-first order, metadata persistence, context accumulation, session isolation, 404 on unknown |
| **Key Failover** | `tests/test_failover.py` | 10 | Primary key 429 & 500 fallback, wildcard `*=429` 503, fallback attempts counting, no half-saved DB rows |
| **Response Cache** | `tests/test_caching.py` | 8 | First live, second hit `LLM_CACHE`, key_id null on hit, token counts preserved, simulation bypasses cache |
| **SQLite DB** | `tests/test_database.py` | 6 | Automatic file & schema creation, WAL mode, transaction integrity, session prompt storage |
| **Error Safety** | `tests/test_errors.py` | 4 | No stack traces exposed, clean JSON `detail`, docs endpoints disabled |
| **Frontend UI** | `src/test/App.test.tsx` | 8 | Exact `data-testid` attributes, send & clear, multi-turn display, 503 error banner, Resilience Lab header |
| **Message Item** | `src/test/MessageItem.test.tsx`| 3 | Per-response metadata badges, markdown rendering, copy button |

---

## Local Smoke Testing Script

You can smoke-test the live API using standard cURL commands:

```bash
# 1. Health
curl -s http://localhost:8000/health

# 2. Live Request
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "s-smoke", "message": "Hello LYFTR AI"}'

# 3. Cache Hit (different session, same prompt)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "s-smoke-2", "message": "Hello LYFTR AI"}'

# 4. Failover Simulation
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id": "s-smoke-3", "message": "Test failover"}'
```

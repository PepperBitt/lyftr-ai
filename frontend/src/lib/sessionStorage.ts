import { generateSessionId } from "./utils";

const ACTIVE_SESSION_KEY = "lyftr_active_session_id";
const SAVED_SESSIONS_KEY = "lyftr_saved_sessions";

export function getActiveSessionId(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {
    // localStorage may be disabled or inaccessible
  }

  const fresh = generateSessionId();
  setActiveSessionId(fresh);
  return fresh;
}

export function setActiveSessionId(sessionId: string): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    saveSessionId(sessionId);
  } catch {
    // ignore
  }
}

export function getSavedSessions(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === "string" && id.trim().length > 0);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveSessionId(sessionId: string): string[] {
  try {
    const existing = getSavedSessions();
    if (!existing.includes(sessionId)) {
      const updated = [sessionId, ...existing].slice(0, 20); // Keep up to 20 recent sessions
      localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(updated));
      return updated;
    }
    return existing;
  } catch {
    return [sessionId];
  }
}

export function removeSavedSession(sessionId: string): string[] {
  try {
    const existing = getSavedSessions();
    const updated = existing.filter((id) => id !== sessionId);
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

import { ref } from 'vue';
import type { HookEvent, SessionSummary } from '../types';
import { API_BASE_URL } from '../config';

export function useSessionHistory() {
  const sessions = ref<SessionSummary[]>([]);
  const loadedSessionId = ref<string | null>(null);
  const loadedEvents = ref<HookEvent[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Pagination
  const page = ref(0);
  const pageSize = 20;
  const hasMore = ref(true);

  async function fetchSessions(reset = false) {
    if (reset) {
      page.value = 0;
      sessions.value = [];
      hasMore.value = true;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const offset = page.value * pageSize;
      const res = await fetch(`${API_BASE_URL}/sessions?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: SessionSummary[] = await res.json();

      if (reset) {
        sessions.value = data;
      } else {
        sessions.value = [...sessions.value, ...data];
      }

      hasMore.value = data.length === pageSize;
    } catch (e: any) {
      error.value = e.message ?? 'Failed to fetch sessions';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadSessionEvents(sessionId: string) {
    isLoading.value = true;
    error.value = null;
    loadedSessionId.value = sessionId;

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/events`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      loadedEvents.value = await res.json();
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load session events';
      loadedEvents.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  function nextPage() {
    if (!hasMore.value || isLoading.value) return;
    page.value++;
    fetchSessions();
  }

  function clearLoadedSession() {
    loadedSessionId.value = null;
    loadedEvents.value = [];
  }

  return {
    sessions,
    loadedSessionId,
    loadedEvents,
    isLoading,
    error,
    hasMore,
    fetchSessions,
    loadSessionEvents,
    nextPage,
    clearLoadedSession,
  };
}

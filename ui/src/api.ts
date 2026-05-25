import type { Draw, Source, HealthStatus, Announcement } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ============================================================
// Draw API
// ============================================================
export async function fetchLatestDraws(): Promise<Draw[]> {
  const res = await fetch(`${API_BASE}/api/draws/latest`);
  if (!res.ok) throw new Error('Failed to fetch draws');
  const data = await res.json();
  return data.draws;
}

export async function fetchDrawHistory(limit = 50, type?: string): Promise<{ draws: Draw[]; stats: object }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (type) params.set('type', type);
  const res = await fetch(`${API_BASE}/api/draws/history?${params}`);
  if (!res.ok) throw new Error('Failed to fetch draw history');
  return res.json();
}

// ============================================================
// Announcements API
// ============================================================
export async function fetchAnnouncements(limit = 10): Promise<Announcement[]> {
  const res = await fetch(`${API_BASE}/api/announcements/latest?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch announcements');
  const data = await res.json();
  return data.announcements;
}

// ============================================================
// Health API
// ============================================================
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  const data = await res.json();
  return data;
}

// ============================================================
// Chat SSE Stream
// ============================================================
import type { CandidateProfile, PathwayResult } from './types';

export interface ChatStreamEvent {
  type: 'start' | 'chunk' | 'done' | 'error';
  // start
  sessionId?: string;
  sources?: Source[];
  draw_data?: Draw | null;
  language?: string;
  candidateProfile?: CandidateProfile;
  crsScore?: number;
  topPathways?: PathwayResult[];
  profileCompleteness?: number;
  missingInfo?: string[];
  // chunk
  text?: string;
  // done
  model_used?: string;
  provider?: 'groq' | 'mistral';
  fallback_used?: boolean;
  // error
  message?: string;
}

export async function* streamChat(
  message: string,
  sessionId: string | undefined,
  history: { role: 'user' | 'assistant'; content: string }[],
  language: 'en' | 'fr' = 'en',
  drawId?: number
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, history, language, drawId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error ?? 'Chat request failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { type: eventType as ChatStreamEvent['type'], ...data };
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

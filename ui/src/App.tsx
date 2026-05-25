import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Globe, PanelRightClose, PanelRightOpen, AlertCircle } from 'lucide-react';


import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { DrawSidebar } from './components/DrawSidebar';
import { QuickActions } from './components/QuickActions';
import { FreshnessIndicator } from './components/FreshnessIndicator';
import { streamChat } from './api';
import { fetchLatestDraws } from './api';
import type { ChatMessage, Draw, CandidateProfile } from './types';

const SESSION_ID = uuidv4();

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Welcome to **CanadaPathways AI** 🇨🇦

I'm your expert guide to Canadian Permanent Residency pathways. I have real-time access to:

- **Express Entry draws** — latest CRS scores and invitation counts
- **All PR pathways** — FSW, CEC, FST, PNP, Family Sponsorship, Start-up Visa, and more
- **IRCC announcements** — policy changes and news

Let's start by building your profile! Tell me about your **age, education level, and English/French test scores**.`,
  timestamp: new Date(),
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
  const [showSidebar, setShowSidebar] = useState(true);
  const [language, setLanguage] = useState<'en' | 'fr'>('en');
  const [error, setError] = useState<string | null>(null);

  // New Profile / Draw State
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [profileCompleteness, setProfileCompleteness] = useState<number>(0);
  const [activeDrawId, setActiveDrawId] = useState<number | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch draws on mount ──────────────────────────────────
  useEffect(() => {
    fetchLatestDraws()
      .then((data) => {
        setDraws(data);
        setLastUpdated(new Date());
      })
      .catch(() => {
        // Non-fatal
      })
      .finally(() => setDrawsLoading(false));
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantId = uuidv4();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Build history (exclude welcome + streaming)
      const history = messages
        .filter((m) => m.id !== 'welcome' && !m.isStreaming)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        let fullContent = '';
        let sources = assistantMsg.sources;
        let drawData = assistantMsg.drawData;
        let modelUsed = '';
        let provider: 'groq' | 'mistral' = 'groq';
        let fallbackUsed = false;

        for await (const event of streamChat(text, SESSION_ID, history, language, activeDrawId)) {
          switch (event.type) {
            case 'start':
              sources = event.sources ?? [];
              drawData = event.draw_data ?? null;
              if (event.candidateProfile) setCandidateProfile(event.candidateProfile);
              if (event.profileCompleteness !== undefined) setProfileCompleteness(event.profileCompleteness);
              break;

            case 'chunk':
              fullContent += event.text ?? '';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullContent, sources, drawData }
                    : m
                )
              );
              break;

            case 'done':
              modelUsed = event.model_used ?? '';
              provider = event.provider ?? 'groq';
              fallbackUsed = event.fallback_used ?? false;
              break;

            case 'error':
              throw new Error(event.message ?? 'Stream error');
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fullContent,
                  sources,
                  drawData,
                  modelUsed,
                  provider,
                  fallbackUsed,
                  isStreaming: false,
                }
              : m
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Sorry, I encountered an error: ${msg}\n\nPlease try again.`,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, language]
  );

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-base)] overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-canada-red)] to-[var(--color-canada-crimson)] flex items-center justify-center text-lg red-glow">
            🍁
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">
              CanadaPathways <span className="gradient-text">AI</span>
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Powered by Groq · Real-time IRCC data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLanguage((l) => (l === 'en' ? 'fr' : 'en'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] transition-colors"
          >
            <Globe size={12} />
            {language.toUpperCase()}
          </button>

          {/* Sidebar toggle */}
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="p-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] transition-colors"
          >
            {showSidebar ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/50 text-xs text-red-300 animate-fade-in">
              <AlertCircle size={13} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-200"
              >
                ✕
              </button>
            </div>
          )}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Freshness bar */}
          <div className="px-4 py-1.5 border-t border-[var(--color-border-subtle)]">
            <FreshnessIndicator lastUpdated={lastUpdated} />
          </div>

          {/* Quick actions */}
          <QuickActions onSelect={sendMessage} disabled={isStreaming} />

          {/* Input */}
          <ChatInput onSend={sendMessage} disabled={isStreaming} language={language} />
        </div>

        {/* Draw Sidebar */}
        {showSidebar && (
          <aside className="w-72 shrink-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-y-auto hidden lg:block animate-slide-in-right">
            <DrawSidebar
              draws={draws}
              isLoading={drawsLoading}
              profile={candidateProfile}
              completeness={profileCompleteness}
              onChatClick={(drawId) => {
                setActiveDrawId(drawId);
                sendMessage(`Let's discuss Draw #${drawId}`);
              }}
            />
          </aside>
        )}
      </div>

      {/* ── Disclaimer Footer ── */}
      <footer className="px-4 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shrink-0">
        <p className="text-center text-[10px] text-[var(--color-text-muted)] leading-relaxed">
          ⚖️ This tool provides general information only and does not constitute legal advice.
          For your specific situation, consult a licensed{' '}
          <a
            href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigration-citizenship-representative/choose.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-canada-red-light)] hover:underline"
          >
            RCIC or immigration lawyer
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

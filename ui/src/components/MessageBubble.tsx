import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLink, Cpu, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);

  return (
    <div
      className={clsx(
        'flex gap-3 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1',
          isUser
            ? 'bg-[var(--color-canada-red)] text-white'
            : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]'
        )}
      >
        {isUser ? 'You' : '🇨🇦'}
      </div>

      {/* Content */}
      <div className={clsx('flex flex-col gap-1.5 max-w-[80%]', isUser && 'items-end')}>
        {/* Bubble */}
        <div
          className={clsx(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-[var(--color-canada-red)] text-white rounded-tr-sm'
              : 'bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-tl-sm'
          )}
        >
          {message.isStreaming && !message.content ? (
            /* Typing indicator */
            <div className="flex gap-1.5 py-1 px-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>

        {/* Draw Data Card (if present) */}
        {!isUser && message.drawData && (
          <DrawDataCard draw={message.drawData} />
        )}

        {/* Footer row */}
        <div
          className={clsx(
            'flex items-center gap-2 flex-wrap',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          {/* Timestamp */}
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>

          {/* Model badge */}
          {!isUser && message.provider && (
            <ModelBadge
              provider={message.provider}
              fallbackUsed={message.fallbackUsed ?? false}
            />
          )}

          {/* Sources toggle */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-canada-red)] transition-colors"
            >
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Sources list */}
        {showSources && message.sources && (
          <div className="w-full animate-fade-in">
            <SourcesList sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Message Content (renders markdown-lite)
// ============================================================
function MessageContent({ content }: { content: string }) {
  // Simple markdown-lite: bold, bullets, headers
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} className="font-semibold text-[var(--color-canada-red-light)] mt-2 mb-0.5 text-sm">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="font-bold text-[var(--color-canada-red-light)] mt-2 mb-1">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="font-bold text-base text-[var(--color-canada-red-light)] mt-2 mb-1">{line.slice(2)}</h1>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[var(--color-canada-red)] mt-0.5 shrink-0">•</span>
              <span>{renderInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }
        if (line.startsWith('---')) {
          return <hr key={i} className="border-[var(--color-border-subtle)] my-2" />;
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-[var(--color-text-primary)]">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ============================================================
// Model Badge
// ============================================================
function ModelBadge({
  provider,
  fallbackUsed,
}: {
  provider: 'groq' | 'mistral';
  fallbackUsed: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white',
        provider === 'groq'
          ? 'bg-gradient-to-r from-[#7C3AED] to-[#5B21B6]'
          : 'bg-gradient-to-r from-[#0EA5E9] to-[#0369A1]'
      )}
    >
      {provider === 'groq' ? <Zap size={9} /> : <Cpu size={9} />}
      <span>{provider === 'groq' ? 'Groq' : 'Mistral'}</span>
      {fallbackUsed && (
        <span className="opacity-75 ml-0.5">(fallback)</span>
      )}
    </div>
  );
}

// ============================================================
// Draw Data Card
// ============================================================
function DrawDataCard({ draw }: { draw: NonNullable<ChatMessage['drawData']> }) {
  return (
    <div className="glass-card rounded-xl p-3 border border-[var(--color-border-accent)] animate-slide-in-right w-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-[var(--color-canada-red)] animate-pulse" />
        <span className="text-[11px] font-semibold text-[var(--color-canada-red)] uppercase tracking-wider">
          Latest Draw Referenced
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Draw #" value={`#${draw.drawNumber}`} />
        <Stat label="CRS Score" value={draw.crsScore.toString()} highlight />
        <Stat label="Invitations" value={draw.invitationsIssued.toLocaleString()} />
        <Stat label="Date" value={format(new Date(draw.drawDate), 'MMM d, yyyy')} />
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
        <span className="text-[11px] text-[var(--color-text-muted)]">{draw.drawType}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</div>
      <div
        className={clsx(
          'text-sm font-semibold',
          highlight ? 'text-[var(--color-canada-red-light)]' : 'text-[var(--color-text-primary)]'
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Sources List
// ============================================================
function SourcesList({ sources }: { sources: ChatMessage['sources'] }) {
  if (!sources?.length) return null;
  return (
    <div className="bg-[var(--color-bg-input)] rounded-xl p-3 border border-[var(--color-border-subtle)] space-y-2">
      <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        Sources
      </div>
      {sources.map((src, i) => (
        <a
          key={i}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 group hover:bg-[var(--color-bg-elevated)] rounded-lg p-2 -mx-1 transition-colors"
        >
          <ExternalLink
            size={11}
            className="text-[var(--color-text-muted)] group-hover:text-[var(--color-canada-red)] mt-0.5 shrink-0 transition-colors"
          />
          <div>
            <div className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors leading-snug">
              {src.title}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {src.pathwayType.replace(/_/g, ' ')} · {format(new Date(src.date), 'MMM yyyy')}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

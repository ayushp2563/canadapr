import { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  language: 'en' | 'fr';
}

const PLACEHOLDER = {
  en: 'Ask about Express Entry, PNP, family sponsorship...',
  fr: 'Posez une question sur l\'Entrée express, PNP, parrainage...',
};

export function ChatInput({ onSend, disabled, language }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  };

  return (
    <div className="p-4">
      <div
        className={clsx(
          'flex items-end gap-3 bg-[var(--color-bg-input)] rounded-2xl px-4 py-3',
          'border transition-all duration-200',
          disabled
            ? 'border-[var(--color-border-subtle)] opacity-70'
            : 'border-[var(--color-border-default)] focus-within:border-[var(--color-canada-red)] focus-within:shadow-[0_0_0_3px_rgba(213,43,30,0.1)]'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={1}
          placeholder={PLACEHOLDER[language]}
          className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none outline-none min-h-[24px] max-h-40 leading-relaxed"
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0',
            value.trim() && !disabled
              ? 'bg-[var(--color-canada-red)] hover:bg-[var(--color-canada-red-dark)] text-white shadow-[0_2px_8px_rgba(213,43,30,0.4)] hover:scale-105 active:scale-95'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
          )}
        >
          <Send size={15} />
        </button>
      </div>

      <p className="text-center text-[10px] text-[var(--color-text-muted)] mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}

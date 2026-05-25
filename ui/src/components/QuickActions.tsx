import { clsx } from 'clsx';

interface QuickAction {
  id: string;
  label: string;
  emoji: string;
  message: string;
  color?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'latest-draw',
    label: 'Latest Draw',
    emoji: '🗳️',
    message: 'What was the latest Express Entry draw? Show me the CRS score and number of invitations.',
    color: 'red',
  },
  {
    id: 'check-eligibility',
    label: 'Check Eligibility',
    emoji: '✅',
    message: 'How can I check my Express Entry eligibility? What are the main requirements?',
  },
  {
    id: 'pnp-options',
    label: 'PNP Options',
    emoji: '🏔️',
    message: 'What Provincial Nominee Programs are available and which provinces have the lowest CRS requirements?',
  },
  {
    id: 'family-sponsorship',
    label: 'Family Sponsorship',
    emoji: '👨‍👩‍👧',
    message: 'How does family sponsorship work for Canadian PR? Who can I sponsor?',
  },
  {
    id: 'crs-boost',
    label: 'Boost My CRS',
    emoji: '📈',
    message: 'What are the best ways to increase my CRS score for Express Entry?',
  },
  {
    id: 'startup-visa',
    label: 'Start-up Visa',
    emoji: '🚀',
    message: 'Tell me about the Start-up Visa program requirements for Canadian PR.',
  },
];

interface Props {
  onSelect: (message: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onSelect, disabled }: Props) {
  return (
    <div className="px-4 pb-2">
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onSelect(action.message)}
            disabled={disabled}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
              'border transition-all duration-200 hover:scale-105 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
              action.color === 'red'
                ? 'bg-[var(--color-canada-red)]/10 border-[var(--color-canada-red)]/30 text-[var(--color-canada-red-light)] hover:bg-[var(--color-canada-red)]/20'
                : 'bg-[var(--color-bg-card)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <span>{action.emoji}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

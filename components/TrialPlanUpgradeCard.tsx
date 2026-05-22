import React from 'react';
import { Check, Gift } from 'lucide-react';

const PREMIUM_HIGHLIGHTS = [
  'Tokeny co miesiąc po trialu',
  'Bez watermarku w menu',
  'Pełny dostęp do AI',
] as const;

interface Props {
  statusLabel: string;
  onUpgrade: () => void;
}

export const TrialPlanUpgradeCard: React.FC<Props> = ({ statusLabel, onUpgrade }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0f0f0f] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35),0_0_24px_rgba(59,130,246,0.12)]">
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={14} className="text-blue-400 shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Plan trial</p>
        </div>

        <p className="text-[11px] font-bold text-blue-300/90 leading-snug">{statusLabel}</p>

        <p className="mt-2 text-sm font-bold text-white leading-snug">
          Pełna jakość jak Premium — bez znaku wodnego.
        </p>

        <ul className="mt-3 space-y-1.5">
          {PREMIUM_HIGHLIGHTS.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[11px] text-zinc-300">
              <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={3} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
          Po trialie przejdź na Premium, aby zachować generowanie AI.
        </p>

        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 w-full py-3 rounded-xl font-black text-xs uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.35)] hover:from-emerald-300 hover:to-green-400 transition-all active:scale-[0.98]"
        >
          Przejdź na Premium
        </button>
      </div>
    </div>
  );
};

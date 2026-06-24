import React from 'react';
import { Check, Sparkles } from 'lucide-react';

const UNLOCK_FEATURES = [
  'Obsługa zagranicznych gości',
  'Profesjonalna prezentacja menu',
  'Funkcje zwiększające sprzedaż',
  'Narzędzia dla restauracji i hotel',
] as const;

interface Props {
  onUpgrade: () => void;
}

export const FreePlanUpgradeCard: React.FC<Props> = ({ onUpgrade }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-chef-gold/25 bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0f0f0f] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35),0_0_24px_rgba(187,152,96,0.12)]">
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-chef-gold/10 blur-2xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-chef-gold shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-chef-gold">Plan darmowy</p>
        </div>

        <p className="text-sm font-bold text-white leading-snug">Odblokuj pełny potencjał ChefVision</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
          Przejdź na plan Start lub Premium i wykorzystaj wszystkie możliwości platformy.
        </p>

        <ul className="mt-3 space-y-1.5">
          {UNLOCK_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[11px] text-zinc-300">
              <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={3} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 w-full py-3 rounded-xl font-black text-xs uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.35)] hover:from-emerald-300 hover:to-green-400 transition-all active:scale-[0.98]"
        >
          Przejdź na wyższy plan
        </button>
      </div>
    </div>
  );
};

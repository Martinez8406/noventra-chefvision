import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { SubscriptionStatus } from '../types';

const DISMISS_KEY = 'chefvision_start_promo_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

interface Props {
  subscriptionStatus?: SubscriptionStatus;
  onViewPlans: () => void;
  /** Wywoływane gdy widoczność paska się zmienia (padding w main). */
  onVisibilityChange?: (visible: boolean) => void;
}

export const StartPlanPromoBar: React.FC<Props> = ({
  subscriptionStatus,
  onViewPlans,
  onVisibilityChange,
}) => {
  const [dismissed, setDismissed] = useState(true);

  const eligible =
    subscriptionStatus === 'free_limited' || subscriptionStatus === 'trial';

  useEffect(() => {
    setDismissed(isDismissedRecently());
  }, []);

  const visible = eligible && !dismissed;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  if (!visible) return null;

  const isTrial = subscriptionStatus === 'trial';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[95] lg:left-72 border-t border-emerald-500/30 bg-gradient-to-r from-[#0f1a14] via-[#121212] to-[#0f1a14] shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
      role="region"
      aria-label="Informacja o planie Start"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white leading-snug">
              Nowy plan Start — 30 zł/mies.
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              {isTrial
                ? 'Po trialu przejdź na Start lub Premium — menu bez znaku wodnego, tłumaczenia i tokeny AI.'
                : 'Menu bez znaku wodnego, tłumaczenia na 14 języków i 10 tokenów AI miesięcznie.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:pl-2">
          <button
            type="button"
            onClick={onViewPlans}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all shadow-[0_0_16px_rgba(52,211,153,0.3)]"
          >
            Zobacz plany
          </button>
          <button
            type="button"
            onClick={() => {
              markDismissed();
              setDismissed(true);
            }}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Zamknij na 7 dni"
            title="Zamknij na 7 dni"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

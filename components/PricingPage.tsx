import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Package } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import { canPurchaseTokenPacks } from '../utils/tokens';
import type { SubscriptionStatus } from '../types';

export type PricingPlanType = 'start' | 'premium' | 'tokens';

interface Props {
  subscriptionStatus?: SubscriptionStatus;
  onBack: () => void;
  onBuy: (plan: PricingPlanType) => Promise<void>;
}

const START_FEATURES = [
  'Pairingi i upselling',
  '10 tokenów AI miesięcznie',
  'Menu bez znaku wodnego',
  'Tłumaczenia menu na 14 języków',
  'Rekomendacje i promocje',
  'Statystyki',
] as const;

const PREMIUM_FEATURES = [
  'Pairingi i upselling',
  'Tłumaczenia menu',
  'Hotel Hub',
  '50 tokenów AI miesięcznie',
  'Menu bez znaku wodnego',
  'Rekomendacje i promocje',
  'Statystyki',
  'Pomoc we wdrożeniu',
] as const;

const TOKEN_PACK_FEATURES = [
  'Bezterminowe',
  'Dostępne w planie Start i Premium',
  'Idealne na zmianę karty sezonowej',
] as const;

export const PricingPage: React.FC<Props> = ({ subscriptionStatus, onBack, onBuy }) => {
  const [busy, setBusy] = useState<PricingPlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canBuyTokens = canPurchaseTokenPacks(subscriptionStatus);

  const handleBuy = async (plan: PricingPlanType) => {
    if (plan === 'tokens' && !canBuyTokens) return;
    setBusy(plan);
    setError(null);
    try {
      await onBuy(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się otworzyć płatności.');
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Wróć do aplikacji
          </button>
          <div className="flex items-center gap-2">
            <img src={BRAND_LOGO_SRC} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-black italic text-slate-900">Chefvision</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Wybierz plan dla swojej restauracji
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            Rozwiń menu cyfrowe, zwiększ sprzedaż i obsłuż gości z całego świata.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-5 items-stretch">
          {/* Start */}
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <span className="inline-flex self-start rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Najlepszy na start
            </span>
            <p className="mt-5 text-3xl font-black text-slate-900">
              30 zł
              <span className="text-base font-bold text-slate-500"> / miesiąc</span>
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Plan Start</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Więcej możliwości sprzedażowych i profesjonalne menu bez znaku wodnego.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {START_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleBuy('start')}
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-60"
            >
              {busy === 'start' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : (
                'Kupuję'
              )}
            </button>
          </div>

          {/* Premium */}
          <div className="relative flex flex-col rounded-[28px] border-2 border-emerald-400 bg-white p-6 sm:p-7 shadow-[0_12px_40px_rgba(52,211,153,0.18)] lg:scale-[1.02]">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#0a1a12] shadow-md">
              Najczęściej wybierany
            </span>
            <p className="mt-4 text-4xl font-black text-slate-900">
              97 zł
              <span className="text-lg font-bold text-slate-500"> / miesiąc</span>
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Plan Premium</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Pełny dostęp do wszystkich funkcji. Anuluj w dowolnym momencie — bez zobowiązań.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleBuy('premium')}
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-60 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
            >
              {busy === 'premium' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : (
                'Kupuję'
              )}
            </button>
          </div>

          {/* Token pack */}
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mt-1">
              <Package size={22} className="text-emerald-500" />
              <p className="text-3xl font-black text-slate-900">30 zł</p>
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-900">Paczka +50 tokenów</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Jednorazowy zakup. Tokeny nie przedawniają się — czekają na koncie aż do wykorzystania.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {TOKEN_PACK_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 text-emerald-500 text-sm">★</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!canBuyTokens && (
              <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Paczka tokenów jest dostępna w aktywnym planie Start lub Premium.
              </p>
            )}
            <button
              type="button"
              disabled={!!busy || !canBuyTokens}
              onClick={() => void handleBuy('tokens')}
              className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'tokens' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : (
                'Kupuję'
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-8 text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <p className="mt-10 text-center text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Tokeny subskrypcyjne resetują się 1. dnia każdego miesiąca i nie przechodzą na kolejny okres.
          Tokeny z paczki są bezterminowe.
        </p>
      </main>
    </div>
  );
};

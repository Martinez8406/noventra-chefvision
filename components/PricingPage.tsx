import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Crown, Loader2, Package, Wand2 } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import { canPurchaseTokenPacks } from '../utils/tokens';
import { fetchLifetimeOffer, type LifetimeOfferState } from '../services/stripeService';
import type { FlyerServiceStatus, MenuServiceStatus, SubscriptionStatus } from '../types';

export type PricingPlanType = 'start' | 'premium' | 'tokens' | 'implementation_bundle' | 'founder_lifetime';

interface Props {
  subscriptionStatus?: SubscriptionStatus;
  menuServiceStatus?: MenuServiceStatus | null;
  flyerServiceStatus?: FlyerServiceStatus | null;
  onBack: () => void;
  onBuy: (plan: PricingPlanType) => Promise<void>;
}

const START_FEATURES = [
  '10 tokenów AI miesięcznie',
  'Menu bez znaku wodnego',
  'Tłumaczenia menu na 14 języków',
  'Statystyki otwarć menu',
] as const;

const PREMIUM_FEATURES = [
  'Pairingi i upselling',
  'Hotel Hub',
  'Panel informacyjny',
  'Poproś kelnera / rachunek',
  'Ranking popularności dań',
  '50 tokenów AI',
  'Pomoc we wdrożeniu',
] as const;

const LIFETIME_FEATURES = [
  'Wszystko z planu Premium',
  'Dożywotni dostęp do ChefVision',
  'Bez miesięcznego abonamentu',
  '100 tokenów AI na poprawianie zdjęć dań i tworzenie profesjonalnego tła. Tokeny przyznawane jednorazowo i bez terminu ważności.',
] as const;

const DEFAULT_LIFETIME_OFFER: LifetimeOfferState = {
  soldOut: false,
  pricePln: 599,
  tier: '599',
  badge: 'Tylko 10 kont w tej cenie',
  nextTierNote: 'Kolejne 10 kont: 799 zł',
  buttonLabel: 'Kupuję',
};

const TOKEN_PACK_FEATURES = [
  'Bezterminowe',
  'Dostępne w planie Start, Premium i Founder Lifetime',
  'Idealne na zmianę karty sezonowej',
] as const;

const IMPLEMENTATION_FEATURES = [
  'Zespół ChefVision buduje Twoje menu cyfrowe',
  'Zdjęcia, opisy, kategorie i ceny',
  'Gotowe publiczne menu z linkiem i QR',
  'Spersonalizowana ulotka QR do druku (PDF, A5)',
  '3 warianty projektu i 3 drobne poprawki',
] as const;

export const PricingPage: React.FC<Props> = ({
  subscriptionStatus,
  menuServiceStatus,
  flyerServiceStatus,
  onBack,
  onBuy,
}) => {
  const [busy, setBusy] = useState<PricingPlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [lifetimeOffer, setLifetimeOffer] = useState<LifetimeOfferState>(DEFAULT_LIFETIME_OFFER);
  const [lifetimeLoading, setLifetimeLoading] = useState(true);
  const canBuyTokens = canPurchaseTokenPacks(subscriptionStatus);
  const menuActive =
    menuServiceStatus === 'pending' ||
    menuServiceStatus === 'paid' ||
    menuServiceStatus === 'in_progress';
  const flyerActive =
    flyerServiceStatus === 'pending' ||
    flyerServiceStatus === 'paid' ||
    flyerServiceStatus === 'in_progress';
  const bundleActive = menuActive && flyerActive;
  const bundleDone = menuServiceStatus === 'done' && flyerServiceStatus === 'done';

  useEffect(() => {
    let cancelled = false;
    fetchLifetimeOffer()
      .then((offer) => {
        if (!cancelled) setLifetimeOffer(offer);
      })
      .catch(() => {
        /* karta pokazuje domyślną pulę 599 — cenę i tak ustala serwer */
      })
      .finally(() => {
        if (!cancelled) setLifetimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBuy = async (plan: PricingPlanType) => {
    if (plan === 'tokens' && !canBuyTokens) return;
    if (plan === 'implementation_bundle' && bundleActive) return;
    if (plan === 'founder_lifetime' && lifetimeOffer.soldOut) return;
    setBusy(plan);
    setError(null);
    try {
      await onBuy(plan);
      if (plan === 'implementation_bundle') {
        setAcceptedOffer(true);
        setBusy(null);
      }
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

        <div className="max-w-4xl mx-auto mb-6">
          <div className="relative flex flex-col rounded-[28px] border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-white p-6 sm:p-8 shadow-sm">
            <div className="inline-flex self-start items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Crown size={12} />
              {lifetimeOffer.soldOut
                ? 'Oferta Founder Lifetime wyprzedana'
                : lifetimeOffer.badge}
            </div>
            <p className="mt-5 text-4xl font-black text-slate-900 tracking-tight">
              {lifetimeOffer.soldOut ? '—' : `${lifetimeOffer.pricePln ?? 599} zł`}
              {!lifetimeOffer.soldOut && (
                <span className="text-lg font-bold text-slate-500"> jednorazowo</span>
              )}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-600">
              Bez miesięcznego abonamentu
            </p>
            {lifetimeOffer.nextTierNote && !lifetimeOffer.soldOut && (
              <p className="mt-1 text-sm text-slate-500">{lifetimeOffer.nextTierNote}</p>
            )}
            {lifetimeOffer.soldOut && (
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Oferta Founder Lifetime wyprzedana
              </p>
            )}
            <h2 className="mt-3 text-2xl font-black text-slate-900">Founder Lifetime</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              ChefVision Founder Lifetime — dożywotni dostęp do funkcji Premium za jednorazową opłatę.
              AI pozostaje na tokenach: bezterminowy dostęp nie oznacza nielimitowanego korzystania z generatora.
            </p>
            <ul className="mt-6 space-y-2.5">
              {LIFETIME_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-amber-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!!busy || lifetimeOffer.soldOut || lifetimeLoading}
              onClick={() => void handleBuy('founder_lifetime')}
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'founder_lifetime' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : lifetimeLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Ładowanie oferty…
                </span>
              ) : lifetimeOffer.soldOut ? (
                'Oferta wyprzedana'
              ) : (
                lifetimeOffer.buttonLabel || 'Kupuję'
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              39 zł
              <span className="text-lg font-bold text-slate-500"> / miesiąc</span>
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-900">Plan Start</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Profesjonalne cyfrowe menu dla Twojej restauracji.
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

          <div className="flex flex-col rounded-[28px] border-2 border-emerald-400 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              97 zł
              <span className="text-lg font-bold text-slate-500"> / miesiąc</span>
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-900">Plan Premium</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Dla restauracji, które chcą wykorzystać menu do zwiększania sprzedaży.
            </p>
            <p className="mt-5 text-sm font-black text-slate-900">Wszystko ze Start +:</p>
            <ul className="mt-3 space-y-2.5 flex-1">
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
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-60"
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
        </div>

        <div className="mt-6 max-w-4xl mx-auto">
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <div className="inline-flex self-start items-center gap-1.5 rounded-full bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Wand2 size={12} />
              Usługa zespołu
            </div>
            <div className="mt-5">
              <p className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-lg font-semibold text-slate-400 line-through decoration-slate-300">
                  299 zł
                </span>
                <span className="text-lg font-semibold text-slate-400 line-through decoration-slate-300">
                  149 zł
                </span>
                <span className="text-3xl font-black text-slate-900 tracking-tight">GRATIS</span>
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                Oferta wdrożeniowa dla nowych klientów.
              </p>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Wykonanie menu + ulotka QR</h2>
            <ul className="mt-6 space-y-2.5 flex-1">
              {IMPLEMENTATION_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {(acceptedOffer || bundleActive) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-sm font-black text-slate-900">Zlecenie przyjęte ✓</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Otrzymaliśmy Twoje zlecenie przygotowania menu i ulotki QR.
                  Usługa jest realizowana bezpłatnie w ramach oferty wdrożeniowej.
                </p>
              </div>
            )}
            <button
              type="button"
              disabled={!!busy || acceptedOffer || bundleActive}
              onClick={() => void handleBuy('implementation_bundle')}
              className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'implementation_bundle' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Wysyłanie…
                </span>
              ) : acceptedOffer || bundleActive ? (
                'Zlecenie aktywne'
              ) : bundleDone ? (
                'Zamów ponownie'
              ) : (
                'Zlecam wdrożenie'
              )}
            </button>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm max-w-4xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                <Package size={12} />
                Paczka tokenów
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">Paczka +50 tokenów</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
                Jednorazowy zakup. Tokeny nie przedawniają się — czekają na koncie aż do wykorzystania.
              </p>
              <ul className="mt-5 grid sm:grid-cols-2 gap-2.5">
                {TOKEN_PACK_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!canBuyTokens && (
                <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  Paczka tokenów jest dostępna w aktywnym planie Start, Premium lub Founder Lifetime.
                </p>
              )}
            </div>
            <div className="lg:w-56 shrink-0 text-center lg:text-right space-y-3">
              <p className="text-4xl font-black text-slate-900">
                30 zł
                <span className="block text-sm font-bold text-slate-500 mt-1">jednorazowo</span>
              </p>
              <button
                type="button"
                disabled={!!busy || !canBuyTokens}
                onClick={() => void handleBuy('tokens')}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'tokens' ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Przekierowanie…
                  </span>
                ) : (
                  'Kupuję'
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-8 text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <p className="mt-10 text-center text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Tokeny subskrypcyjne resetują się 1. dnia każdego miesiąca i nie przechodzą na kolejny okres.
          Tokeny z paczki są bezterminowe. Usługa wykonania menu oraz ulotka QR to płatności jednorazowe — nie zmieniają planu subskrypcji.
          Founder Lifetime to płatność jednorazowa — daje dożywotni dostęp Premium bez abonamentu
          i 100 bezterminowych tokenów AI (jednorazowo, bez miesięcznego odnawiania).
          Paczki +50 tokenów można dokupić w dowolnym momencie.
          Wezwanie kelnera / rachunek jest dostępne w planie Premium.
        </p>
      </main>
    </div>
  );
};

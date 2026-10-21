import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Package } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import {
  PREMIUM_YEAR_DISCOUNT_PERCENT,
  PREMIUM_YEAR_LIST_PLN,
  PREMIUM_YEAR_SAVINGS_PLN,
  PRICES_PLN,
  START_YEAR_LIST_PLN,
  START_YEAR_SAVINGS_PLN,
} from '../lib/pricingCatalog.js';
import { canPurchaseTokenPacks } from '../utils/tokens';
import type { FlyerServiceStatus, MenuServiceStatus, SubscriptionStatus } from '../types';

export type PricingPlanType =
  | 'start'
  | 'start_annual'
  | 'premium'
  | 'annual'
  | 'tokens'
  | 'menu_service'
  | 'flyer_service'
  | 'implementation_bundle';

type BillingInterval = 'month' | 'year';

interface Props {
  subscriptionStatus?: SubscriptionStatus;
  menuServiceStatus?: MenuServiceStatus | null;
  flyerServiceStatus?: FlyerServiceStatus | null;
  onBack: () => void;
  onBuy: (plan: PricingPlanType) => Promise<void>;
}

const START_FEATURES = [
  'Menu bez znaku wodnego',
  'Tłumaczenia menu na 14 języków',
  'Pairingi i upselling',
  'Statystyki otwarć menu',
  'Wiadomość do managera z poziomu menu',
  '10 tokenów AI miesięcznie',
] as const;

const PREMIUM_FEATURES = [
  'Hotel Hub',
  'Panel informacyjny',
  'Klub gości Premium',
  'Poproś kelnera / poproś o rachunek',
  'Ranking popularności dań',
  '50 tokenów AI miesięcznie',
  'Pomoc we wdrożeniu',
] as const;

const TOKEN_PACK_FEATURES = [
  'Bezterminowe',
  'Dostępne w planie Start i Premium',
  'Idealne na zmianę karty sezonowej',
] as const;

const MENU_SERVICE_FEATURES = [
  'Zespół ChefVision buduje Twoje menu cyfrowe',
  'Zdjęcia, opisy, kategorie i ceny',
  'Gotowe publiczne menu z linkiem i QR',
] as const;

const FLYER_FEATURES = [
  'Spersonalizowana ulotka QR do druku (PDF, A5)',
  '3 warianty projektu i 3 drobne poprawki',
] as const;

function isServiceActive(status?: MenuServiceStatus | FlyerServiceStatus | null) {
  return status === 'pending' || status === 'paid' || status === 'in_progress';
}

export const PricingPage: React.FC<Props> = ({
  subscriptionStatus,
  menuServiceStatus,
  flyerServiceStatus,
  onBack,
  onBuy,
}) => {
  const [busy, setBusy] = useState<PricingPlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('month');
  const canBuyTokens = canPurchaseTokenPacks(subscriptionStatus);
  const menuActive = isServiceActive(menuServiceStatus);
  const flyerActive = isServiceActive(flyerServiceStatus);
  const yearly = interval === 'year';

  const handleBuy = async (plan: PricingPlanType) => {
    if (plan === 'tokens' && !canBuyTokens) return;
    if (plan === 'menu_service' && menuActive) return;
    if (plan === 'flyer_service' && flyerActive) return;
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
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Wybierz plan dla swojej restauracji
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            Rozwiń menu cyfrowe, zwiększ sprzedaż i obsłuż gości z całego świata.
          </p>
          <div
            className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
            role="group"
            aria-label="Okres rozliczenia"
          >
            <button
              type="button"
              onClick={() => setInterval('month')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-black transition-colors ${
                interval === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Miesięcznie
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-black transition-colors ${
                interval === 'year' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rocznie
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              {yearly ? PRICES_PLN.startYear : PRICES_PLN.startMonth} zł
              <span className="text-lg font-bold text-slate-500"> {yearly ? '/ rok' : '/ miesiąc'}</span>
            </p>
            {yearly ? (
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                2 miesiące gratis — płacisz za 10 miesięcy, korzystasz 12
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Rocznie {PRICES_PLN.startYear} zł — 2 miesiące gratis
              </p>
            )}
            <h2 className="mt-3 text-2xl font-black text-slate-900">Start</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Wszystko, czego potrzebujesz, aby stworzyć profesjonalne cyfrowe menu i lepiej obsługiwać gości.
            </p>
            {yearly && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p>
                  {PRICES_PLN.startMonth} zł × 12 = {START_YEAR_LIST_PLN} zł / rok
                </p>
                <p className="font-black text-slate-900">Plan roczny: {PRICES_PLN.startYear} zł / rok</p>
                <p className="font-semibold text-emerald-700">Oszczędzasz {START_YEAR_SAVINGS_PLN} zł</p>
                <p className="mt-2 text-slate-600">Ulotka QR w cenie.</p>
              </div>
            )}
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
              onClick={() => void handleBuy(yearly ? 'start_annual' : 'start')}
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-60"
            >
              {busy === 'start' || busy === 'start_annual' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : (
                'Wybieram Start'
              )}
            </button>
          </div>

          <div className="flex flex-col rounded-[28px] border-2 border-emerald-400 bg-white p-6 sm:p-8 shadow-sm">
            <div className="inline-flex self-start items-center rounded-full bg-emerald-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              Najpopularniejszy
            </div>
            <p className="mt-5 text-4xl font-black text-slate-900 tracking-tight">
              {yearly ? PRICES_PLN.premiumYear : PRICES_PLN.premiumMonth} zł
              <span className="text-lg font-bold text-slate-500"> {yearly ? '/ rok' : '/ miesiąc'}</span>
            </p>
            {yearly ? (
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                {PREMIUM_YEAR_DISCOUNT_PERCENT}% taniej niż płatność miesięczna
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Rocznie {PRICES_PLN.premiumYear} zł — {PREMIUM_YEAR_DISCOUNT_PERCENT}% taniej
              </p>
            )}
            <h2 className="mt-3 text-2xl font-black text-slate-900">Premium</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Dla restauracji i hoteli, które chcą zapewnić gościom pełniejsze doświadczenie i wykorzystać więcej możliwości ChefVision.
            </p>
            {yearly && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                <p>
                  Premium miesięcznie: {PRICES_PLN.premiumMonth} zł × 12 = {PREMIUM_YEAR_LIST_PLN} zł / rok
                </p>
                <p className="font-black text-slate-900">Plan roczny: {PRICES_PLN.premiumYear} zł / rok</p>
                <p className="font-semibold text-emerald-700">
                  Oszczędzasz {PREMIUM_YEAR_SAVINGS_PLN} zł · {PREMIUM_YEAR_DISCOUNT_PERCENT}% taniej
                </p>
                <p className="mt-2 text-slate-600">Wdrożenie menu i ulotka QR w cenie.</p>
              </div>
            )}
            <p className="mt-5 text-sm font-black text-slate-900">Wszystko ze Start +</p>
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
              onClick={() => void handleBuy(yearly ? 'annual' : 'premium')}
              className="mt-8 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-60"
            >
              {busy === 'premium' || busy === 'annual' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : (
                'Wybieram Premium'
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <ServiceCard
            title="Wdrożenie menu"
            price={PRICES_PLN.menuService}
            note="Gratis przy zakupie rocznego planu Premium."
            features={MENU_SERVICE_FEATURES}
            active={menuActive}
            done={menuServiceStatus === 'done'}
            busy={busy === 'menu_service'}
            disabled={!!busy || menuActive}
            idleLabel="Zlecam wdrożenie"
            onBuy={() => void handleBuy('menu_service')}
          />
          <ServiceCard
            title="Ulotka QR"
            price={PRICES_PLN.flyerService}
            note="Gratis przy zakupie rocznego planu Start lub Premium."
            features={FLYER_FEATURES}
            active={flyerActive}
            done={flyerServiceStatus === 'done'}
            busy={busy === 'flyer_service'}
            disabled={!!busy || flyerActive}
            idleLabel="Zamawiam ulotkę"
            onBuy={() => void handleBuy('flyer_service')}
          />
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
                  Paczka tokenów jest dostępna w aktywnym planie Start lub Premium.
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
          Tokeny z paczki są bezterminowe. Wdrożenie menu ({PRICES_PLN.menuService} zł) oraz ulotka QR ({PRICES_PLN.flyerService} zł) to płatności jednorazowe — nie zmieniają planu subskrypcji.
          Wdrożenie menu jest gratis przy rocznym Premium. Ulotka QR jest gratis przy rocznym Start lub Premium.
          Plan roczny to jedna płatność za 12 miesięcy.
          Paczki +50 tokenów można dokupić w dowolnym momencie.
          Wezwanie kelnera / rachunek jest dostępne w planie Premium.
        </p>
      </main>
    </div>
  );
};

function ServiceCard({
  title,
  price,
  note,
  features,
  active,
  done,
  busy,
  disabled,
  idleLabel,
  onBuy,
}: {
  title: string;
  price: number;
  note: string;
  features: readonly string[];
  active: boolean;
  done: boolean;
  busy: boolean;
  disabled: boolean;
  idleLabel: string;
  onBuy: () => void;
}) {
  return (
    <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usługa jednorazowa</p>
      <p className="mt-3 text-3xl font-black text-slate-900 tracking-tight">
        {price} zł
        <span className="text-base font-bold text-slate-500"> jednorazowo</span>
      </p>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{note}</p>
      <h2 className="mt-3 text-xl font-black text-slate-900">{title}</h2>
      <ul className="mt-5 space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {active && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-sm font-black text-slate-900">Zlecenie w realizacji</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Otrzymaliśmy zlecenie. Damy znać, gdy będzie gotowe.
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onBuy}
        className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Przekierowanie…
          </span>
        ) : active ? (
          'Zlecenie aktywne'
        ) : done ? (
          'Zamów ponownie'
        ) : (
          idleLabel
        )}
      </button>
    </div>
  );
}

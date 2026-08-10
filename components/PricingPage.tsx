import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Package, Wand2, FileImage } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import { canPurchaseTokenPacks } from '../utils/tokens';
import type { FlyerServiceStatus, MenuServiceStatus, SubscriptionStatus } from '../types';

export type PricingPlanType = 'start' | 'premium' | 'tokens' | 'menu_service' | 'flyer_service';

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
  'Poproś kelnera / rachunek',
  'Ranking popularności dań',
  '50 tokenów AI',
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
  'Ty nadal masz własne konto i pełną kontrolę',
] as const;

const FLYER_SERVICE_FEATURES = [
  '3 warianty projektu do wyboru',
  '3 drobne poprawki do wybranego wariantu (kolory, teksty, układ)',
  'Plik gotowy do druku (PDF, format A5)',
  'Realizacja w 3 dni robocze',
] as const;

const MENU_SERVICE_STATUS_COPY: Record<MenuServiceStatus, string> = {
  paid: 'Zlecenie opłacone — nasz zespół wkrótce zajmie się Twoim menu.',
  in_progress: 'Pracujemy nad Twoim menu. Damy znać, gdy będzie gotowe.',
  done: 'Menu zostało przygotowane. Możesz je dalej edytować w panelu.',
  cancelled: 'Zlecenie anulowane. Możesz zamówić ponownie.',
};

const FLYER_SERVICE_STATUS_COPY: Record<FlyerServiceStatus, string> = {
  paid: 'Zlecenie opłacone — wkrótce przygotujemy warianty ulotki.',
  in_progress: 'Pracujemy nad ulotką. Damy znać, gdy będzie gotowa.',
  done: 'Ulotka gotowa — plik PDF został przekazany.',
  cancelled: 'Zlecenie anulowane. Możesz zamówić ponownie.',
};

export const PricingPage: React.FC<Props> = ({
  subscriptionStatus,
  menuServiceStatus,
  flyerServiceStatus,
  onBack,
  onBuy,
}) => {
  const [busy, setBusy] = useState<PricingPlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canBuyTokens = canPurchaseTokenPacks(subscriptionStatus);
  const hasActiveMenuOrder =
    menuServiceStatus === 'paid' || menuServiceStatus === 'in_progress' || menuServiceStatus === 'done';
  const hasActiveFlyerOrder =
    flyerServiceStatus === 'paid' || flyerServiceStatus === 'in_progress' || flyerServiceStatus === 'done';

  const handleBuy = async (plan: PricingPlanType) => {
    if (plan === 'tokens' && !canBuyTokens) return;
    if (plan === 'menu_service' && (menuServiceStatus === 'paid' || menuServiceStatus === 'in_progress')) {
      return;
    }
    if (plan === 'flyer_service' && (flyerServiceStatus === 'paid' || flyerServiceStatus === 'in_progress')) {
      return;
    }
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              30 zł
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

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <div className="inline-flex self-start items-center gap-1.5 rounded-full bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Wand2 size={12} />
              Usługa zespołu
            </div>
            <p className="mt-5 text-3xl font-black text-slate-900">
              299 zł
              <span className="text-base font-bold text-slate-500"> jednorazowo</span>
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Zleć wykonanie menu</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Zakładasz konto jak zwykle — my zdalnie przygotujemy Twoją kartę cyfrową.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {MENU_SERVICE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {menuServiceStatus && hasActiveMenuOrder && (
              <p className="mt-4 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                {MENU_SERVICE_STATUS_COPY[menuServiceStatus]}
              </p>
            )}
            <button
              type="button"
              disabled={
                !!busy ||
                menuServiceStatus === 'paid' ||
                menuServiceStatus === 'in_progress'
              }
              onClick={() => void handleBuy('menu_service')}
              className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'menu_service' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : menuServiceStatus === 'paid' || menuServiceStatus === 'in_progress' ? (
                'Zlecenie aktywne'
              ) : menuServiceStatus === 'done' ? (
                'Zamów ponownie'
              ) : (
                'Zlecam wykonanie'
              )}
            </button>
          </div>

          <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <div className="inline-flex self-start items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <FileImage size={12} />
              Projekt graficzny
            </div>
            <p className="mt-5 text-3xl font-black text-slate-900">
              149 zł
              <span className="text-base font-bold text-slate-500"> jednorazowo</span>
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Ulotka QR</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Spersonalizowany projekt z kodem QR do Twojego menu — gotowy do druku, w stylu Twojej marki.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {FLYER_SERVICE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {flyerServiceStatus && hasActiveFlyerOrder && (
              <p className="mt-4 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                {FLYER_SERVICE_STATUS_COPY[flyerServiceStatus]}
              </p>
            )}
            <button
              type="button"
              disabled={
                !!busy ||
                flyerServiceStatus === 'paid' ||
                flyerServiceStatus === 'in_progress'
              }
              onClick={() => void handleBuy('flyer_service')}
              className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'flyer_service' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Przekierowanie…
                </span>
              ) : flyerServiceStatus === 'paid' || flyerServiceStatus === 'in_progress' ? (
                'Zlecenie aktywne'
              ) : flyerServiceStatus === 'done' ? (
                'Zamów ponownie'
              ) : (
                'Zlecam ulotkę'
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
          Tokeny z paczki są bezterminowe. Usługa wykonania menu oraz ulotka QR to płatności jednorazowe — nie zmieniają planu subskrypcji.
          Wezwanie kelnera / rachunek jest dostępne w planie Premium.
        </p>
      </main>
    </div>
  );
};

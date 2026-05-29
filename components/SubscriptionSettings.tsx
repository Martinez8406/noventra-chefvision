import React, { useEffect, useState } from 'react';
import { Crown, CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { authService } from '../services/supabaseService';
import { createBillingPortalSession, createCheckoutSession } from '../services/stripeService';
import { formatTokenStatus } from '../utils/tokens';
import type { UserProfile } from '../types';

interface Props {
  userId: string | null;
}

export const SubscriptionSettings: React.FC<Props> = ({ userId }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await authService.getCurrentProfile();
        if (cancelled) return;
        setProfile(p);

        if (userId && p) {
          const { supabase } = await import('../services/supabaseService');
          if (supabase) {
            const { data } = await supabase
              .from('profiles')
              .select('stripe_customer_id')
              .eq('id', userId)
              .maybeSingle();
            if (!cancelled) {
              setStripeCustomerId(data?.stripe_customer_id?.trim() || null);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Nie udało się załadować planu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isPremium = profile?.subscriptionStatus === 'premium';
  const isTrial = profile?.subscriptionStatus === 'trial';
  const isFree = profile?.subscriptionStatus === 'free_limited';
  const hasStripePortal =
    !!stripeCustomerId && stripeCustomerId !== 'manual';

  const statusLabel = profile
    ? formatTokenStatus(
        profile.subscriptionStatus,
        profile.credits ?? 0,
        profile.tokens,
        profile.trialEndsAt
      )
    : '—';

  const handleCheckout = async () => {
    if (!userId) {
      alert('Musisz być zalogowany.');
      return;
    }
    setBusy('checkout');
    setError(null);
    try {
      await createCheckoutSession({
        userId,
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.origin,
      });
    } catch (e: any) {
      setError(e.message || 'Nie udało się otworzyć płatności.');
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    if (!userId) return;
    setBusy('portal');
    setError(null);
    try {
      await createBillingPortalSession({ userId, returnUrl: window.location.origin });
    } catch (e: any) {
      setError(e.message || 'Nie udało się otworzyć portalu Stripe.');
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-500 py-12">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm font-medium">Ładowanie planu…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              isPremium ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Crown size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Twój plan</p>
            <p className="text-lg font-black text-slate-900 mt-1">{statusLabel}</p>
            {isPremium && hasStripePortal && (
              <p className="text-xs text-slate-500 mt-2">
                Subskrypcja jest powiązana ze Stripe — możesz zmienić kartę, pobrać faktury lub anulować plan.
              </p>
            )}
            {isPremium && !hasStripePortal && (
              <p className="text-xs text-slate-500 mt-2">
                Konto Premium jest aktywne. Zarządzanie płatnościami odbywa się poza standardowym portalem Stripe
                (np. indywidualna umowa).
              </p>
            )}
            {isTrial && (
              <p className="text-xs text-slate-500 mt-2">
                W okresie trial masz ograniczoną pulę tokenów AI. Przejdź na Premium, aby odblokować pełne funkcje.
              </p>
            )}
            {isFree && (
              <p className="text-xs text-slate-500 mt-2">
                Plan darmowy — własne zdjęcia w menu. Premium odblokowuje generowanie AI i rekomendacje.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!isPremium && (
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={!!busy || !userId}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:from-emerald-300 hover:to-green-400 transition-all disabled:opacity-50"
          >
            {busy === 'checkout' ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
            {isTrial ? 'Przejdź na Premium' : 'Kup Premium'}
          </button>
        )}

        {hasStripePortal && (
          <button
            type="button"
            onClick={() => void handlePortal()}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {busy === 'portal' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CreditCard size={16} />
            )}
            Zarządzaj w Stripe
            <ExternalLink size={14} className="opacity-70" />
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <p className="text-[10px] text-slate-400 leading-relaxed max-w-lg">
        Portal Stripe umożliwia zmianę metody płatności, podgląd faktur i anulowanie subskrypcji. Po anulowaniu konto
        wraca do planu darmowego po zakończeniu opłaconego okresu.
      </p>
    </div>
  );
};

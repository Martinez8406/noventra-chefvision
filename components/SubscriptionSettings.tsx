import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { authService } from '../services/supabaseService';
import { createBillingPortalSession, createCheckoutSession } from '../services/stripeService';
import { formatTokenStatusI18n } from '../utils/formatTokenStatusI18n';
import type { UserProfile } from '../types';

interface Props {
  userId: string | null;
}

export const SubscriptionSettings: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('settings');
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
        if (!cancelled) setError(e.message || t('subscription.errors.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const isPremium = profile?.subscriptionStatus === 'premium';
  const isTrial = profile?.subscriptionStatus === 'trial';
  const isFree = profile?.subscriptionStatus === 'free_limited';
  const hasStripePortal =
    !!stripeCustomerId && stripeCustomerId !== 'manual';

  const statusLabel = profile
    ? formatTokenStatusI18n(
        profile.subscriptionStatus,
        profile.credits ?? 0,
        profile.tokens,
        profile.trialEndsAt,
      )
    : '—';

  const handleCheckout = async () => {
    if (!userId) {
      alert(t('subscription.loginRequired'));
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
      setError(e.message || t('subscription.errors.checkoutFailed'));
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
      setError(e.message || t('subscription.errors.portalFailed'));
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-500 py-12">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm font-medium">{t('subscription.loading')}</span>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('subscription.yourPlan')}
            </p>
            <p className="text-lg font-black text-slate-900 mt-1">{statusLabel}</p>
            {isPremium && hasStripePortal && (
              <p className="text-xs text-slate-500 mt-2">{t('subscription.premiumStripeHelp')}</p>
            )}
            {isPremium && !hasStripePortal && (
              <p className="text-xs text-slate-500 mt-2">{t('subscription.premiumManualHelp')}</p>
            )}
            {isTrial && <p className="text-xs text-slate-500 mt-2">{t('subscription.trialHelp')}</p>}
            {isFree && <p className="text-xs text-slate-500 mt-2">{t('subscription.freeHelp')}</p>}
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
            {isTrial ? t('subscription.upgradeToPremium') : t('subscription.buyPremium')}
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
            {t('subscription.manageStripe')}
            <ExternalLink size={14} className="opacity-70" />
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <p className="text-[10px] text-slate-400 leading-relaxed max-w-lg">{t('subscription.stripePortalHelp')}</p>
    </div>
  );
};

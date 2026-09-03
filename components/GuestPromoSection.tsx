import React, { useEffect, useState } from 'react';
import { Gift, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Offer {
  rewardName: string;
  rewardDescription: string;
}

interface Props {
  restaurantId: string;
  offer: Offer;
}

export const GuestPromoSection: React.FC<Props> = ({ restaurantId, offer }) => {
  const { t } = useTranslation('guestPromo');
  const [open, setOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const isDessert = /deser|dessert/i.test(offer.rewardName || '');
  const claimLabel = isDessert ? t('claim') : t('claimGeneric');
  const canSubmit = firstName.trim().length >= 2 && email.includes('@') && termsAccepted && marketingConsent && !busy;

  const submit = async (isResend = false) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/promo-codes?op=${isResend ? 'resend' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          firstName: firstName.trim(),
          email: email.trim(),
          termsAccepted,
          marketingConsent,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 429) {
        setCooldown(Number(data?.retryAfter) || 60);
        throw new Error(data?.error || t('resendWait', { seconds: 60 }));
      }
      if (!response.ok) throw new Error(data?.error || t('invalidBody'));
      setMaskedEmail(data?.maskedEmail || `${email.trim()[0]}***`);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="w-full max-w-2xl mx-auto mt-10 mb-4 px-2">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.18)] text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-chef-gold/30 bg-chef-gold/15 text-chef-gold">
            <Gift size={22} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-chef-gold">🎁 {offer.rewardName || t('boxFallbackTitle')}</p>
          <p className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-md mx-auto">
            {offer.rewardDescription}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 inline-flex items-center justify-center px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2"
          >
            {claimLabel}
          </button>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#141414] text-white rounded-t-[28px] sm:rounded-[28px] p-6 relative">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-4 text-zinc-400" aria-label={t('close')}>
              <X size={20} />
            </button>

            {maskedEmail ? (
              <div className="space-y-4 pt-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-chef-gold">📧 {t('checkTitle')}</p>
                <p className="text-sm text-zinc-300">{t('checkBody')}</p>
                <p className="font-mono text-lg font-black">{maskedEmail}</p>
                <p className="text-sm text-zinc-500">{t('checkHint')}</p>
                {error && <p className="text-sm text-red-300">{error}</p>}
                <button
                  type="button"
                  disabled={busy || cooldown > 0}
                  onClick={() => void submit(true)}
                  className="w-full py-3.5 rounded-2xl text-sm font-black uppercase text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 disabled:opacity-50"
                >
                  {cooldown > 0 ? t('resendWait', { seconds: cooldown }) : t('resend')}
                </button>
              </div>
            ) : (
              <form
                className="space-y-4 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) void submit(false);
                }}
              >
                <h2 className="text-2xl font-black">{t('formTitle')}</h2>
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{t('firstName')}</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{t('email')}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                    autoComplete="email"
                    required
                  />
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-300">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1" required />
                  <span>
                    {t('terms')}{' '}
                    <button type="button" className="underline text-chef-gold" onClick={() => setTermsOpen(true)}>
                      {t('termsLink')}
                    </button>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-300">
                  <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1" required />
                  <span>{t('marketing')}</span>
                </label>
                {error && <p className="text-sm text-red-300">{error}</p>}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-3.5 rounded-2xl text-sm font-black uppercase text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                  {busy ? t('submitting') : claimLabel}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {termsOpen && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] text-white rounded-[28px] p-6 space-y-4">
            <h3 className="text-xl font-black">{t('termsTitle')}</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{t('termsBody')}</p>
            <p className="text-sm font-semibold text-white">{offer.rewardName}</p>
            <p className="text-sm text-zinc-400">{offer.rewardDescription}</p>
            <button type="button" onClick={() => setTermsOpen(false)} className="w-full py-3 rounded-2xl bg-white/10 font-bold">
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

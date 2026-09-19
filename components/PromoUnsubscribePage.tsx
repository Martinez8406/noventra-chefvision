import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_LOGO_SRC } from '../constants';

interface Props {
  token: string | null;
}

type UnsubBody = {
  outcome?: 'prompt' | 'unsubscribed' | 'invalid';
  maskedEmail?: string;
  restaurantName?: string;
  error?: string;
};

export const PromoUnsubscribePage: React.FC<Props> = ({ token }) => {
  const { t } = useTranslation('guestPromo');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<UnsubBody | null>(null);

  useEffect(() => {
    document.title = 'ChefVision';
  }, []);

  useEffect(() => {
    if (!token) {
      setData({ outcome: 'invalid' });
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/promo-codes?op=unsubscribe&token=${encodeURIComponent(token)}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        setData(body || { outcome: 'invalid' });
      } catch {
        if (!cancelled) setData({ outcome: 'invalid' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirmUnsub = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/promo-codes?op=unsubscribe&token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => null);
      setData(body || { outcome: 'invalid' });
    } catch {
      setData({ outcome: 'invalid' });
    } finally {
      setBusy(false);
    }
  };

  const outcome = data?.outcome || 'invalid';

  return (
    <div className="min-h-screen bg-[#0b0f0d] text-white flex flex-col items-center px-5 py-10">
      <img src={BRAND_LOGO_SRC} alt="" className="h-10 w-10 rounded-xl object-cover mb-6" />
      {loading ? (
        <p className="text-zinc-400">{t('unsubLoading')}</p>
      ) : outcome === 'unsubscribed' ? (
        <div className="w-full max-w-md text-center space-y-5">
          <p className="text-3xl font-black">{t('unsubDoneTitle')}</p>
          <p className="text-sm text-zinc-400 leading-relaxed">{t('unsubDoneBody')}</p>
          <p className="text-sm text-zinc-500">{t('closePage')}</p>
        </div>
      ) : outcome === 'prompt' ? (
        <div className="w-full max-w-md text-center space-y-5">
          <p className="text-3xl font-black">{t('unsubTitle')}</p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {t('unsubBody', {
              restaurant: data?.restaurantName || t('unsubRestaurantFallback'),
              email: data?.maskedEmail || '***',
            })}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmUnsub()}
            className="w-full py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 disabled:opacity-50"
          >
            {busy ? t('unsubSubmitting') : t('unsubConfirm')}
          </button>
          <p className="text-xs text-zinc-500 leading-relaxed">{t('unsubHint')}</p>
        </div>
      ) : (
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-3xl font-black">{t('invalidTitle')}</p>
          <p className="text-zinc-400">{data?.error || t('unsubInvalid')}</p>
        </div>
      )}
    </div>
  );
};

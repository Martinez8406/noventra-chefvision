import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_LOGO_SRC } from '../constants';

interface Props {
  token: string | null;
}

type ConfirmBody = {
  outcome?: 'ready' | 'used' | 'expired' | 'invalid';
  code?: string | null;
  rewardName?: string | null;
  rewardDescription?: string | null;
  expiresAt?: string | null;
  error?: string;
};

export const PromoConfirmPage: React.FC<Props> = ({ token }) => {
  const { t, i18n } = useTranslation('guestPromo');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfirmBody | null>(null);
  const [copied, setCopied] = useState(false);

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
        const response = await fetch(`/api/promo-codes?op=confirm&token=${encodeURIComponent(token)}`);
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

  const copy = async () => {
    if (!data?.code) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const dateLabel = data?.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'pl-PL')
    : null;

  const outcome = data?.outcome || 'invalid';

  return (
    <div className="min-h-screen bg-[#0b0f0d] text-white flex flex-col items-center px-5 py-10">
      <img src={BRAND_LOGO_SRC} alt="" className="h-10 w-10 rounded-xl object-cover mb-6" />
      {loading ? (
        <p className="text-zinc-400">{t('loading')}</p>
      ) : outcome === 'ready' && data?.code ? (
        <div className="w-full max-w-md text-center space-y-5">
          <p className="text-3xl font-black">🎉 {t('readyTitle')}</p>
          <p className="text-zinc-400">{t('yourBonus')}</p>
          <p className="text-2xl font-black">{data.rewardName}</p>
          {data.rewardDescription ? <p className="text-sm text-zinc-400">{data.rewardDescription}</p> : null}
          <p className="text-zinc-400 pt-2">{t('yourCode')}</p>
          <p className="font-mono text-5xl font-black tracking-[0.18em]">{data.code}</p>
          <p className="text-sm text-zinc-400">{t('showWaiter')}</p>
          {dateLabel ? <p className="text-sm text-zinc-500">{t('validUntil', { date: dateLabel })}</p> : null}
          <button
            type="button"
            onClick={() => void copy()}
            className="w-full py-4 rounded-2xl text-lg font-black uppercase text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      ) : outcome === 'used' ? (
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-3xl font-black">✅ {t('usedTitle')}</p>
          {data?.code ? <p className="font-mono text-3xl font-black tracking-[0.14em]">{data.code}</p> : null}
          <p className="text-zinc-400">{t('usedBody')}</p>
        </div>
      ) : outcome === 'expired' && data?.code ? (
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-3xl font-black">{t('codeExpired')}</p>
          <p className="font-mono text-3xl font-black tracking-[0.14em]">{data.code}</p>
        </div>
      ) : outcome === 'expired' ? (
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-3xl font-black">{t('expiredTitle')}</p>
          <p className="text-zinc-400">{t('expiredBody')}</p>
        </div>
      ) : (
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-3xl font-black">{t('invalidTitle')}</p>
          <p className="text-zinc-400">{data?.error || t('invalidBody')}</p>
        </div>
      )}
    </div>
  );
};

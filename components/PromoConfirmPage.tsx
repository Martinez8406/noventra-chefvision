import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_LOGO_SRC } from '../constants';

interface Props {
  token: string | null;
}

type ConfirmBody = {
  outcome?: 'joined' | 'expired' | 'invalid';
  error?: string;
  unsubscribeUrl?: string | null;
  restaurantName?: string;
  welcome?: {
    code?: string;
    percent?: number | null;
    expiresAt?: string | null;
    status?: string;
  } | null;
};

function formatExpiry(value: string) {
  try {
    return new Date(value).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export const PromoConfirmPage: React.FC<Props> = ({ token }) => {
  const { t } = useTranslation('guestPromo');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfirmBody | null>(null);

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

  const outcome = data?.outcome || 'invalid';

  return (
    <div className="min-h-screen bg-[#0b0f0d] text-white flex flex-col items-center px-5 py-10">
      <img src={BRAND_LOGO_SRC} alt="" className="h-10 w-10 rounded-xl object-cover mb-6" />
      {loading ? (
        <p className="text-zinc-400">{t('loading')}</p>
      ) : outcome === 'joined' ? (
        <div className="w-full max-w-md text-center space-y-5">
          <p className="text-3xl font-black">🎉 {t('readyTitle')}</p>
          <p className="text-2xl font-black">{t('joinedTitle')}</p>
          {data?.restaurantName ? <p className="text-sm text-zinc-300">{data.restaurantName}</p> : null}
          {data?.welcome?.code ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 space-y-2 text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-chef-gold">{t('bonusCode')}</p>
              <p className="font-mono text-4xl font-black tracking-[0.14em] text-center">{data.welcome.code}</p>
              {data.welcome.percent ? <p className="text-sm text-zinc-200">{t('bonusScope', { percent: data.welcome.percent })}</p> : null}
              {data.welcome.expiresAt ? <p className="text-sm text-zinc-300">{t('bonusUntil', { date: formatExpiry(data.welcome.expiresAt) })}</p> : null}
              <p className="text-sm text-zinc-300">
                {t('bonusStatus', {
                  status:
                    data.welcome.status === 'used'
                      ? t('bonusStatusUsed')
                      : data.welcome.status === 'expired'
                        ? t('bonusStatusExpired')
                        : t('bonusStatusActive'),
                })}
              </p>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('bonusHint')}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 leading-relaxed">{t('joinedBody')}</p>
          )}
          {data?.unsubscribeUrl ? (
            <p className="text-sm text-zinc-500">
              <a href={data.unsubscribeUrl} className="underline text-zinc-400 hover:text-white">
                {t('unsubConfirm')}
              </a>
            </p>
          ) : null}
          <p className="text-sm text-zinc-500">{t('closePage')}</p>
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

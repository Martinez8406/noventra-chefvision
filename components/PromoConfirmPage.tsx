import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_LOGO_SRC } from '../constants';

interface Props {
  token: string | null;
}

type ConfirmBody = {
  outcome?: 'joined' | 'expired' | 'invalid';
  error?: string;
};

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
          <p className="text-sm text-zinc-400 leading-relaxed">{t('joinedBody')}</p>
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

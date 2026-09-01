import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_LOGO_SRC } from '../constants';
import { formatPromoCodeInput, isValidPromoCodeFormat } from '../utils/promoCodeFormat';

const STORAGE_KEY = 'chefvision_verify_session_v1';

type VerifyOutcome = 'active' | 'used' | 'expired' | 'invalid' | 'redeemed';

type StoredSession = {
  token: string;
  restaurantId: string;
  restaurantName: string;
  expiresAt: string;
};

type LookupResult = {
  outcome: VerifyOutcome;
  code: string | null;
  rewardName: string | null;
  rewardDescription: string | null;
};

interface Props {
  restaurantIdFromRoute: string | null;
}

function readStoredSession(restaurantId: string | null): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.restaurantId) return null;
    if (restaurantId && parsed.restaurantId !== restaurantId) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export const VerifyApp: React.FC<Props> = ({ restaurantIdFromRoute }) => {
  const { t } = useTranslation('verify');
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession(restaurantIdFromRoute));
  const [pin, setPin] = useState('');
  const [restaurantIdInput, setRestaurantIdInput] = useState(restaurantIdFromRoute || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  useEffect(() => {
    document.title = 'ChefVision Verify';
  }, []);

  const restaurantId = session?.restaurantId || restaurantIdFromRoute || restaurantIdInput.trim();
  const codeValid = isValidPromoCodeFormat(code);

  const resultTheme = useMemo(() => {
    const outcome = result?.outcome;
    if (outcome === 'active') return { bg: 'bg-emerald-500/15 border-emerald-400/40', title: 'text-emerald-300', emoji: '🟢' };
    if (outcome === 'redeemed') return { bg: 'bg-emerald-500/15 border-emerald-400/40', title: 'text-emerald-300', emoji: '✅' };
    if (outcome === 'expired') return { bg: 'bg-orange-500/15 border-orange-400/40', title: 'text-orange-300', emoji: '🟠' };
    if (outcome === 'used') return { bg: 'bg-red-500/15 border-red-400/40', title: 'text-red-300', emoji: '🔴' };
    if (outcome === 'invalid') return { bg: 'bg-red-500/15 border-red-400/40', title: 'text-red-300', emoji: '🔴' };
    return null;
  }, [result?.outcome]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!restaurantId) {
      setError(t('restaurantIdHint'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, pin }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      const next: StoredSession = {
        token: data.token,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName || '',
        expiresAt: data.expiresAt,
      };
      persistSession(next);
      setSession(next);
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pinHint'));
    } finally {
      setBusy(false);
    }
  };

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !codeValid) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Verify-Session': session.token,
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        clearSession();
        setSession(null);
        throw new Error(data?.error || t('sessionExpired'));
      }
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      setResult({
        outcome: data.outcome,
        code: data.code,
        rewardName: data.rewardName,
        rewardDescription: data.rewardDescription,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidTitle'));
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!session || !result?.code) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/redeem-promo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Verify-Session': session.token,
        },
        body: JSON.stringify({ code: result.code }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        clearSession();
        setSession(null);
        throw new Error(data?.error || t('sessionExpired'));
      }
      if (!response.ok && data?.outcome !== 'used' && data?.outcome !== 'expired' && data?.outcome !== 'invalid') {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      setResult({
        outcome: data.outcome === 'redeemed' ? 'redeemed' : data.outcome,
        code: data.code || result.code,
        rewardName: data.rewardName,
        rewardDescription: data.rewardDescription,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidTitle'));
    } finally {
      setBusy(false);
    }
  };

  const resetToEntry = () => {
    setResult(null);
    setCode('');
    setError(null);
  };

  const lockDevice = () => {
    clearSession();
    setSession(null);
    setResult(null);
    setCode('');
    setPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0f0d] text-white flex flex-col">
      <header className="px-5 pt-8 pb-4 flex items-center justify-center gap-3">
        <img src={BRAND_LOGO_SRC} alt="" className="h-10 w-10 rounded-xl object-cover" />
        <div className="leading-none text-center">
          <p className="text-[11px] font-black tracking-[0.28em] text-chef-gold uppercase">{t('title')}</p>
          {session?.restaurantName ? (
            <p className="mt-1.5 text-sm font-semibold text-zinc-300">{session.restaurantName}</p>
          ) : null}
        </div>
      </header>

      <main className="flex-1 px-5 pb-8 w-full max-w-md mx-auto">
        {!session ? (
          <form onSubmit={handleUnlock} className="space-y-5 mt-6">
            <h1 className="text-3xl font-black tracking-tight">{t('pinTitle')}</h1>
            <p className="text-zinc-400 text-base leading-relaxed">{t('pinHint')}</p>

            {!restaurantIdFromRoute && (
              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{t('restaurantIdLabel')}</span>
                <input
                  value={restaurantIdInput}
                  onChange={(e) => setRestaurantIdInput(e.target.value.trim())}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-base text-white outline-none focus:ring-4 focus:ring-chef-gold/20"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <span className="block text-xs text-zinc-500">{t('restaurantIdHint')}</span>
              </label>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={t('pinPlaceholder')}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-5 text-center text-3xl tracking-[0.4em] text-white outline-none focus:ring-4 focus:ring-chef-gold/25"
                autoComplete="off"
              />
            </label>

            {error && <p className="text-red-300 text-sm font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={busy || pin.length < 4 || !restaurantId}
              className="w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 disabled:opacity-50"
            >
              {busy ? t('pinUnlocking') : t('pinUnlock')}
            </button>
          </form>
        ) : result ? (
          <div className="mt-4 space-y-5">
            <div className={`rounded-[28px] border p-6 ${resultTheme?.bg || 'bg-white/5 border-white/10'}`}>
              <p className={`text-2xl font-black ${resultTheme?.title || 'text-white'}`}>
                {resultTheme?.emoji} {t(`${result.outcome}Title`)}
              </p>
              {result.code && (
                <p className="mt-4 font-mono text-4xl font-black tracking-[0.18em] text-white">{result.code}</p>
              )}
              {result.outcome === 'active' && result.rewardName && (
                <div className="mt-5 space-y-2">
                  <p className="text-2xl font-black text-white">{result.rewardName}</p>
                  {result.rewardDescription && (
                    <p className="text-base text-zinc-300 leading-relaxed">
                      {t('conditionLabel')}: {result.rewardDescription}
                    </p>
                  )}
                </div>
              )}
              {result.outcome === 'used' && (
                <p className="mt-4 text-base text-zinc-200">{t('usedBody', { code: result.code })}</p>
              )}
              {result.outcome === 'expired' && (
                <p className="mt-4 text-base text-zinc-200">{t('expiredBody', { code: result.code })}</p>
              )}
              {result.outcome === 'invalid' && (
                <p className="mt-4 text-base text-zinc-200">{t('invalidBody')}</p>
              )}
              {result.outcome === 'redeemed' && (
                <p className="mt-4 text-base text-zinc-200">{t('redeemedBody', { code: result.code })}</p>
              )}
            </div>

            {error && <p className="text-red-300 text-sm font-semibold">{error}</p>}

            {result.outcome === 'active' ? (
              <button
                type="button"
                onClick={() => void handleRedeem()}
                disabled={busy}
                className="w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wide text-[#052e16] bg-emerald-400 disabled:opacity-50"
              >
                {busy ? t('redeeming') : t('redeem')}
              </button>
            ) : (
              <button
                type="button"
                onClick={resetToEntry}
                className="w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2"
              >
                {t('checkAnother')}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleLookup} className="mt-6 space-y-5">
            <h1 className="text-3xl font-black tracking-tight">{t('subtitle')}</h1>
            <input
              value={code}
              onChange={(e) => setCode(formatPromoCodeInput(e.target.value))}
              placeholder={t('codePlaceholder')}
              maxLength={7}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="w-full rounded-[28px] bg-white/5 border border-white/10 px-4 py-6 text-center font-mono text-4xl font-black tracking-[0.18em] text-white outline-none focus:ring-4 focus:ring-chef-gold/25"
            />
            <p className="text-sm text-zinc-500 text-center">{t('formatHint')}</p>
            {error && <p className="text-red-300 text-sm font-semibold text-center">{error}</p>}
            <button
              type="submit"
              disabled={busy || !codeValid}
              className="w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 disabled:opacity-50"
            >
              {busy ? t('checking') : t('check')}
            </button>
            <button
              type="button"
              onClick={lockDevice}
              className="w-full py-3 text-sm font-semibold text-zinc-500"
            >
              {t('lockDevice')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

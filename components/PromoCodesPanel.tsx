import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, KeyRound, Loader2, Ticket } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { buildVerifyUrl } from '../utils/verifyRoute';
import type { PromoCodeRecord } from '../types';

interface Props {
  userId: string | null;
}

async function ownerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!supabase) return headers;
  await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === 'active') return t('promo.statuses.active');
  if (status === 'used') return t('promo.statuses.used');
  if (status === 'expired') return t('promo.statuses.expired');
  if (status === 'cancelled') return t('promo.statuses.cancelled');
  return status;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export const PromoCodesPanel: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('settings');
  const [loading, setLoading] = useState(true);
  const [savingPin, setSavingPin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [pin, setPin] = useState('');
  const [codes, setCodes] = useState<PromoCodeRecord[]>([]);
  const [rewardName, setRewardName] = useState('Darmowy deser');
  const [rewardDescription, setRewardDescription] = useState('Do zamówienia dania głównego');
  const [email, setEmail] = useState('');
  const [specificCode, setSpecificCode] = useState('');
  const [copied, setCopied] = useState(false);

  const verifyUrl = userId ? buildVerifyUrl(userId, true) : '';

  const targetQuery = userId ? `?targetUserId=${encodeURIComponent(userId)}` : '';

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = await ownerHeaders();
      const [pinRes, codesRes] = await Promise.all([
        fetch(`/api/promo-pin${targetQuery}`, { headers }),
        fetch(`/api/promo-codes${targetQuery}`, { headers }),
      ]);
      const pinData = await pinRes.json().catch(() => null);
      const codesData = await codesRes.json().catch(() => null);
      if (!pinRes.ok) throw new Error(pinData?.error || `PIN HTTP ${pinRes.status}`);
      if (!codesRes.ok) throw new Error(codesData?.error || `Codes HTTP ${codesRes.status}`);
      setPinSet(pinData?.pinSet === true);
      setCodes(Array.isArray(codesData?.codes) ? codesData.codes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('promo.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [userId, targetQuery, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSavePin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setSavingPin(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await ownerHeaders();
      const response = await fetch('/api/promo-pin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin, targetUserId: userId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setPinSet(true);
      setPin('');
      setNotice(t('promo.pinSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('promo.errors.pinFailed'));
    } finally {
      setSavingPin(false);
    }
  };

  const createCode = async (payload: Record<string, unknown>) => {
    if (!userId) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await ownerHeaders();
      const response = await fetch('/api/promo-codes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, targetUserId: userId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setNotice(t('promo.codeCreated', { code: data?.code?.code || '' }));
      setEmail('');
      setSpecificCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('promo.errors.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await createCode({
      rewardName,
      rewardDescription,
      email: email.trim() || null,
      code: specificCode.trim() || null,
    });
  };

  const handleTestCode = async () => {
    await createCode({
      rewardName: rewardName || 'Darmowy deser',
      rewardDescription: rewardDescription || 'Do zamówienia dania głównego',
      code: 'KT-4827',
      metadata: { source: 'test_seed' },
    });
  };

  const handleCancel = async (id: string) => {
    if (!userId) return;
    setError(null);
    try {
      const headers = await ownerHeaders();
      const response = await fetch('/api/promo-codes', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id, targetUserId: userId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('promo.errors.cancelFailed'));
    }
  };

  const copyLink = async () => {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!userId) {
    return <p className="text-sm text-slate-500">{t('promo.loginRequired')}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-chef-gold flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">{t('promo.verifyLinkTitle')}</h3>
            <p className="text-sm text-slate-500">{t('promo.verifyLinkHint')}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {verifyUrl && (
            <div className="bg-white p-3 rounded-2xl border border-slate-200">
              <QRCodeCanvas value={verifyUrl} size={132} />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-mono break-all text-slate-700 bg-slate-50 rounded-xl px-3 py-2">{verifyUrl}</p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold"
            >
              <Copy size={16} />
              {copied ? t('promo.copied') : t('promo.copyLink')}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-lg font-black text-slate-900">{t('promo.pinTitle')}</h3>
        <p className="text-sm text-slate-500">{t('promo.pinHint')}</p>
        <p className="text-sm font-semibold text-slate-700">
          {pinSet ? t('promo.pinIsSet') : t('promo.pinMissing')}
        </p>
        <form onSubmit={handleSavePin} className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder={t('promo.pinPlaceholder')}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15"
          />
          <button
            type="submit"
            disabled={savingPin || pin.length < 4}
            className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
          >
            {savingPin ? t('promo.saving') : t('promo.savePin')}
          </button>
        </form>
      </section>

      <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Ticket size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">{t('promo.createTitle')}</h3>
            <p className="text-sm text-slate-500">{t('promo.createHint')}</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-1">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('promo.rewardName')}</span>
            <input
              value={rewardName}
              onChange={(e) => setRewardName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15"
            />
          </label>
          <label className="block space-y-1 sm:col-span-1">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('promo.specificCode')}</span>
            <input
              value={specificCode}
              onChange={(e) => setSpecificCode(e.target.value.toUpperCase())}
              placeholder="KT-4827"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-mono outline-none focus:ring-4 focus:ring-chef-gold/15"
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('promo.rewardDescription')}</span>
            <input
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15"
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('promo.guestEmail')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15"
            />
          </label>
          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={creating || !rewardName.trim()}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
            >
              {creating ? t('promo.creating') : t('promo.createCode')}
            </button>
            <button
              type="button"
              onClick={() => void handleTestCode()}
              disabled={creating}
              className="px-5 py-3 rounded-2xl border border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50"
            >
              {t('promo.createTestCode')}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>
      )}
      {notice && (
        <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">{notice}</p>
      )}

      <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-black text-slate-900">{t('promo.listTitle')}</h3>
          <button type="button" onClick={() => void load()} className="text-sm font-bold text-slate-500">
            {t('promo.refresh')}
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="animate-spin" size={16} />
            {t('promo.loading')}
          </div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-slate-500">{t('promo.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2 pr-3">{t('promo.colCode')}</th>
                  <th className="py-2 pr-3">{t('promo.colReward')}</th>
                  <th className="py-2 pr-3">{t('promo.colStatus')}</th>
                  <th className="py-2 pr-3">{t('promo.colCreated')}</th>
                  <th className="py-2 pr-3">{t('promo.colUsed')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {codes.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-3 pr-3 font-mono font-bold text-slate-900">{row.code}</td>
                    <td className="py-3 pr-3 text-slate-700">
                      <span className="font-semibold">{row.rewardName}</span>
                      {row.rewardDescription ? (
                        <span className="block text-xs text-slate-400">{row.rewardDescription}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-lg text-[11px] font-black uppercase ${
                          row.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'used'
                              ? 'bg-slate-100 text-slate-600'
                              : row.status === 'expired'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {statusLabel(row.status, t)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{formatDate(row.usedAt)}</td>
                    <td className="py-3 text-right">
                      {row.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => void handleCancel(row.id)}
                          className="text-xs font-bold text-slate-400 hover:text-red-600"
                        >
                          {t('promo.cancel')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

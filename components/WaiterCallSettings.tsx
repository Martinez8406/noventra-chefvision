import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseService';

interface Props {
  userId: string | null;
}

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/i;

export const WaiterCallSettings: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('settings');
  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !supabase) {
      setEnabled(false);
      setWebhookUrl('');
      return;
    }

    const fetchSettings = async () => {
      setIsFetching(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('waiter_call_enabled, discord_waiter_webhook_url')
        .eq('id', userId)
        .single();

      if (fetchError) {
        const missingColumn = /waiter_call|discord_waiter/i.test(fetchError.message || '');
        if (!missingColumn) {
          setError(fetchError.message || t('waiterCall.errors.fetchFailed'));
        } else {
          setError(t('waiterCall.errors.migrationRequired'));
        }
      } else {
        setEnabled(data?.waiter_call_enabled === true);
        setWebhookUrl(
          typeof data?.discord_waiter_webhook_url === 'string'
            ? data.discord_waiter_webhook_url
            : '',
        );
      }

      setIsFetching(false);
    };

    void fetchSettings();
  }, [userId, t]);

  const validateWebhook = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setWebhookError(null);
      return true;
    }
    if (!DISCORD_WEBHOOK_RE.test(trimmed)) {
      setWebhookError(t('waiterCall.invalidWebhook'));
      return false;
    }
    setWebhookError(null);
    return true;
  };

  const handleSave = async () => {
    if (!userId || !supabase) return;

    const normalized = webhookUrl.trim();
    if (enabled && !normalized) {
      setWebhookError(t('waiterCall.webhookRequired'));
      return;
    }
    if (normalized && !validateWebhook(normalized)) return;

    setIsSaving(true);
    setError(null);
    setIsSaved(false);
    setTestFeedback(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        waiter_call_enabled: enabled,
        discord_waiter_webhook_url: normalized || null,
      })
      .eq('id', userId);

    if (updateError) {
      setError(
        /waiter_call|discord_waiter/i.test(updateError.message || '')
          ? t('waiterCall.errors.migrationRequired')
          : updateError.message || t('waiterCall.errors.saveFailed'),
      );
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }

    setIsSaving(false);
  };

  const handleTest = async () => {
    if (!userId) return;
    const normalized = webhookUrl.trim();
    if (!normalized || !validateWebhook(normalized)) {
      setWebhookError(t('waiterCall.webhookRequired'));
      return;
    }

    setIsTesting(true);
    setTestFeedback(null);
    setError(null);

    try {
      if (supabase) {
        const { error: saveError } = await supabase
          .from('profiles')
          .update({
            waiter_call_enabled: true,
            discord_waiter_webhook_url: normalized,
          })
          .eq('id', userId);
        if (saveError) {
          setError(
            /waiter_call|discord_waiter/i.test(saveError.message || '')
              ? t('waiterCall.errors.migrationRequired')
              : saveError.message || t('waiterCall.errors.saveFailed'),
          );
          setIsTesting(false);
          return;
        }
        setEnabled(true);
      }

      const response = await fetch('/api/request-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: userId,
          table: `T-${Date.now().toString(36).slice(-4)}`,
          action: 'waiter',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : `${t('waiterCall.errors.testFailed')} (${response.status})`,
        );
      } else {
        setTestFeedback(t('waiterCall.testOk'));
        setTimeout(() => setTestFeedback(null), 4000);
      }
    } catch (e) {
      console.error('[waiter-call test]', e);
      setError(t('waiterCall.errors.testFailed'));
    }

    setIsTesting(false);
  };

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <BellRing size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black text-slate-900">{t('waiterCall.title')}</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-3xl">{t('waiterCall.intro')}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="text-sm font-bold text-slate-800 block">{t('waiterCall.enableLabel')}</span>
            <span className="text-xs text-slate-500 mt-0.5 block">{t('waiterCall.enableHelp')}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!userId || isFetching || isSaving}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50 ${
              enabled ? 'bg-slate-900' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
            {t('waiterCall.webhookLabel')}
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => {
              setWebhookUrl(e.target.value);
              if (webhookError) validateWebhook(e.target.value);
            }}
            onBlur={() => validateWebhook(webhookUrl)}
            placeholder={t('waiterCall.webhookPlaceholder')}
            disabled={!userId || isFetching || isSaving}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            autoComplete="off"
            spellCheck={false}
          />
          {webhookError && <p className="text-xs text-red-500 font-medium">{webhookError}</p>}
          {enabled && !webhookUrl.trim() && (
            <p className="text-xs text-amber-700 font-medium">{t('waiterCall.webhookRequired')}</p>
          )}
          <p className="text-xs text-slate-500 leading-relaxed">{t('waiterCall.webhookHelp')}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!userId || isFetching || isSaving || !!webhookError}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('waiterCall.saving')}
            </>
          ) : isSaved ? (
            t('waiterCall.saved')
          ) : (
            t('waiterCall.save')
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={!userId || isFetching || isSaving || isTesting || !webhookUrl.trim()}
          className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isTesting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('waiterCall.testing')}
            </>
          ) : (
            t('waiterCall.test')
          )}
        </button>
        {isFetching && <span className="text-xs text-slate-500">{t('waiterCall.loading')}</span>}
      </div>

      {testFeedback && <p className="mt-3 text-xs text-emerald-600 font-medium">{testFeedback}</p>}
      {error && <p className="mt-3 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseService';

interface Props {
  userId: string | null;
}

export const GoogleReviewsSettings: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('settings');
  const [placeId, setPlaceId] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !supabase) {
      setPlaceId('');
      return;
    }

    const fetchGooglePlaceId = async () => {
      setIsFetching(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('google_place_id')
        .eq('id', userId)
        .single();

      if (fetchError) {
        setError(fetchError.message || t('google.errors.fetchFailed'));
      } else {
        setPlaceId(data?.google_place_id || '');
      }

      setIsFetching(false);
    };

    fetchGooglePlaceId();
  }, [userId, t]);

  const handleSave = async () => {
    if (!userId || !supabase) return;

    setIsSaving(true);
    setError(null);
    setIsSaved(false);

    const normalizedPlaceId = placeId.trim() || null;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ google_place_id: normalizedPlaceId })
      .eq('id', userId);

    if (updateError) {
      setError(updateError.message || t('google.errors.saveFailed'));
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }

    setIsSaving(false);
  };

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
      <h3 className="text-xl font-black text-slate-900">{t('google.title')}</h3>
      <p className="mt-2 text-sm text-slate-500 max-w-3xl">{t('google.intro')}</p>

      <div className="mt-6 space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
          {t('google.placeIdLabel')}
        </label>
        <input
          type="text"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          placeholder={t('google.placeIdPlaceholder')}
          disabled={!userId || isFetching || isSaving}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!userId || isFetching || isSaving}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('google.saving')}
            </>
          ) : isSaved ? (
            t('google.saved')
          ) : (
            t('google.save')
          )}
        </button>

        {isFetching && <span className="text-xs text-slate-500">{t('google.loadingPlaceId')}</span>}
      </div>

      {error && <p className="mt-3 text-xs text-red-500 font-medium">{error}</p>}

      <a
        href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-5 text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2"
      >
        {t('google.findPlaceId')}
      </a>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquareText } from 'lucide-react';
import { supabase } from '../services/supabaseService';

interface Props {
  userId: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GuestFeedbackSettings: React.FC<Props> = ({ userId }) => {
  const [enabled, setEnabled] = useState(true);
  const [email, setEmail] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !supabase) {
      setEnabled(true);
      setEmail('');
      return;
    }

    const fetchSettings = async () => {
      setIsFetching(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('feedback_enabled, feedback_email')
        .eq('id', userId)
        .single();

      if (fetchError) {
        const missingColumn = /feedback_/i.test(fetchError.message || '');
        if (!missingColumn) {
          setError(fetchError.message || 'Nie udało się pobrać ustawień opinii.');
        }
      } else {
        setEnabled(data?.feedback_enabled !== false);
        setEmail(typeof data?.feedback_email === 'string' ? data.feedback_email : '');
      }

      setIsFetching(false);
    };

    fetchSettings();
  }, [userId]);

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError(null);
      return true;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Podaj prawidłowy adres e-mail.');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSave = async () => {
    if (!userId || !supabase) return;

    const normalizedEmail = email.trim();
    if (enabled && normalizedEmail && !validateEmail(normalizedEmail)) return;
    if (enabled && normalizedEmail && !EMAIL_RE.test(normalizedEmail)) return;

    setIsSaving(true);
    setError(null);
    setIsSaved(false);

    const payload = {
      feedback_enabled: enabled,
      feedback_email: normalizedEmail || null,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (updateError) {
      setError(
        updateError.message?.includes('feedback_')
          ? 'Uruchom migrację SQL: supabase/feedback_settings.sql'
          : updateError.message || 'Nie udało się zapisać ustawień.'
      );
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }

    setIsSaving(false);
  };

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <MessageSquareText size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black text-slate-900">Opinie i sugestie</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-3xl">
            Pozwól gościom wysyłać uwagi, skargi i sugestie bezpośrednio z Live Menu. Wiadomości trafią na
            Twój adres e-mail.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="text-sm font-bold text-slate-800 block">Włącz opinie gości</span>
            <span className="text-xs text-slate-500 mt-0.5 block">
              Sekcja na dole menu publicznego z formularzem wiadomości
            </span>
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
            Adres e-mail do otrzymywania opinii
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            onBlur={() => validateEmail(email)}
            placeholder="manager@restauracja.pl"
            disabled={!userId || isFetching || isSaving}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {emailError && <p className="text-xs text-red-500 font-medium">{emailError}</p>}
          {enabled && !email.trim() && (
            <p className="text-xs text-amber-700 font-medium">
              Uzupełnij e-mail, aby sekcja opinii była widoczna w Live Menu.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!userId || isFetching || isSaving || !!emailError}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Zapisywanie...
            </>
          ) : isSaved ? (
            'Zapisano ✓'
          ) : (
            'Zapisz'
          )}
        </button>
        {isFetching && <span className="text-xs text-slate-500">Ładowanie ustawień...</span>}
      </div>

      {error && <p className="mt-3 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};

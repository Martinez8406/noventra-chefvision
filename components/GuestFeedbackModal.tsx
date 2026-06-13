import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquareText, X } from 'lucide-react';

const MESSAGE_MAX = 1000;
const MESSAGE_MIN = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
}

export const GuestFeedbackModal: React.FC<Props> = ({ open, onClose, restaurantId }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setMessage('');
      setError(null);
      setSuccess(null);
      setBusy(false);
    }
  }, [open]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MESSAGE_MIN) {
      setError(`Wiadomość musi mieć co najmniej ${MESSAGE_MIN} znaków.`);
      return;
    }
    if (trimmedMessage.length > MESSAGE_MAX) {
      setError(`Wiadomość może mieć maksymalnie ${MESSAGE_MAX} znaków.`);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          message: trimmedMessage,
        }),
      });

      const raw = await response.text();
      let data: { error?: string; message?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        const serverError =
          typeof data?.error === 'string'
            ? data.error
            : response.status === 404
              ? 'Endpoint /api/feedback niedostępny — uruchom ponownie npm run dev (serwer API).'
              : `Nie udało się wysłać wiadomości (HTTP ${response.status}).`;
        setError(serverError);
        return;
      }

      const successMsg =
        typeof data?.message === 'string'
          ? data.message
          : 'Dziękujemy za wiadomość. Została przesłana do managera restauracji.';
      setSuccess(successMsg);
      resetForm();
      window.setTimeout(() => {
        onClose();
      }, 1800);
    } catch {
      setError('Błąd połączenia. Sprawdź internet i spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-feedback-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-chef-dark/75 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-label="Zamknij"
      />
      <div className="relative w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => !busy && onClose()}
          disabled={busy}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          aria-label="Zamknij"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-chef-gold/15 border border-chef-gold/30 flex items-center justify-center text-chef-gold shrink-0">
            <MessageSquareText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-chef-gold">Opinie gości</p>
            <h2 id="guest-feedback-title" className="text-xl font-black text-white tracking-tight">
              Wyślij wiadomość
            </h2>
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-emerald-300 leading-relaxed">{success}</p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                Imię (opcjonalnie)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Twoje imię"
                maxLength={120}
                disabled={busy}
                className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-chef-gold/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                E-mail (opcjonalnie)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adres e-mail"
                maxLength={254}
                disabled={busy}
                autoComplete="email"
                className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-chef-gold/50 disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Wiadomość *
                </label>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                placeholder="Napisz swoją wiadomość..."
                rows={5}
                required
                disabled={busy}
                className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-chef-gold/50 disabled:opacity-60 resize-y min-h-[120px]"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 font-medium" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => onClose()}
                disabled={busy}
                className="flex-1 py-3.5 rounded-2xl border border-white/15 text-sm font-bold text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 hover:from-chef-gold2 hover:to-chef-gold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  'Wyślij'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

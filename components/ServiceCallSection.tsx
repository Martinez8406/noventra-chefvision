import React, { useEffect, useState } from 'react';
import { Bell, Receipt, GlassWater, Loader2, Check, ChevronDown } from 'lucide-react';
import { PublicMenuLocale } from '../types';
import { tableStorageKey } from '../utils/publicMenuShare';

interface Props {
  restaurantId: string;
  /** Prefill z ?table= — opcjonalne przy jednym wspólnym QR */
  tableNumber?: string | null;
  primaryColor?: string;
  menuLocale?: PublicMenuLocale;
}

type ServiceAction = 'waiter' | 'bill' | 'order';

export const ServiceCallSection: React.FC<Props> = ({
  restaurantId,
  tableNumber: tableNumberProp = null,
  primaryColor = '#6366f1',
  menuLocale = 'pl',
}) => {
  const isPl = menuLocale === 'pl';
  const [open, setOpen] = useState(false);
  const [tableInput, setTableInput] = useState(tableNumberProp?.trim() || '');
  const [pending, setPending] = useState<ServiceAction | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tableNumberProp?.trim()) {
      setTableInput(tableNumberProp.trim());
      return;
    }
    try {
      const stored = sessionStorage.getItem(tableStorageKey(restaurantId));
      if (stored?.trim()) setTableInput(stored.trim());
    } catch {
      /* ignore */
    }
  }, [tableNumberProp, restaurantId]);

  const tableNumber = tableInput.trim();

  const labels = isPl
    ? {
        title: 'Potrzebujesz pomocy?',
        hint: 'Wezwij obsługę',
        tableLabel: 'Twój stolik',
        tablePlaceholder: 'wpisz numer',
        waiter: 'Wezwij kelnera',
        order: 'Dodatkowe zamówienie',
        bill: 'Prośba o rachunek',
        sending: 'Wysyłanie…',
        needTable: 'Najpierw wpisz numer stolika.',
        successWaiter: 'Prośba o kelnera została wysłana. Zaraz ktoś podejdzie.',
        successOrder: 'Prośba o dodatkowe zamówienie została wysłana. Zaraz ktoś podejdzie.',
        successBill: 'Prośba o rachunek została wysłana. Kelner zaraz podejdzie.',
        errorGeneric: 'Nie udało się wysłać prośby.',
        errorNetwork: 'Brak połączenia. Spróbuj ponownie.',
        errorRateLimit: 'Prośba została już wysłana. Poczekaj chwilę przed kolejną.',
        errorTooMany: 'Zbyt wiele próśb. Spróbuj ponownie później.',
      }
    : {
        title: 'Need assistance?',
        hint: 'Call a staff member',
        tableLabel: 'Your table',
        tablePlaceholder: 'enter number',
        waiter: 'Call waiter',
        order: 'Extra order',
        bill: 'Request the bill',
        sending: 'Sending…',
        needTable: 'Please enter your table number first.',
        successWaiter: 'Waiter request sent. Someone will be with you shortly.',
        successOrder: 'Extra order request sent. Someone will be with you shortly.',
        successBill: 'Bill request sent. A waiter will be with you shortly.',
        errorGeneric: 'Could not send the request.',
        errorNetwork: 'No connection. Please try again.',
        errorRateLimit: 'Request already sent. Please wait a moment before trying again.',
        errorTooMany: 'Too many requests. Please try again later.',
      };

  const successForAction = (action: ServiceAction) => {
    if (action === 'bill') return labels.successBill;
    if (action === 'order') return labels.successOrder;
    return labels.successWaiter;
  };

  const localizeError = (raw: string | undefined) => {
    if (!raw) return labels.errorGeneric;
    if (isPl) return raw;
    const lower = raw.toLowerCase();
    if (lower.includes('poczekaj chwilę') || lower.includes('już wysłana')) return labels.errorRateLimit;
    if (lower.includes('zbyt wiele')) return labels.errorTooMany;
    if (lower.includes('numer stolika') || lower.includes('brak numeru')) return labels.needTable;
    return labels.errorGeneric;
  };

  const sendRequest = async (action: ServiceAction) => {
    if (pending) return;
    if (!tableNumber) {
      setError(labels.needTable);
      return;
    }

    setPending(action);
    setError(null);
    setSuccess(null);

    try {
      sessionStorage.setItem(tableStorageKey(restaurantId), tableNumber);
    } catch {
      /* ignore */
    }

    try {
      const response = await fetch('/api/request-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          table: tableNumber,
          action,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(localizeError(typeof data?.error === 'string' ? data.error : undefined));
      } else {
        setSuccess(successForAction(action));
        window.setTimeout(() => setSuccess(null), 5000);
      }
    } catch {
      setError(labels.errorNetwork);
    }

    setPending(null);
  };

  return (
    <section className="w-full max-w-2xl mx-auto mb-2 px-2">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 shrink-0"
            style={{ backgroundColor: `${primaryColor}22`, color: primaryColor }}
          >
            <Bell size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white tracking-tight">{labels.title}</p>
            {!open && <p className="text-xs text-zinc-300 mt-0.5">{labels.hint}</p>}
          </div>
          <ChevronDown
            size={18}
            className={`text-zinc-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                {labels.tableLabel}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={tableInput}
                onChange={(e) => {
                  setTableInput(e.target.value);
                  setError(null);
                }}
                placeholder={labels.tablePlaceholder}
                className="w-full max-w-[180px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-chef-gold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={!!pending}
                onClick={() => void sendRequest('waiter')}
                className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 hover:from-chef-gold2 hover:to-chef-gold transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {pending === 'waiter' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bell size={16} />
                )}
                {pending === 'waiter' ? labels.sending : labels.waiter}
              </button>
              <button
                type="button"
                disabled={!!pending}
                onClick={() => void sendRequest('order')}
                className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wide text-white border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {pending === 'order' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GlassWater size={16} />
                )}
                {pending === 'order' ? labels.sending : labels.order}
              </button>
              <button
                type="button"
                disabled={!!pending}
                onClick={() => void sendRequest('bill')}
                className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wide text-white border border-white/20 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {pending === 'bill' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Receipt size={16} />
                )}
                {pending === 'bill' ? labels.sending : labels.bill}
              </button>
            </div>

            {success && (
              <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
                <Check size={16} />
                {success}
              </p>
            )}
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
};

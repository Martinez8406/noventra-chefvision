import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Play, ExternalLink } from 'lucide-react';
import type { MenuServiceOrder, MenuServiceStatus } from '../types';
import { menuServiceDb } from '../services/supabaseService';
import { buildPublicMenuUrl } from '../utils/publicMenuShare';

interface Props {
  onManageClient: (order: MenuServiceOrder) => void;
}

const STATUS_LABEL: Record<MenuServiceStatus, string> = {
  paid: 'Opłacone — do zrobienia',
  in_progress: 'W trakcie',
  done: 'Gotowe',
  cancelled: 'Anulowane',
};

const STATUS_CLASS: Record<MenuServiceStatus, string> = {
  paid: 'bg-amber-50 text-amber-800 border-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const AdminMenuOrdersPanel: React.FC<Props> = ({ onManageClient }) => {
  const [orders, setOrders] = useState<MenuServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await menuServiceDb.listOrders();
      setOrders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać zleceń.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setStatus = async (order: MenuServiceOrder, status: MenuServiceStatus) => {
    setBusyId(order.id);
    const ok = await menuServiceDb.updateOrderStatus(order.id, status);
    setBusyId(null);
    if (!ok) {
      alert('Nie udało się zmienić statusu zlecenia.');
      return;
    }
    await reload();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <ClipboardList size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Zlecenia menu</h2>
          <p className="mt-1 text-sm text-slate-600">
            Klienci, którzy opłacili wykonanie cyfrowego menu. Wejdź w konto i edytuj ich kartę jak własne.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
          <Loader2 className="animate-spin" size={20} />
          Ładowanie zleceń…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>
      ) : orders.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="font-bold text-slate-800">Brak zleceń</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Gdy klient kupi „Zleć wykonanie menu” na stronie cennika, pojawi się tutaj po potwierdzeniu Stripe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const busy = busyId === order.id;
            const canEdit = order.status !== 'cancelled';
            return (
              <li
                key={order.id}
                className="rounded-[22px] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900 truncate">{order.clientName}</p>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_CLASS[order.status]}`}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{order.clientEmail || order.clientUserId}</p>
                    <p className="text-xs text-slate-400">
                      Opłacono:{' '}
                      {order.paidAt
                        ? new Date(order.paidAt).toLocaleString('pl-PL')
                        : new Date(order.createdAt).toLocaleString('pl-PL')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={buildPublicMenuUrl(order.clientUserId)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
                    >
                      <ExternalLink size={14} />
                      Live menu
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onManageClient(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
                      >
                        Edytuj menu
                      </button>
                    )}
                    {order.status === 'paid' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(order, 'in_progress')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 disabled:opacity-60"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Start
                      </button>
                    )}
                    {(order.status === 'paid' || order.status === 'in_progress') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(order, 'done')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Gotowe
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

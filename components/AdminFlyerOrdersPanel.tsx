import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileImage, Loader2, Play } from 'lucide-react';
import type { FlyerServiceOrder, FlyerServiceStatus } from '../types';
import { flyerServiceDb } from '../services/supabaseService';

const STATUS_LABEL: Record<FlyerServiceStatus, string> = {
  pending: 'Oczekuje — oferta wdrożeniowa',
  paid: 'Opłacone — do zrobienia',
  in_progress: 'W trakcie',
  done: 'Gotowe',
  cancelled: 'Anulowane',
};

const STATUS_CLASS: Record<FlyerServiceStatus, string> = {
  pending: 'bg-slate-50 text-slate-700 border-slate-200',
  paid: 'bg-amber-50 text-amber-800 border-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const AdminFlyerOrdersPanel: React.FC = () => {
  const [orders, setOrders] = useState<FlyerServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await flyerServiceDb.listOrders();
      setOrders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać zleceń ulotek.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setStatus = async (order: FlyerServiceOrder, status: FlyerServiceStatus) => {
    setBusyId(order.id);
    const ok = await flyerServiceDb.updateOrderStatus(order.id, status);
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
        <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <FileImage size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Zlecenia ulotek QR</h2>
          <p className="mt-1 text-sm text-slate-600">
            Klienci, którzy opłacili projekt ulotki QR. Zmieniaj status realizacji po wysłaniu wariantów.
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
          <p className="font-bold text-slate-800">Brak zleceń ulotek</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Gdy klient kupi „Ulotka QR” w cenniku, pojawi się tutaj po potwierdzeniu Stripe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const busy = busyId === order.id;
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
                    {(order.status === 'paid' || order.status === 'pending') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(order, 'in_progress')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 text-white px-3 py-2 text-xs font-black disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Start
                      </button>
                    )}
                    {(order.status === 'paid' || order.status === 'pending' || order.status === 'in_progress') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(order, 'done')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-black disabled:opacity-50"
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

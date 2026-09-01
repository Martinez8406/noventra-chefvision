import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Play, ExternalLink, UserPlus } from 'lucide-react';
import type { MenuServiceOrder, MenuServiceStatus } from '../types';
import { menuServiceDb, supabase } from '../services/supabaseService';
import { buildPublicMenuUrl } from '../utils/publicMenuShare';

interface Props {
  onManageClient: (order: MenuServiceOrder) => void;
}

const STATUS_LABEL: Record<MenuServiceStatus, string> = {
  pending: 'Oczekuje — oferta wdrożeniowa',
  paid: 'Opłacone — do zrobienia',
  in_progress: 'W trakcie',
  done: 'Gotowe',
  cancelled: 'Anulowane',
};

const STATUS_CLASS: Record<MenuServiceStatus, string> = {
  pending: 'bg-slate-50 text-slate-700 border-slate-200',
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
  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdClient, setCreatedClient] = useState<{
    userId: string;
    email: string;
    restaurantName: string;
    orderId: string | null;
    orderStatus: MenuServiceStatus;
    created: boolean;
    inviteSent: boolean;
    alreadyHadOrders: boolean;
  } | null>(null);

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

  const createClientAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatedClient(null);
    setCreating(true);
    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData?.session?.access_token;
      if (!token) {
        setFormError('Brak sesji. Zaloguj się ponownie.');
        return;
      }
      const response = await fetch('/api/create-client-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          restaurantName: restaurantName.trim() || undefined,
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(data?.error || 'Nie udało się założyć konta.');
        return;
      }
      setCreatedClient({
        userId: data.userId,
        email: data.email,
        restaurantName: data.restaurantName || data.email,
        orderId: data.orderId || null,
        orderStatus: (data.orderStatus as MenuServiceStatus) || 'pending',
        created: Boolean(data.created),
        inviteSent: Boolean(data.inviteSent),
        alreadyHadOrders: Boolean(data.alreadyHadOrders),
      });
      setEmail('');
      setRestaurantName('');
      setFormOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Nie udało się założyć konta.');
    } finally {
      setCreating(false);
    }
  };

  const openCreatedClient = () => {
    if (!createdClient) return;
    onManageClient({
      id: createdClient.orderId || createdClient.userId,
      clientUserId: createdClient.userId,
      clientName: createdClient.restaurantName,
      clientEmail: createdClient.email,
      status: createdClient.orderStatus,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
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
        <button
          type="button"
          onClick={() => {
            setFormOpen((open) => !open);
            setFormError(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shrink-0"
        >
          <UserPlus size={15} />
          Załóż konto dla klienta
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={(e) => void createClientAccount(e)}
          className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div>
            <p className="font-black text-slate-900">Nowe konto klienta</p>
            <p className="mt-1 text-sm text-slate-500">
              Podaj e-mail lokalu. Konto powstanie od razu, klient dostanie magic link, a Ty możesz od razu złożyć menu.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail klienta</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lokal@restauracja.pl"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nazwa restauracji (opcjonalnie)</span>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="np. Bistro Centrum"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
            </label>
          </div>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{formError}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={creating || !email.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Utwórz konto i zlecenie
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setFormOpen(false);
                setFormError(null);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {createdClient && (
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="font-black text-emerald-950">
              {createdClient.created ? 'Konto założone' : 'Konto już istniało — zlecenie podpięte'}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {createdClient.email}
              {createdClient.inviteSent
                ? ' · wysłaliśmy zaproszenie (magic link). Sprawdź też folder SPAM.'
                : createdClient.created
                  ? ' · zaproszenie nie poszło automatycznie — klient zaloguje się tym samym e-mailem przez magic link.'
                  : createdClient.alreadyHadOrders
                    ? ' · to konto miało już aktywne zlecenie.'
                    : ' · możesz od razu edytować menu.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreatedClient}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 shrink-0"
          >
            Edytuj menu
          </button>
        </div>
      )}

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
            Gdy klient kupi „Zleć wykonanie menu”, albo założysz konto przyciskiem powyżej, pojawi się tutaj.
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
                    {(order.status === 'paid' || order.status === 'pending') && (
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
                    {(order.status === 'paid' || order.status === 'pending' || order.status === 'in_progress') && (
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

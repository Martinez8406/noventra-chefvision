import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, ExternalLink, Loader2, Search, Users } from 'lucide-react';
import type { AdminClientProfile } from '../types';
import { adminClientsDb } from '../services/supabaseService';
import { buildPublicMenuUrl } from '../utils/publicMenuShare';

interface Props {
  onOpenClient: (client: AdminClientProfile) => void;
}

export const AdminPremiumClientsPanel: React.FC<Props> = ({ onOpenClient }) => {
  const [clients, setClients] = useState<AdminClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await adminClientsDb.listPremiumClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać klientów Premium.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 border-t border-slate-200">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Users size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Klienci Premium</h2>
          <p className="mt-1 text-sm text-slate-600">
            Wejdź w konto Premium, żeby podłączyć Discord (Kelner / rachunek) — bez zlecenia edycji menu.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie lub e-mailu…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
          <Loader2 className="animate-spin" size={20} />
          Ładowanie klientów…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="font-bold text-slate-800">Brak klientów Premium</p>
          <p className="mt-2 text-sm text-slate-500">
            {query
              ? 'Żaden wynik nie pasuje do wyszukiwania.'
              : 'Gdy ktoś kupi Premium, pojawi się tutaj. Uruchom też migrację SQL admin_staff_profiles_access.sql.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((client) => (
            <li
              key={client.id}
              className="rounded-[22px] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-900 truncate">{client.name}</p>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      Premium
                    </span>
                    {client.waiterConfigured ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-800">
                        <BellRing size={10} /> Kelner OK
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                        Kelner do podłączenia
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{client.email || client.id}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={buildPublicMenuUrl(client.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
                  >
                    <ExternalLink size={14} />
                    Live menu
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenClient(client)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800"
                  >
                    Otwórz konto
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

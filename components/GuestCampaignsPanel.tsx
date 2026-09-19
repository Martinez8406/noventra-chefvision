import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import {
  GUEST_CAMPAIGN_CTA_PRESETS,
  GUEST_CAMPAIGN_TEMPLATES,
  getGuestCampaignTemplate,
} from '../lib/guestCampaignTemplates.js';
import { CampaignEmailPreview } from './CampaignEmailPreview';

interface Props {
  userId: string;
  mode: 'create' | 'history';
}

type DishLite = { id: string; name: string; imageUrl: string; description: string };
type CampaignRow = {
  id: string;
  name: string;
  templateType: string;
  subject: string;
  status: string;
  recipientCount: number;
  createdAt: string;
  sentAt: string | null;
};

type Draft = {
  templateType: string;
  name: string;
  subject: string;
  headline: string;
  message: string;
  offerText: string;
  validFrom: string;
  validUntil: string;
  dishId: string;
  ctaLabel: string;
  ctaCustom: string;
};

async function ownerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!supabase) return headers;
  await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function statusLabel(status: string) {
  if (status === 'sent') return 'Wysłana';
  if (status === 'sending') return 'Wysyłanie';
  if (status === 'failed') return 'Nieudana';
  if (status === 'draft') return 'Szkic';
  return status;
}

function emptyDraft(templateType: string): Draft {
  const tpl = getGuestCampaignTemplate(templateType) || GUEST_CAMPAIGN_TEMPLATES[0];
  return {
    templateType: tpl.id,
    name: tpl.defaultName,
    subject: tpl.defaultSubject,
    headline: tpl.defaultHeadline,
    message: tpl.defaultMessage,
    offerText: '',
    validFrom: '',
    validUntil: '',
    dishId: '',
    ctaLabel: tpl.defaultCta,
    ctaCustom: '',
  };
}

export const GuestCampaignsPanel: React.FC<Props> = ({ userId, mode }) => {
  const [dishes, setDishes] = useState<DishLite[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [history, setHistory] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<'templates' | 'edit' | 'preview'>('templates');
  const [draft, setDraft] = useState<Draft>(emptyDraft('club_offer'));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewNarrow, setPreviewNarrow] = useState(true);
  const [restaurantName, setRestaurantName] = useState('Restauracja');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const qs = `targetUserId=${encodeURIComponent(userId)}`;

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await ownerHeaders();
      const [dishRes, countRes, histRes] = await Promise.all([
        fetch(`/api/promo-codes?op=campaign-dishes&${qs}`, { headers }),
        fetch(`/api/promo-codes?op=campaign-recipients&${qs}`, { headers }),
        fetch(`/api/promo-codes?op=campaigns&${qs}`, { headers }),
      ]);
      const dishData = await dishRes.json().catch(() => null);
      const countData = await countRes.json().catch(() => null);
      const histData = await histRes.json().catch(() => null);
      if (!dishRes.ok) throw new Error(dishData?.error || 'Nie udało się pobrać dań.');
      if (!countRes.ok) throw new Error(countData?.error || 'Nie udało się policzyć odbiorców.');
      if (!histRes.ok) throw new Error(histData?.error || 'Nie udało się pobrać historii.');
      setDishes(Array.isArray(dishData?.dishes) ? dishData.dishes : []);
      setConfirmedCount(Number(countData?.confirmedCount || 0));
      setHistory(Array.isArray(histData?.campaigns) ? histData.campaigns : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać kampanii.');
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from('profiles')
      .select('restaurant_name, logo_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.restaurant_name) setRestaurantName(data.restaurant_name);
        if (data?.logo_url) setLogoUrl(data.logo_url);
      });
  }, [userId]);

  const selectedDish = useMemo(
    () => dishes.find((d) => d.id === draft.dishId) || null,
    [dishes, draft.dishId]
  );
  const ctaLabel = draft.ctaLabel === '__custom' ? draft.ctaCustom.trim() : draft.ctaLabel;
  const validLabel = [draft.validFrom.trim(), draft.validUntil.trim()].filter(Boolean).join(' – ');

  const openTemplate = (id: string) => {
    setDraft(emptyDraft(id));
    setStep('edit');
    setNotice(null);
    setError(null);
  };

  const sendCampaign = async () => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await ownerHeaders();
      const response = await fetch(`/api/promo-codes?op=campaigns&${qs}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetUserId: userId,
          templateType: draft.templateType,
          name: draft.name,
          subject: draft.subject,
          headline: draft.headline,
          message: draft.message,
          offerText: draft.offerText,
          validFrom: draft.validFrom,
          validUntil: draft.validUntil,
          dishId: draft.dishId || null,
          ctaLabel: ctaLabel || 'Zobacz w menu',
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setConfirmOpen(false);
      setNotice(`Wysłano do ${data?.sent || 0} osób.`);
      setStep('templates');
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać kampanii.');
    } finally {
      setSending(false);
    }
  };

  if (mode === 'history') {
    return (
      <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Historia wysyłek</h3>
            <p className="text-sm text-slate-500">Ostatnie kampanie tego lokalu. Bez statystyk otwarć — to przyjdzie później.</p>
          </div>
          <button type="button" onClick={() => void loadMeta()} className="text-sm font-bold text-slate-500">
            Odśwież
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="animate-spin" size={16} /> Ładowanie historii…
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">Nie wysłano jeszcze żadnej kampanii.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2 pr-3">Kampania</th>
                  <th className="py-2 pr-3">Szablon</th>
                  <th className="py-2 pr-3">Temat</th>
                  <th className="py-2 pr-3">Utworzono</th>
                  <th className="py-2 pr-3">Wysłano</th>
                  <th className="py-2 pr-3">Odbiorcy</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const tpl = getGuestCampaignTemplate(row.templateType);
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="py-3 pr-3 font-semibold text-slate-900">{row.name}</td>
                      <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">{tpl ? `${tpl.icon} ${tpl.name}` : row.templateType}</td>
                      <td className="py-3 pr-3 text-slate-600">{row.subject}</td>
                      <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{formatDate(row.sentAt)}</td>
                      <td className="py-3 pr-3 font-bold">{row.recipientCount}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-lg text-[11px] font-black uppercase ${
                            row.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.status === 'failed'
                                ? 'bg-red-50 text-red-600'
                                : row.status === 'sending'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>}
      {notice && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">{notice}</p>}

      {step === 'templates' && (
        <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-5">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Przyciągnij gości ponownie</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Wybierz gotową kampanię, dostosuj ofertę i wyślij ją do potwierdzonych członków Klubu gości Premium.
            </p>
            <p className="text-sm font-semibold text-slate-700 mt-3">Odbiorcy: {confirmedCount} potwierdzonych kontaktów</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {GUEST_CAMPAIGN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => openTemplate(tpl.id)}
                className="text-left rounded-[28px] border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-chef-gold/40 hover:shadow-md transition-all p-5 space-y-2"
              >
                <span className="text-2xl">{tpl.icon}</span>
                <p className="font-black text-slate-900">{tpl.name}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{tpl.purpose}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'edit' && (
        <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-chef-gold">
                {getGuestCampaignTemplate(draft.templateType)?.icon} {getGuestCampaignTemplate(draft.templateType)?.name}
              </p>
              <h3 className="text-xl font-black text-slate-900 mt-1">Dostosuj kampanię</h3>
              <p className="text-sm text-slate-500 mt-1">Odbiorcy: {confirmedCount} potwierdzonych kontaktów</p>
            </div>
            <button type="button" onClick={() => setStep('templates')} className="text-sm font-bold text-slate-500">
              Wróć
            </button>
          </div>
          <div className="grid gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Nazwa kampanii (tylko dla Ciebie)</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Temat e-maila</span>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Nagłówek</span>
              <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Wiadomość</span>
              <textarea value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
              <span className="text-xs text-slate-400">Możesz użyć {'{first_name}'} — wstawi imię gościa.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Oferta (opcjonalnie)</span>
              <input value={draft.offerText} onChange={(e) => setDraft({ ...draft, offerText: e.target.value })} placeholder="-20% na burgery" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Od (opcjonalnie)</span>
                <input value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} placeholder="19 września" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Do (opcjonalnie)</span>
                <input value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} placeholder="21 września" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-chef-gold/15" />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Danie z menu (opcjonalnie)</span>
              <select
                value={draft.dishId}
                onChange={(e) => {
                  const id = e.target.value;
                  const dish = dishes.find((d) => d.id === id);
                  setDraft({
                    ...draft,
                    dishId: id,
                    ctaLabel: id ? 'Zobacz danie' : draft.ctaLabel,
                    headline: dish && !draft.headline ? dish.name : draft.headline,
                  });
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none bg-white"
              >
                <option value="">Bez dania — link do Live Menu</option>
                {dishes.map((dish) => (
                  <option key={dish.id} value={dish.id}>
                    {dish.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedDish && (
              <div className="flex gap-3 items-center rounded-2xl border border-slate-100 p-3">
                {selectedDish.imageUrl ? (
                  <img src={selectedDish.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-100" />
                )}
                <div>
                  <p className="font-bold text-slate-900">{selectedDish.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{selectedDish.description}</p>
                </div>
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Przycisk</span>
              <select value={draft.ctaLabel} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none bg-white">
                {GUEST_CAMPAIGN_CTA_PRESETS.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
                <option value="__custom">Własny tekst…</option>
              </select>
            </label>
            {draft.ctaLabel === '__custom' && (
              <input value={draft.ctaCustom} onChange={(e) => setDraft({ ...draft, ctaCustom: e.target.value })} placeholder="Tekst przycisku" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
            )}
          </div>
          <button
            type="button"
            disabled={!draft.name.trim() || !draft.subject.trim() || !draft.headline.trim() || confirmedCount < 1}
            onClick={() => setStep('preview')}
            className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
          >
            Podgląd kampanii
          </button>
          {confirmedCount < 1 && <p className="text-sm text-amber-700">Najpierw potrzebujesz potwierdzonego kontaktu w Klubie.</p>}
        </section>
      )}

      {step === 'preview' && (
        <section className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">Podgląd kampanii</h3>
              <p className="text-sm text-slate-500 mt-1">Odbiorcy: {confirmedCount} potwierdzonych kontaktów</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreviewNarrow(true)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-xl ${previewNarrow ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Telefon
              </button>
              <button type="button" onClick={() => setPreviewNarrow(false)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-xl ${!previewNarrow ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Desktop
              </button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-[28px] p-4 overflow-x-auto">
            <CampaignEmailPreview
              restaurantName={restaurantName}
              logoUrl={logoUrl}
              firstName="Ania"
              headline={draft.headline}
              message={draft.message}
              offerText={draft.offerText}
              validLabel={validLabel}
              dish={selectedDish}
              ctaLabel={ctaLabel}
              compact={previewNarrow}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => setStep('edit')} className="px-5 py-3 rounded-2xl border border-slate-200 text-sm font-black text-slate-700">
              Wróć do edycji
            </button>
            <button
              type="button"
              disabled={confirmedCount < 1}
              onClick={() => setConfirmOpen(true)}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
            >
              Wyślij kampanię
            </button>
          </div>
        </section>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 space-y-4">
            <h3 className="text-xl font-black text-slate-900">Potwierdź wysyłkę</h3>
            <p className="text-sm text-slate-600">Wyślesz tę kampanię do {confirmedCount} potwierdzonych kontaktów. Lista jest brana z bazy w momencie wysyłki — wypisani nie dostaną maila.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} className="px-5 py-3 rounded-2xl border border-slate-200 text-sm font-black">
                Anuluj
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendCampaign()}
                className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="animate-spin" size={16} /> : null}
                {sending ? 'Wysyłam…' : `Wyślij do ${confirmedCount} osób`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

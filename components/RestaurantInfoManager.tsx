import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Clock,
  Info,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  ImagePlus,
  Phone,
  Sparkles,
} from 'lucide-react';
import type {
  RestaurantHoursException,
  RestaurantInfoContent,
  RestaurantInfoEvent,
  RestaurantInfoWeekday,
} from '../types';
import { restaurantInfoDb } from '../services/restaurantInfoService';
import { compressImageForUpload } from '../services/imageService';
import { emptyRestaurantInfoContent, RESTAURANT_INFO_WEEKDAYS, weekdayLabel } from '../utils/restaurantInfo';

interface Props {
  userId: string | null;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400/40';

export const RestaurantInfoManager: React.FC<Props> = ({ userId }) => {
  const { t, i18n } = useTranslation('restaurantInfo');
  const locale = i18n.language?.startsWith('en') ? 'en' : 'pl';
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState<RestaurantInfoContent>(emptyRestaurantInfoContent());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const data = await restaurantInfoDb.get(userId);
    setEnabled(data.enabled);
    setContent(data.content);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = <K extends keyof RestaurantInfoContent>(key: K, value: RestaurantInfoContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleEnabled = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const next = !enabled;
    const ok = await restaurantInfoDb.setEnabled(userId, next);
    if (!ok && next) {
      setError(t('planRequired'));
      setSaving(false);
      return;
    }
    if (!ok) {
      setError(t('sqlHint'));
      setSaving(false);
      return;
    }
    setEnabled(next);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const ok = await restaurantInfoDb.saveContent(userId, content);
    setSaving(false);
    if (!ok) {
      setError(t('sqlHint'));
      return;
    }
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleHeroFile = async (file: File | null) => {
    if (!userId || !file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      const url = await restaurantInfoDb.uploadImage(userId, dataUrl);
      patch('about', { ...content.about, heroImageUrl: url });
    } catch {
      setError(t('imageUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  if (!userId) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-100 p-8 text-center text-slate-500">
        {t('loginRequired')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-chef-gold" size={40} />
      </div>
    );
  }

  const blockCard = (
    label: string,
    icon: React.ReactNode,
    children: React.ReactNode,
  ) => (
    <section className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-black text-slate-900 inline-flex items-center gap-2">
          {icon}
          {label}
        </h3>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </section>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
          <Info className="text-chef-gold" size={32} />
          {t('title')}
        </h2>
        <p className="text-slate-500 text-sm mt-2 max-w-xl">{t('intro')}</p>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8">
        <label className="flex items-start gap-4 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => void handleToggleEnabled()}
            disabled={saving}
            className="mt-1 w-5 h-5 rounded border-slate-300 text-chef-gold focus:ring-chef-gold"
          />
          <div>
            <span className="font-black text-slate-900">{t('enableLabel')}</span>
            <p className="text-sm text-slate-500 mt-1">{t('enableHelp')}</p>
          </div>
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">{error}</div>
      )}

      {blockCard(
            t('blocks.about'),
            <Sparkles size={18} className="text-emerald-500" />,
            <>
              <label className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">
                {t('about.description')}
              </label>
              <textarea
                rows={3}
                className={inputClass}
                placeholder={t('about.descriptionPlaceholder')}
                value={content.about.description}
                onChange={(e) => patch('about', { ...content.about, description: e.target.value })}
              />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">{t('about.hero')}</p>
                {content.about.heroImageUrl ? (
                  <img
                    src={content.about.heroImageUrl}
                    alt=""
                    className="h-36 w-full object-cover rounded-2xl border border-slate-100 mb-3"
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    {content.about.heroImageUrl ? t('about.changeHero') : t('about.addHero')}
                  </button>
                  {content.about.heroImageUrl && (
                    <button
                      type="button"
                      onClick={() => patch('about', { ...content.about, heroImageUrl: null })}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-red-600"
                    >
                      {t('about.removeHero')}
                    </button>
                  )}
                </div>
                <input
                  ref={heroInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = '';
                    void handleHeroFile(file);
                  }}
                />
              </div>
            </>,
          )}

          {blockCard(
            t('blocks.hours'),
            <Clock size={18} className="text-emerald-500" />,
            <>
              <div className="space-y-2">
                {RESTAURANT_INFO_WEEKDAYS.map((day: RestaurantInfoWeekday) => {
                  const row = content.hours.weekly[day];
                  return (
                    <div key={day} className="grid grid-cols-1 sm:grid-cols-[8rem_auto_1fr_1fr] gap-2 items-center">
                      <span className="text-sm font-bold text-slate-800">{weekdayLabel(day, locale)}</span>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                        <input
                          type="checkbox"
                          checked={row.closed}
                          onChange={(e) =>
                            patch('hours', {
                              ...content.hours,
                              weekly: { ...content.hours.weekly, [day]: { ...row, closed: e.target.checked } },
                            })
                          }
                        />
                        {t('hours.closed')}
                      </label>
                      <input
                        type="time"
                        disabled={row.closed}
                        className={inputClass}
                        value={row.from}
                        onChange={(e) =>
                          patch('hours', {
                            ...content.hours,
                            weekly: { ...content.hours.weekly, [day]: { ...row, from: e.target.value } },
                          })
                        }
                      />
                      <input
                        type="time"
                        disabled={row.closed}
                        className={inputClass}
                        value={row.to}
                        onChange={(e) =>
                          patch('hours', {
                            ...content.hours,
                            weekly: { ...content.hours.weekly, [day]: { ...row, to: e.target.value } },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <div className="pt-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">{t('hours.exceptions')}</p>
                <div className="space-y-2">
                  {content.hours.exceptions.map((item) => (
                    <div key={item.id} className="flex flex-wrap gap-2 items-center">
                      <input
                        type="date"
                        className={inputClass + ' sm:w-40'}
                        value={item.date}
                        onChange={(e) =>
                          patch('hours', {
                            ...content.hours,
                            exceptions: content.hours.exceptions.map((ex) =>
                              ex.id === item.id ? { ...ex, date: e.target.value } : ex,
                            ),
                          })
                        }
                      />
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                        <input
                          type="checkbox"
                          checked={item.closed}
                          onChange={(e) =>
                            patch('hours', {
                              ...content.hours,
                              exceptions: content.hours.exceptions.map((ex) =>
                                ex.id === item.id ? { ...ex, closed: e.target.checked } : ex,
                              ),
                            })
                          }
                        />
                        {t('hours.closed')}
                      </label>
                      <input
                        className={inputClass + ' flex-1 min-w-[10rem]'}
                        placeholder={t('hours.exceptionNote')}
                        value={item.note}
                        onChange={(e) =>
                          patch('hours', {
                            ...content.hours,
                            exceptions: content.hours.exceptions.map((ex) =>
                              ex.id === item.id ? { ...ex, note: e.target.value } : ex,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch('hours', {
                            ...content.hours,
                            exceptions: content.hours.exceptions.filter((ex) => ex.id !== item.id),
                          })
                        }
                        className="p-2 text-slate-400 hover:text-red-600"
                        aria-label={t('hours.removeException')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next: RestaurantHoursException = {
                      id: `ex-${Date.now()}`,
                      date: '',
                      note: '',
                      closed: true,
                    };
                    patch('hours', { ...content.hours, exceptions: [...content.hours.exceptions, next] });
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700"
                >
                  <Plus size={16} />
                  {t('hours.addException')}
                </button>
              </div>
            </>,
          )}

          {blockCard(
            t('blocks.contact'),
            <Phone size={18} className="text-emerald-500" />,
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder={t('contact.phone')}
                value={content.contact.phone}
                onChange={(e) => patch('contact', { ...content.contact, phone: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder={t('contact.email')}
                value={content.contact.email}
                onChange={(e) => patch('contact', { ...content.contact, email: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder={t('contact.reservationUrl')}
                value={content.contact.reservationUrl}
                onChange={(e) => patch('contact', { ...content.contact, reservationUrl: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder={t('contact.instagram')}
                value={content.contact.instagram}
                onChange={(e) => patch('contact', { ...content.contact, instagram: e.target.value })}
              />
            </div>,
          )}

          {blockCard(
            t('blocks.access'),
            <MapPin size={18} className="text-emerald-500" />,
            <div className="space-y-3">
              <input
                className={inputClass}
                placeholder={t('access.address')}
                value={content.access.address}
                onChange={(e) => patch('access', { ...content.access, address: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder={t('access.mapsUrl')}
                value={content.access.mapsUrl}
                onChange={(e) => patch('access', { ...content.access, mapsUrl: e.target.value })}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder={t('access.parkingPlaceholder')}
                value={content.access.parking}
                onChange={(e) => patch('access', { ...content.access, parking: e.target.value })}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder={t('access.directionsPlaceholder')}
                value={content.access.directions}
                onChange={(e) => patch('access', { ...content.access, directions: e.target.value })}
              />
            </div>,
          )}

          {blockCard(
            t('blocks.events'),
            <CalendarDays size={18} className="text-emerald-500" />,
            <>
              {content.events.items.length === 0 ? (
                <p className="text-sm text-slate-500">{t('events.empty')}</p>
              ) : (
                <div className="space-y-4">
                  {content.events.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 p-4 space-y-2">
                      <div className="grid sm:grid-cols-[1fr_10rem_auto] gap-2">
                        <input
                          className={inputClass}
                          placeholder={t('events.title')}
                          value={item.title}
                          onChange={(e) =>
                            patch('events', {
                              ...content.events,
                              items: content.events.items.map((ev) =>
                                ev.id === item.id ? { ...ev, title: e.target.value } : ev,
                              ),
                            })
                          }
                        />
                        <input
                          type="date"
                          className={inputClass}
                          value={item.date}
                          onChange={(e) =>
                            patch('events', {
                              ...content.events,
                              items: content.events.items.map((ev) =>
                                ev.id === item.id ? { ...ev, date: e.target.value } : ev,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            patch('events', {
                              ...content.events,
                              items: content.events.items.filter((ev) => ev.id !== item.id),
                            })
                          }
                          className="p-2 text-slate-400 hover:text-red-600"
                          aria-label={t('events.remove')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        className={inputClass}
                        placeholder={t('events.description')}
                        value={item.description}
                        onChange={(e) =>
                          patch('events', {
                            ...content.events,
                            items: content.events.items.map((ev) =>
                              ev.id === item.id ? { ...ev, description: e.target.value } : ev,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const next: RestaurantInfoEvent = {
                    id: `ev-${Date.now()}`,
                    title: '',
                    date: '',
                    description: '',
                  };
                  patch('events', { ...content.events, items: [...content.events.items, next] });
                }}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700"
              >
                <Plus size={16} />
                {t('events.add')}
              </button>
            </>,
          )}

          {blockCard(
            t('blocks.extras'),
            <Info size={18} className="text-emerald-500" />,
            <div className="space-y-3">
              <textarea
                rows={2}
                className={inputClass}
                placeholder={t('extras.dressCode')}
                value={content.extras.dressCode}
                onChange={(e) => patch('extras', { ...content.extras, dressCode: e.target.value })}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder={t('extras.allergies')}
                value={content.extras.allergies}
                onChange={(e) => patch('extras', { ...content.extras, allergies: e.target.value })}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder={t('extras.privateDining')}
                value={content.extras.privateDining}
                onChange={(e) => patch('extras', { ...content.extras, privateDining: e.target.value })}
              />
            </div>,
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t('saving') : t('save')}
            </button>
            {savedFlash && <span className="text-sm font-bold text-emerald-600">{t('saved')}</span>}
          </div>
    </div>
  );
};

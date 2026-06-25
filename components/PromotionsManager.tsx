import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dish, DishRecommendation, DishRecommendationItem, DishRecommendationType } from '../types';
import {
  calcSavingsPercent,
  createPolecaneItems,
  fetchRecommendationsForOwner,
  normalizePolecaneItems,
  persistRecommendations,
  POLECANE_SLOTS,
} from '../utils/dishRecommendations';
import {
  DEFAULT_RECOMMENDATION_CURRENCY,
  RECOMMENDATION_CURRENCY_CODES,
  resolveRecommendationCurrency,
} from '../utils/recommendationCurrency';
import { RecommendationCurrency } from '../types';
import { ChevronDown, Gift, Plus, Trash2, Megaphone, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  dishes: Dish[];
  userId: string | null;
  onRecommendationsChange?: (recommendations: DishRecommendation[]) => void;
}

const TYPE_OPTION_VALUES: DishRecommendationType[] = ['polecane', 'popularne', 'zestaw'];

const TYPE_OPTION_ICONS: Record<DishRecommendationType, string | undefined> = {
  polecane: undefined,
  popularne: '🔥',
  zestaw: 'gift',
};

function newItem(): DishRecommendationItem {
  return { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: '' };
}

function newRecommendation(dishId: string, type: DishRecommendationType): DishRecommendation {
  return {
    id: `rec-${Date.now()}`,
    dishId,
    type,
    isActive: true,
    items:
      type === 'zestaw'
        ? [newItem(), newItem(), newItem()]
        : type === 'polecane'
          ? createPolecaneItems()
          : [newItem()],
    bundlePriceOutside: type === 'zestaw' ? '' : undefined,
    bundlePrice: type === 'zestaw' ? '' : undefined,
    currency: DEFAULT_RECOMMENDATION_CURRENCY,
  };
}

export const PromotionsManager: React.FC<Props> = ({ dishes, userId, onRecommendationsChange }) => {
  const { t } = useTranslation('promotions');
  const onlineDishes = useMemo(() => dishes.filter((d) => d.isOnline), [dishes]);

  const [recommendations, setRecommendations] = useState<DishRecommendation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRecommendations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRecommendationsForOwner(userId)
      .then((list) => {
        if (!cancelled) {
          setRecommendations(list);
          onRecommendationsChange?.(list);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateLocal = (next: DishRecommendation[]) => {
    setRecommendations(next);
  };

  const persistToServer = async (next: DishRecommendation[]) => {
    if (!userId) return;
    setSaving(true);
    try {
      const saved = await persistRecommendations(userId, next);
      setRecommendations(saved);
      onRecommendationsChange?.(saved);
    } catch {
      alert(t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const editing = recommendations.find((r) => r.id === editingId) ?? null;
  const dishesWithRec = new Set(recommendations.map((r) => r.dishId));
  const availableDishes = onlineDishes.filter((d) => !dishesWithRec.has(d.id) || editing?.dishId === d.id);

  const startCreate = () => {
    const dish = availableDishes[0];
    if (!dish) return;
    const rec = newRecommendation(dish.id, 'polecane');
    setEditingId(rec.id);
    setFormOpen(true);
    updateLocal([...recommendations, rec]);
  };

  const startEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const cancelEdit = async () => {
    setEditingId(null);
    setFormOpen(false);
    if (!userId) return;
    const fresh = await fetchRecommendationsForOwner(userId);
    setRecommendations(fresh);
    onRecommendationsChange?.(fresh);
  };

  const updateEditing = (patch: Partial<DishRecommendation>) => {
    if (!editing) return;
    const next = recommendations.map((r) => (r.id === editing.id ? { ...r, ...patch } : r));
    updateLocal(next);
  };

  const saveEditing = async () => {
    if (!editing) return;
    const normalizedItems =
      editing.type === 'polecane' ? normalizePolecaneItems(editing.items) : editing.items.filter((i) => i.title.trim());
    const cleaned: DishRecommendation = {
      ...editing,
      items: normalizedItems,
      customHeaderText: editing.customHeaderText?.trim() || undefined,
      currency: resolveRecommendationCurrency(editing.currency),
    };
    const filledCount =
      editing.type === 'polecane'
        ? normalizedItems.filter((i) => i.title.trim()).length
        : cleaned.items.length;
    if (filledCount === 0) {
      alert(t('errors.minOneProduct'));
      return;
    }
    const next = recommendations.map((r) => (r.id === editing.id ? cleaned : r));
    await persistToServer(next);
    setEditingId(null);
    setFormOpen(false);
  };

  const removeRecommendation = async (id: string) => {
    if (!confirm(t('confirm.delete'))) return;
    await persistToServer(recommendations.filter((r) => r.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setFormOpen(false);
    }
  };

  const savingsPreview =
    editing?.type === 'zestaw'
      ? calcSavingsPercent(editing.bundlePriceOutside ?? '', editing.bundlePrice ?? '')
      : null;

  if (!userId) {
    return (
      <p className="text-slate-500 text-sm">{t('loginRequired')}</p>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
            {t('intro')}
          </p>
        </div>
      </div>

      {/* Lista aktywnych rekomendacji */}
      {recommendations.length > 0 && !formOpen && (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const dish = dishes.find((d) => d.id === rec.dishId);
            return (
              <div
                key={rec.id}
                className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                  {dish?.imageUrl && (
                    <img src={dish.imageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{dish?.name ?? t('unknownDish')}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                    {t(`types.${rec.type}.badge`)}
                    {!rec.isActive && ` · ${t('disabled')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(rec.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => removeRecommendation(rec.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                  aria-label={t('delete')}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formularz */}
      {formOpen && editing && (
        <div className="bg-white rounded-[24px] border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dish')}</label>
            <div className="relative">
              <select
                value={editing.dishId}
                onChange={(e) => updateEditing({ dishId: e.target.value })}
                className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-800"
              >
                {onlineDishes.map((d) => (
                  <option key={d.id} value={d.id} disabled={dishesWithRec.has(d.id) && d.id !== editing.dishId}>
                    {d.name}
                    {dishesWithRec.has(d.id) && d.id !== editing.dishId ? t('hasRecommendation') : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('recommendationType')}</label>
            <div className="grid grid-cols-1 gap-2">
              {TYPE_OPTION_VALUES.map((optValue) => {
                const icon = TYPE_OPTION_ICONS[optValue];
                return (
                <button
                  key={optValue}
                  type="button"
                  onClick={() => {
                    const items =
                      optValue === 'zestaw'
                        ? editing.items.length >= 3
                          ? editing.items.slice(0, 3)
                          : [...editing.items, ...Array(Math.max(0, 3 - editing.items.length)).fill(null)].map(
                              (_, i) => editing.items[i] ?? newItem(),
                            )
                        : optValue === 'polecane'
                          ? createPolecaneItems(editing.items)
                          : editing.items.slice(0, 5);
                    updateEditing({
                      type: optValue,
                      items,
                      bundlePriceOutside: optValue === 'zestaw' ? editing.bundlePriceOutside ?? '' : undefined,
                      bundlePrice: optValue === 'zestaw' ? editing.bundlePrice ?? '' : undefined,
                    });
                  }}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    editing.type === optValue
                      ? 'border-chef-gold bg-amber-50/50'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {icon === 'gift' ? (
                      <Gift size={16} className="text-emerald-700 shrink-0" aria-hidden />
                    ) : (
                      icon && <span aria-hidden>{icon}</span>
                    )}
                    {t(`types.${optValue}.label`)}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">{t(`types.${optValue}.desc`)}</span>
                </button>
              );})}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-slate-700">{t('activeOnMenu')}</span>
            <button
              type="button"
              onClick={() => updateEditing({ isActive: !editing.isActive })}
              className={editing.isActive ? 'text-emerald-600' : 'text-slate-400'}
            >
              {editing.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('customHeader')}
            </label>
            <input
              type="text"
              placeholder={t(`types.${editing.type}.defaultHeader`)}
              value={editing.customHeaderText ?? ''}
              onChange={(e) => updateEditing({ customHeaderText: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('currency')}
            </label>
            <div className="relative">
              <select
                value={resolveRecommendationCurrency(editing.currency)}
                onChange={(e) => updateEditing({ currency: e.target.value as RecommendationCurrency })}
                className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-800"
              >
                {RECOMMENDATION_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t(`currencies.${code}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>

          {editing.type === 'zestaw' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('priceOutsideBundle')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editing.bundlePriceOutside ?? ''}
                  onChange={(e) => updateEditing({ bundlePriceOutside: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm"
                  placeholder={t('priceOutsidePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('bundlePrice')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editing.bundlePrice ?? ''}
                  onChange={(e) => updateEditing({ bundlePrice: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm"
                  placeholder={t('bundlePricePlaceholder')}
                />
              </div>
              {savingsPreview != null && savingsPreview > 0 && (
                <p className="col-span-2 text-sm text-emerald-700 font-medium">
                  {t('savings', { percent: savingsPreview })}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {editing.type === 'polecane' ? t('types.polecane.label') : t('relatedProducts')}
            </label>
            {editing.type === 'polecane' ? (
              normalizePolecaneItems(editing.items).map((item, idx) => {
                const slot = POLECANE_SLOTS[idx];
                const labelKey =
                  slot.id === 'polecane-perfect-with'
                    ? 'polecaneSlots.perfectWith'
                    : slot.id === 'polecane-finish-with'
                      ? 'polecaneSlots.finishWith'
                      : 'polecaneSlots.addA';
                return (
                  <div key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                    <p className="text-sm font-bold text-slate-800">
                      <span aria-hidden>{slot.emoji}</span> {t(labelKey)}
                    </p>
                    <input
                      type="text"
                      placeholder={t('polecaneSlots.inputPlaceholder')}
                      value={item.title}
                      onChange={(e) => {
                        const items = normalizePolecaneItems(editing.items);
                        items[idx] = { ...item, title: e.target.value, emoji: slot.emoji };
                        updateEditing({ items });
                      }}
                      className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm font-medium"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={t('polecaneSlots.pricePlaceholder')}
                      value={item.price ?? ''}
                      onChange={(e) => {
                        const items = normalizePolecaneItems(editing.items);
                        items[idx] = { ...item, price: e.target.value, emoji: slot.emoji };
                        updateEditing({ items });
                      }}
                      className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                );
              })
            ) : (
              editing.items.map((item, idx) => (
              <div key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                <input
                  type="text"
                  placeholder={t('productNamePlaceholder')}
                  value={item.title}
                  onChange={(e) => {
                    const items = [...editing.items];
                    items[idx] = { ...item, title: e.target.value };
                    updateEditing({ items });
                  }}
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm font-medium"
                />
                <input
                  type="text"
                  placeholder={t('productDescPlaceholder')}
                  value={item.subtitle ?? ''}
                  onChange={(e) => {
                    const items = [...editing.items];
                    items[idx] = { ...item, subtitle: e.target.value };
                    updateEditing({ items });
                  }}
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm"
                />
                {editing.type !== 'zestaw' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={t('productPricePlaceholder')}
                    value={item.price ?? ''}
                    onChange={(e) => {
                      const items = [...editing.items];
                      items[idx] = { ...item, price: e.target.value };
                      updateEditing({ items });
                    }}
                    className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm"
                  />
                )}
                {editing.items.length > (editing.type === 'zestaw' ? 3 : 1) && (
                  <button
                    type="button"
                    onClick={() => updateEditing({ items: editing.items.filter((_, i) => i !== idx) })}
                    className="text-xs text-red-500 font-medium"
                  >
                    {t('removeItem')}
                  </button>
                )}
              </div>
            )))}
            {editing.type === 'popularne' && editing.items.length < 4 && (
              <button
                type="button"
                onClick={() => updateEditing({ items: [...editing.items, newItem()] })}
                className="flex items-center gap-2 text-sm font-bold text-slate-600 px-3 py-2"
              >
                <Plus size={16} /> {t('addProduct')}
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={saveEditing}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? t('saving') : t('saveRecommendation')}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="py-3 px-6 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {!formOpen && (
        <button
          type="button"
          onClick={startCreate}
          disabled={availableDishes.length === 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-600 font-bold text-sm hover:border-chef-gold hover:text-chef-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Megaphone size={18} />
          {availableDishes.length === 0 ? t('allDishesHaveRecommendations') : t('newRecommendation')}
        </button>
      )}

      {recommendations.length === 0 && !formOpen && (
        <p className="text-xs text-slate-400 text-center">
          {t('emptyHint')}
        </p>
      )}

      {saving && (
        <p className="text-xs text-slate-500 text-center">{t('saving')}</p>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dish, HotelHubData } from '../types';
import { Link2, Eye, EyeOff, ExternalLink, QrCode, Trash2, Edit, Settings, Building2 } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { hotelHubDb } from '../services/hotelHubService';
import { MENU_CATEGORIES } from '../constants';
import { sortHotelHubCategories, sortHotelHubSections } from '../utils/hotelHub';
import { HotelHubSectionIcon } from './HotelHubSectionIcon';
interface Props {
  dishes: Dish[];
  onToggleOnline: (id: string) => void;
  onToggleHotelHub?: (id: string) => void;
  onUpdateHubAssignments?: (
    dishId: string,
    assignments: Array<{ sectionId: string; categoryId: string }>,
  ) => void;
  onUpdateVideo: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdatePrice: (id: string, price: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  menuUserId: string | null;
  hotelHubAvailable?: boolean;
}

export const MenuManager: React.FC<Props> = ({
  dishes,
  onToggleOnline,
  onToggleHotelHub,
  onUpdateHubAssignments,
  onUpdateVideo,
  onDelete,
  onSelect,
  onUpdatePrice,
  onUpdateCategory,
  menuUserId,
  hotelHubAvailable = false,
}) => {
  const { t } = useTranslation('menu');
  const getCategoryLabel = (cat: string) => t(`defaultCategories.${cat}`, { defaultValue: cat });
  const CUSTOM_CATEGORY_VALUE = '__custom_category__';
  const MENU_CATEGORIES_STORAGE_KEY = (uid: string) => `chefvision_menu_categories:${uid}`;
  const [justToggledId, setJustToggledId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState<string>('');
  const [customCategoryDrafts, setCustomCategoryDrafts] = useState<Record<string, string>>({});
  const [customCategoryEnabled, setCustomCategoryEnabled] = useState<Record<string, boolean>>({});
  const [menuCategories, setMenuCategories] = useState<string[]>([...MENU_CATEGORIES]);
  const [categoryManagerOpenForDishId, setCategoryManagerOpenForDishId] = useState<string | null>(null);
  const [categoryEditName, setCategoryEditName] = useState<string | null>(null);
  const [categoryEditDraft, setCategoryEditDraft] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [restaurantName, setRestaurantName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [categoriesSaved, setCategoriesSaved] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [hasProfileMenuCategories, setHasProfileMenuCategories] = useState(false);
  const [hotelHubEnabled, setHotelHubEnabled] = useState(false);
  const [hubData, setHubData] = useState<HotelHubData | null>(null);
  const [hubAssignOpenFor, setHubAssignOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menuUserId || !supabase) return;
    supabase
      .from('profiles')
      .select('primary_color, secondary_color, font_family, restaurant_name, menu_categories')
      .eq('id', menuUserId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.primary_color) setPrimaryColor(data.primary_color);
          if (data.secondary_color) setSecondaryColor(data.secondary_color);
          if (data.font_family) setFontFamily(data.font_family);
          if (data.restaurant_name) setRestaurantName(data.restaurant_name);
          if (Array.isArray((data as any).menu_categories) && (data as any).menu_categories.length > 0) {
            const normalized = (data as any).menu_categories
              .map((x: any) => String(x).trim())
              .filter(Boolean);
            if (normalized.length > 0) {
              setMenuCategories(Array.from(new Set(normalized)));
              setHasProfileMenuCategories(true);
            } else {
              setHasProfileMenuCategories(false);
            }
          } else {
            setHasProfileMenuCategories(false);
          }
        }
      });
  }, [menuUserId]);

  useEffect(() => {
    if (!menuUserId) return;
    if (hasProfileMenuCategories) return;
    try {
      const raw = localStorage.getItem(MENU_CATEGORIES_STORAGE_KEY(menuUserId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const cleaned = parsed.map((s) => s.trim()).filter(Boolean);
          if (cleaned.length) {
            setMenuCategories([...new Set(cleaned)]);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }

    // Fallback: stałe + wykryte kategorie z dań
    const extra = Array.from(
      new Set(
        (dishes || [])
          .map((d) => (d.category ?? '').trim())
          .filter(Boolean)
          .filter((c) => !MENU_CATEGORIES.includes(c as any)),
      ),
    );
    setMenuCategories([...MENU_CATEGORIES, ...extra]);
  }, [menuUserId, dishes, hasProfileMenuCategories]);

  useEffect(() => {
    if (!menuUserId) {
      setHotelHubEnabled(false);
      setHubData(null);
      return;
    }
    let cancelled = false;
    hotelHubDb.getHotelHubData(menuUserId).then((data) => {
      if (!cancelled) {
        setHotelHubEnabled(data.enabled);
        setHubData(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [menuUserId]);

  const hubSections = sortHotelHubSections(hubData?.sections ?? []);
  const showHotelHub = hotelHubAvailable && hotelHubEnabled;

  const persistMenuCategories = (next: string[]) => {
    setMenuCategories(next);
    if (!menuUserId) return;
    try {
      localStorage.setItem(MENU_CATEGORIES_STORAGE_KEY(menuUserId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const handleCommitMenuCategories = async () => {
    if (!menuUserId) return;
    const cleaned = Array.from(new Set(menuCategories.map((c) => c.trim()).filter(Boolean)));
    persistMenuCategories(cleaned);
    setCategoriesError(null);

    if (!supabase) {
      setCategoriesSaved(true);
      setTimeout(() => setCategoriesSaved(false), 2000);
      return;
    }

    setCategoriesSaving(true);
    try {
      // Refresh auth/session first
      await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const resp = await fetch('/api/save-menu-categories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ categories: cleaned }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      const next = Array.isArray(data?.menuCategories) ? data.menuCategories.map((x: any) => String(x).trim()).filter(Boolean) : cleaned;
      persistMenuCategories(Array.from(new Set(next)));
      setCategoriesSaved(true);
      setTimeout(() => setCategoriesSaved(false), 2500);
    } catch (e: any) {
      setCategoriesError(e?.message || t('errors.saveCategories'));
    } finally {
      setCategoriesSaving(false);
    }
  };

  const getBrightness = (hex: string) => {
    const c = hex.replace('#', '');
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const isBadContrast = (c1: string, c2: string) =>
    Math.abs(getBrightness(c1) - getBrightness(c2)) < 100;

  const handleSaveColors = async () => {
    if (!menuUserId || !supabase) return;
    if (isBadContrast(primaryColor, secondaryColor)) {
      alert(t('errors.badContrast'));
      return;
    }
    setColorSaving(true);
    await supabase
      .from('profiles')
      .update({ primary_color: primaryColor, secondary_color: secondaryColor, font_family: fontFamily, restaurant_name: restaurantName })
      .eq('id', menuUserId);
    setColorSaving(false);
    setColorSaved(true);
    setTimeout(() => setColorSaved(false), 2000);
  };

  const handleSaveName = async () => {
    if (!menuUserId || !supabase) return;
    setNameSaving(true);
    await supabase
      .from('profiles')
      .update({ restaurant_name: restaurantName })
      .eq('id', menuUserId);
    setNameSaving(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleToggleClick = (id: string) => {
    onToggleOnline(id);
    setJustToggledId(id);
    setTimeout(() => setJustToggledId(null), 400);
  };

  const beginEditPrice = (dish: Dish) => {
    setEditingPriceId(dish.id);
    setDraftPrice(dish.menuPrice || '');
  };

  const commitPrice = (dishId: string) => {
    onUpdatePrice(dishId, draftPrice);
    setEditingPriceId(null);
    setDraftPrice('');
  };

  const isKnownCategory = (category: string) => menuCategories.includes(category);

  const ensureCategoryExists = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (menuCategories.includes(trimmed)) return;
    persistMenuCategories([...menuCategories, trimmed]);
  };

  const renameCategoryEverywhere = (oldName: string, newName: string) => {
    const from = oldName.trim();
    const to = newName.trim();
    if (!from || !to) return;
    if (from === to) return;

    // 1) Zaktualizuj listę kategorii (pozycja w tej samej kolejności)
    const updatedCategories = menuCategories.map((c) => (c === from ? to : c));
    persistMenuCategories(Array.from(new Set(updatedCategories)));

    // 2) Zaktualizuj wszystkie dania z tą kategorią
    for (const dish of dishes) {
      const current = (dish.category ?? '').trim();
      if (current === from) onUpdateCategory(dish.id, to);
    }
  };

  const countDishesInCategory = (category: string) =>
    dishes.filter((d) => (d.category ?? '').trim() === category.trim()).length;

  const deleteCategory = (category: string) => {
    const name = category.trim();
    if (!name) return;

    if (menuCategories.length <= 1) {
      alert(t('errors.minOneCategory'));
      return;
    }

    const dishCount = countDishesInCategory(name);
    const confirmMsg =
      dishCount > 0
        ? t('confirm.deleteCategoryWithDishes', { name, count: dishCount })
        : t('confirm.deleteCategory', { name });

    if (!confirm(confirmMsg)) return;

    persistMenuCategories(menuCategories.filter((c) => c !== name));

    for (const dish of dishes) {
      if ((dish.category ?? '').trim() === name) onUpdateCategory(dish.id, null);
    }

    if (categoryEditName === name) {
      setCategoryEditName(null);
      setCategoryEditDraft('');
    }
  };

  const getBaseUrl = () =>
    `${window.location.origin}${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`;
  const menuUrl = menuUserId ? `${getBaseUrl()}/#/menu/${menuUserId}` : '';

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{t('title')}</h2>
          <p className="text-slate-500 text-sm">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => window.open(menuUrl, '_blank')}
          disabled={!menuUserId}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode size={18} /> {t('previewLive')}
        </button>
      </div>

      {/* Wygląd menu */}
      <div className="mx-8 my-6 p-6 bg-slate-50 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">{t('appearance.title')}</h3>
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">{t('appearance.restaurantName')}</label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={t('appearance.restaurantNamePlaceholder')}
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving || !menuUserId}
              className="px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 whitespace-nowrap"
            >
              {nameSaving ? t('appearance.saving') : nameSaved ? t('appearance.saved') : t('appearance.saveName')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('appearance.primaryColor')}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
              />
              <span className="text-sm font-mono text-slate-600">{primaryColor}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('appearance.backgroundColor')}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
              />
              <span className="text-sm font-mono text-slate-600">{secondaryColor}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('appearance.menuFont')}</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              style={{ fontFamily }}
            >
              <option value="Inter" style={{ fontFamily: 'Inter' }}>Inter</option>
              <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
              <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 justify-end">
            <button
              onClick={handleSaveColors}
              disabled={colorSaving || !menuUserId}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed
                bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
            >
              {colorSaving ? t('appearance.saving') : colorSaved ? t('appearance.saved') : t('appearance.saveColors')}
            </button>
            {isBadContrast(primaryColor, secondaryColor) && (
              <p className="text-xs text-amber-600 font-semibold">{t('appearance.contrastWarning')}</p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCommitMenuCategories()}
            disabled={categoriesSaving || !menuUserId}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
          >
            {categoriesSaving
              ? t('appearance.committingCategories')
              : categoriesSaved
                ? t('appearance.categoriesCommitted')
                : t('appearance.commitCategories')}
          </button>
          {categoriesError && (
            <p className="text-xs font-semibold text-red-600">{categoriesError}</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">{t('table.product')}</th>
              <th className="px-6 py-4">{t('table.category')}</th>
              <th className="px-6 py-4">{t('table.visibility')}</th>
              {showHotelHub && <th className="px-6 py-4">{t('table.hotelHub')}</th>}
              <th className="px-6 py-4">{t('table.price')}</th>
              <th className="px-6 py-4">{t('table.socialLink')}</th>
              <th className="px-6 py-4 text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dishes.map((dish) => (
              <tr key={dish.id} className="hover:bg-slate-50/50 transition-colors">

                {/* Produkt */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={dish.imageUrl}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-100 shrink-0"
                      alt={dish.name}
                    />
                    <span className="font-bold text-slate-800 text-sm leading-tight">{dish.name}</span>
                  </div>
                </td>

                {/* Kategoria */}
                <td className="px-6 py-4">
                  {(() => {
                    const normalizedCategory = dish.category?.trim() || '';
                    const hasCustomCategory = !!normalizedCategory && !isKnownCategory(normalizedCategory);
                    const customEnabled = customCategoryEnabled[dish.id] || hasCustomCategory;
                    const customValue = customCategoryDrafts[dish.id] ?? (dish.category ?? '');

                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={customEnabled ? CUSTOM_CATEGORY_VALUE : normalizedCategory}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (next === CUSTOM_CATEGORY_VALUE) {
                                setCustomCategoryEnabled((prev) => ({ ...prev, [dish.id]: true }));
                                setCustomCategoryDrafts((prev) => ({
                                  ...prev,
                                  [dish.id]: dish.category ?? (prev[dish.id] ?? ''),
                                }));
                                return;
                              }

                              setCustomCategoryEnabled((prev) => ({ ...prev, [dish.id]: false }));
                              onUpdateCategory(dish.id, next || null);
                            }}
                            className="w-44 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="">{t('category.none')}</option>
                            {menuCategories.map((cat) => (
                              <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                            ))}
                            <option value={CUSTOM_CATEGORY_VALUE} className="font-bold italic">
                              {t('category.newCustom')}
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setCategoryManagerOpenForDishId((prev) => (prev === dish.id ? null : dish.id))}
                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                            title={t('category.manage')}
                          >
                            <Settings size={16} />
                          </button>
                        </div>

                        {categoryManagerOpenForDishId === dish.id && (
                          <div className="w-[18.5rem] rounded-xl border border-slate-200 bg-white shadow-lg p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                              {t('category.editName')}
                            </div>
                            <div className="space-y-1 max-h-48 overflow-auto pr-1">
                              {menuCategories.map((cat) => {
                                const isEditingThis = categoryEditName === cat;
                                return (
                                  <div key={cat} className="flex items-center gap-2">
                                    {isEditingThis ? (
                                      <>
                                        <input
                                          autoFocus
                                          type="text"
                                          value={categoryEditDraft}
                                          onChange={(e) => setCategoryEditDraft(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              renameCategoryEverywhere(cat, categoryEditDraft);
                                              setCategoryEditName(null);
                                              setCategoryEditDraft('');
                                            } else if (e.key === 'Escape') {
                                              setCategoryEditName(null);
                                              setCategoryEditDraft('');
                                            }
                                          }}
                                          className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          placeholder={t('category.newNamePlaceholder')}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            renameCategoryEverywhere(cat, categoryEditDraft);
                                            setCategoryEditName(null);
                                            setCategoryEditDraft('');
                                          }}
                                          className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                          {t('category.save')}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteCategory(cat)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                          title={t('category.delete')}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex-1 text-xs font-semibold text-slate-700 truncate" title={cat}>
                                          {getCategoryLabel(cat)}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // „Koło zębate” → opcja Edycja (tu: od razu włącza tryb edycji)
                                              setCategoryEditName(cat);
                                              setCategoryEditDraft(cat);
                                            }}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                            title={t('category.edit')}
                                          >
                                            <Settings size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteCategory(cat)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title={t('category.delete')}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryManagerOpenForDishId(null);
                                  setCategoryEditName(null);
                                  setCategoryEditDraft('');
                                }}
                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                              >
                                {t('category.close')}
                              </button>
                            </div>
                          </div>
                        )}

                        {customEnabled && (
                          <input
                            type="text"
                            value={customValue}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setCustomCategoryDrafts((prev) => ({ ...prev, [dish.id]: nextValue }));
                              // Nie trimujemy na bieżąco, żeby działały spacje (np. "Dania dnia").
                              // Trim robimy dopiero na blur.
                              onUpdateCategory(dish.id, nextValue.length ? nextValue : null);
                            }}
                            onBlur={() => {
                              const raw = customCategoryDrafts[dish.id] ?? (dish.category ?? '');
                              const trimmed = raw.trim();
                              setCustomCategoryDrafts((prev) => ({ ...prev, [dish.id]: trimmed }));
                              onUpdateCategory(dish.id, trimmed ? trimmed : null);
                              if (trimmed) ensureCategoryExists(trimmed);
                            }}
                            placeholder={t('category.customPlaceholder')}
                            className="w-44 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* Widoczność */}
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleToggleClick(dish.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-200 w-fit
                        ${justToggledId === dish.id ? 'ring-2 ring-green-500 ring-offset-2 scale-105' : ''}
                        ${dish.isOnline
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                      title={t('visibility.restaurantTitle')}
                    >
                      {dish.isOnline ? <Eye size={14} /> : <EyeOff size={14} />}
                      {t('visibility.restaurant')}
                    </button>
                    {showHotelHub && onToggleHotelHub && (
                      <button
                        onClick={() => onToggleHotelHub(dish.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-200 w-fit
                          ${dish.visibleInHotelHub
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        title={t('visibility.hotelHubTitle')}
                      >
                        {dish.visibleInHotelHub ? <Eye size={14} /> : <EyeOff size={14} />}
                        Hotel Hub
                      </button>
                    )}
                  </div>
                </td>

                {showHotelHub && (
                  <td className="px-6 py-4">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setHubAssignOpenFor((prev) => (prev === dish.id ? null : dish.id))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <Building2 size={14} />
                        {t('visibility.sections')}
                      </button>
                      {hubAssignOpenFor === dish.id && hubData && onUpdateHubAssignments && (
                        <div className="absolute left-0 top-full mt-2 z-20 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {t('visibility.assignSections')}
                          </p>
                          {hubSections.map((section) => {
                            const cats = sortHotelHubCategories(
                              hubData.categories.filter((c) => c.sectionId === section.id),
                            );
                            const dishAssignments = hubData.assignments.filter((a) => a.dishId === dish.id && a.sectionId === section.id);
                            const selectedCatId = dishAssignments[0]?.categoryId ?? '';
                            return (
                              <div key={section.id} className="space-y-1">
                                <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                                  <HotelHubSectionIcon icon={section.iconEmoji} size="sm" />
                                  {section.name}
                                </span>
                                <select
                                  value={selectedCatId}
                                  onChange={(e) => {
                                    const categoryId = e.target.value;
                                    const dishAssignmentsForOtherSections = hubData.assignments
                                      .filter((a) => a.dishId === dish.id && a.sectionId !== section.id)
                                      .map((a) => ({ sectionId: a.sectionId, categoryId: a.categoryId }));
                                    const next = categoryId
                                      ? [...dishAssignmentsForOtherSections, { sectionId: section.id, categoryId }]
                                      : dishAssignmentsForOtherSections;
                                    onUpdateHubAssignments(dish.id, next);
                                    setHubData((prev) => {
                                      if (!prev) return prev;
                                      const filtered = prev.assignments.filter((a) => a.dishId !== dish.id);
                                      const added = next.map((a, idx) => ({
                                        id: `tmp-${dish.id}-${idx}`,
                                        userId: menuUserId!,
                                        dishId: dish.id,
                                        sectionId: a.sectionId,
                                        categoryId: a.categoryId,
                                      }));
                                      return { ...prev, assignments: [...filtered, ...added] };
                                    });
                                  }}
                                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200"
                                >
                                  <option value="">{t('category.none')}</option>
                                  {cats.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setHubAssignOpenFor(null)}
                            className="w-full py-1.5 text-[10px] font-black uppercase text-slate-500"
                          >
                            {t('category.close')}
                          </button>
                          {!dish.visibleInHotelHub && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-snug">
                              {t('visibility.autoEnableHotelHub')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                )}

                {/* Cena – inline edit */}
                <td className="px-6 py-4">
                  {editingPriceId === dish.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(e.target.value)}
                      onBlur={() => commitPrice(dish.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitPrice(dish.id);
                        else if (e.key === 'Escape') { setEditingPriceId(null); setDraftPrice(''); }
                      }}
                      className="w-24 px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-right"
                      placeholder={t('price.placeholder')}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEditPrice(dish)}
                      className="inline-flex items-center justify-end gap-1 min-w-[3.5rem] text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      {dish.menuPrice
                        ? <span className="tabular-nums">{dish.menuPrice} {t('price.currency')}</span>
                        : <span className="text-slate-400 italic">{t('price.add')}</span>}
                    </button>
                  )}
                </td>

                {/* Social Link */}
                <td className="px-6 py-4">
                  <div className="relative max-w-[220px]">
                    <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={dish.videoUrl || ''}
                      onChange={(e) => onUpdateVideo(dish.id, e.target.value)}
                      placeholder={t('socialPlaceholder')}
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-100 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </td>

                {/* Akcje */}
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onSelect(dish.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      title={t('actions.editDetails')}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => menuUrl && window.open(`${menuUrl}/dish/${dish.id}`, '_blank')}
                      disabled={!menuUserId}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('actions.previewInMenu')}
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('confirm.deleteDish'))) onDelete(dish.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title={t('actions.deleteDish')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {dishes.length === 0 && (
              <tr>
                <td colSpan={showHotelHub ? 7 : 6} className="px-8 py-12 text-center text-slate-400 font-medium">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

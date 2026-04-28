
import React, { useState, useEffect } from 'react';
import { Dish } from '../types';
import { Link2, Eye, EyeOff, ExternalLink, QrCode, Trash2, Edit, Settings } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { MENU_CATEGORIES } from '../constants';
import { UploadCover } from './UploadCover';

interface Props {
  dishes: Dish[];
  onToggleOnline: (id: string) => void;
  onUpdateVideo: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdatePrice: (id: string, price: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  menuUserId: string | null;
}

export const MenuManager: React.FC<Props> = ({
  dishes,
  onToggleOnline,
  onUpdateVideo,
  onDelete,
  onSelect,
  onUpdatePrice,
  onUpdateCategory,
  menuUserId,
}) => {
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

  useEffect(() => {
    if (!menuUserId || !supabase) return;
    supabase
      .from('profiles')
      .select('primary_color, secondary_color, font_family, restaurant_name')
      .eq('id', menuUserId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.primary_color) setPrimaryColor(data.primary_color);
          if (data.secondary_color) setSecondaryColor(data.secondary_color);
          if (data.font_family) setFontFamily(data.font_family);
          if (data.restaurant_name) setRestaurantName(data.restaurant_name);
        }
      });
  }, [menuUserId]);

  useEffect(() => {
    if (!menuUserId) return;
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
  }, [menuUserId, dishes]);

  const persistMenuCategories = (next: string[]) => {
    setMenuCategories(next);
    if (!menuUserId) return;
    try {
      localStorage.setItem(MENU_CATEGORIES_STORAGE_KEY(menuUserId), JSON.stringify(next));
    } catch {
      /* ignore */
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
      alert('Kolory są zbyt podobne – menu będzie nieczytelne. Wybierz bardziej kontrastowe kolory.');
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

  const getBaseUrl = () =>
    `${window.location.origin}${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`;
  const menuUrl = menuUserId ? `${getBaseUrl()}/#/menu/${menuUserId}` : '';

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Zarządzanie Menu Cyfrowym</h2>
          <p className="text-slate-500 text-sm">Decyduj co widzą Twoi goście w czasie rzeczywistym</p>
        </div>
        <button
          onClick={() => window.open(menuUrl, '_blank')}
          disabled={!menuUserId}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode size={18} /> Podgląd Menu Live
        </button>
      </div>

      {/* Wygląd menu */}
      <div className="mx-8 my-6 p-6 bg-slate-50 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Wygląd menu</h3>
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nazwa restauracji</label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Np. Mamma Mia"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving || !menuUserId}
              className="px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 whitespace-nowrap"
            >
              {nameSaving ? 'Zapisywanie…' : nameSaved ? 'Zapisano ✓' : 'Zapisz nazwę'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kolor główny</label>
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kolor tła</label>
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Font menu</label>
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
              {colorSaving ? 'Zapisywanie…' : colorSaved ? 'Zapisano ✓' : 'Zapisz kolory'}
            </button>
            {isBadContrast(primaryColor, secondaryColor) && (
              <p className="text-xs text-amber-600 font-semibold">⚠️ Wybierz kontrastowe kolory</p>
            )}
          </div>
        </div>

        {menuUserId && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <UploadCover userId={menuUserId} />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Produkt</th>
              <th className="px-6 py-4">Kategoria</th>
              <th className="px-6 py-4">Status Online</th>
              <th className="px-6 py-4">Cena</th>
              <th className="px-6 py-4">Social Link</th>
              <th className="px-6 py-4 text-right">Akcje</th>
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
                            <option value="">— brak —</option>
                            {menuCategories.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value={CUSTOM_CATEGORY_VALUE} className="font-bold italic">
                              Nowa kategoria (wpisz)
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setCategoryManagerOpenForDishId((prev) => (prev === dish.id ? null : dish.id))}
                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                            title="Zarządzaj kategoriami"
                          >
                            <Settings size={16} />
                          </button>
                        </div>

                        {categoryManagerOpenForDishId === dish.id && (
                          <div className="w-[18.5rem] rounded-xl border border-slate-200 bg-white shadow-lg p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                              Kategorie
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
                                          placeholder="Nowa nazwa kategorii"
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
                                          Zapisz
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex-1 text-xs font-semibold text-slate-700 truncate" title={cat}>
                                          {cat}
                                        </div>
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // „Koło zębate” → opcja Edycja (tu: od razu włącza tryb edycji)
                                              setCategoryEditName(cat);
                                              setCategoryEditDraft(cat);
                                            }}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                            title="Edycja"
                                          >
                                            <Settings size={14} />
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
                                Zamknij
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
                            placeholder="Wpisz własną kategorię"
                            className="w-44 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* Status Online */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleClick(dish.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-200
                      ${justToggledId === dish.id ? 'ring-2 ring-green-500 ring-offset-2 scale-105' : ''}
                      ${dish.isOnline
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {dish.isOnline ? <Eye size={14} /> : <EyeOff size={14} />}
                    {dish.isOnline ? 'Widoczne' : 'Ukryte'}
                  </button>
                </td>

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
                      placeholder="np. 39"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEditPrice(dish)}
                      className="inline-flex items-center justify-end gap-1 min-w-[3.5rem] text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      {dish.menuPrice
                        ? <span className="tabular-nums">{dish.menuPrice} zł</span>
                        : <span className="text-slate-400 italic">Dodaj cenę</span>}
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
                      placeholder="YT, TikTok, Instagram..."
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
                      title="Edytuj szczegóły"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => menuUrl && window.open(`${menuUrl}/dish/${dish.id}`, '_blank')}
                      disabled={!menuUserId}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Podgląd w menu"
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz usunąć to danie?')) onDelete(dish.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Usuń danie"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {dishes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-medium">
                  Brak dań w menu. Przejdź do Chef's Studio, aby stworzyć pierwsze danie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

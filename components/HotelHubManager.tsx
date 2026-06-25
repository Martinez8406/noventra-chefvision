import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HotelHubCategory, HotelHubData, HotelHubInfoFields, HotelHubSection } from '../types';
import { hotelHubDb } from '../services/hotelHubService';
import { sortHotelHubCategories, sortHotelHubSections } from '../utils/hotelHub';
import { EMPTY_HOTEL_INFO_FIELDS, isHotelInfoSection, normalizeHotelInfoFields } from '../utils/hotelHubInfo';
import { HOTEL_HUB_ICON_SRC } from '../constants';
import { compressImageForUpload } from '../services/imageService';
import { HotelHubSectionIcon } from './HotelHubSectionIcon';
import { HotelInfoFieldsEditor } from './PublicHotelInfoSection';
import {
  Building2,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Save,
  GripVertical,
} from 'lucide-react';

interface Props {
  userId: string | null;
}

const emptySection = (sortOrder: number): Partial<HotelHubSection> & { name: string } => ({
  name: '',
  iconEmoji: HOTEL_HUB_ICON_SRC,
  description: '',
  sectionType: 'menu',
  isVisible: true,
  availabilityMode: '24h',
  availabilityFrom: '07:00',
  availabilityTo: '22:00',
  serviceNotes: '',
  sortOrder,
});

const SERVICE_NOTE_TEMPLATE_KEYS = ['0', '1'] as const;

type HubErrorKey = 'infoSectionMigration' | 'planRequired' | 'addInfoSectionFailed';

export const HotelHubManager: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('hotelHub');
  const [hubData, setHubData] = useState<HotelHubData>({
    enabled: false,
    sections: [],
    categories: [],
    assignments: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<(Partial<HotelHubSection> & { name: string }) | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [uploadingHero, setUploadingHero] = useState(false);
  const [infoSectionErrorKey, setInfoSectionErrorKey] = useState<HubErrorKey | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setHubData({ enabled: false, sections: [], categories: [], assignments: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setInfoSectionErrorKey(null);
    try {
      const data = await hotelHubDb.getHotelHubData(userId);
      if (data.enabled) {
        if (data.sections.length === 0) {
          await hotelHubDb.seedDefaultSections(userId);
        } else {
          const created = await hotelHubDb.ensureHotelInfoSection(userId);
          if (!created && !data.sections.some((s) => isHotelInfoSection(s))) {
            setInfoSectionErrorKey('infoSectionMigration');
          }
        }
      }
      await hotelHubDb.syncAllSectionIcons(userId);
      const synced = await hotelHubDb.getHotelHubData(userId);
      setHubData(synced);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleToggleEnabled = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const next = !hubData.enabled;
      const ok = await hotelHubDb.setHotelHubEnabled(userId, next);
      if (!ok && next) {
        setInfoSectionErrorKey('planRequired');
        return;
      }
      if (next) {
        await hotelHubDb.seedDefaultSections(userId);
        await hotelHubDb.ensureHotelInfoSection(userId);
      }
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = async () => {
    if (!userId || !editingSection?.name.trim()) return;
    setSaving(true);
    try {
      await hotelHubDb.saveSection(userId, {
        ...editingSection,
        iconEmoji: HOTEL_HUB_ICON_SRC,
        sectionType: editingSection.sectionType ?? 'menu',
        infoFields:
          editingSection.sectionType === 'info'
            ? normalizeHotelInfoFields(editingSection.infoFields ?? EMPTY_HOTEL_INFO_FIELDS)
            : undefined,
      });
      setEditingSection(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!userId || !confirm(t('sections.deleteConfirm'))) return;
    setSaving(true);
    try {
      await hotelHubDb.deleteSection(userId, sectionId);
      if (expandedSectionId === sectionId) setExpandedSectionId(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (sectionId: string) => {
    if (!userId) return;
    const name = (newCategoryName[sectionId] || '').trim();
    if (!name) return;
    const sectionCats = hubData.categories.filter((c) => c.sectionId === sectionId);
    setSaving(true);
    try {
      await hotelHubDb.saveCategory(userId, {
        sectionId,
        name,
        sortOrder: sectionCats.length,
      });
      setNewCategoryName((prev) => ({ ...prev, [sectionId]: '' }));
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!userId) return;
    setSaving(true);
    try {
      await hotelHubDb.deleteCategory(userId, categoryId);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !editingSection) return;
    e.target.value = '';
    setUploadingHero(true);
    try {
      const dataUrl = await compressImageForUpload(file);
      const url = await hotelHubDb.uploadSectionHeroImage(userId, dataUrl);
      setEditingSection((prev) => (prev ? { ...prev, heroImageUrl: url } : prev));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('errors.heroUploadFailed'));
    } finally {
      setUploadingHero(false);
    }
  };

  const handleAddInfoSection = async () => {
    if (!userId) return;
    setSaving(true);
    setInfoSectionErrorKey(null);
    try {
      const created = await hotelHubDb.ensureHotelInfoSection(userId);
      if (!created) {
        setInfoSectionErrorKey('addInfoSectionFailed');
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const sections = sortHotelHubSections(hubData.sections);
  const hasInfoSection = sections.some((s) => isHotelInfoSection(s));
  const assignedDishCount = (sectionId: string) =>
    new Set(hubData.assignments.filter((a) => a.sectionId === sectionId).map((a) => a.dishId)).size;

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
            <Building2 className="text-chef-gold" size={32} />
            {t('title')}
          </h2>
          <p className="text-slate-500 text-sm mt-2 max-w-xl">{t('intro')}</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8">
        <label className="flex items-start gap-4 cursor-pointer group">
          <input
            type="checkbox"
            checked={hubData.enabled}
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

      {hubData.enabled && (
        <>
          {infoSectionErrorKey && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {t(`errors.${infoSectionErrorKey}`)}
            </div>
          )}

          {!hasInfoSection && (
            <div className="rounded-2xl border border-chef-gold/30 bg-chef-cream/40 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-slate-700">
                {t('infoSection.missingBannerBefore')}{' '}
                <strong>{t('infoSection.defaultName')}</strong>{' '}
                {t('infoSection.missingBannerAfter')}
              </p>
              <button
                type="button"
                onClick={() => void handleAddInfoSection()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-chef-gold text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t('infoSection.addButton')}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-black text-slate-800 italic">{t('sections.title')}</h3>
            <button
              type="button"
              onClick={() => {
                setEditingSection(emptySection(sections.length));
                setExpandedSectionId(null);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-chef-dark text-white text-sm font-black hover:bg-chef-dark2 transition-colors"
            >
              <Plus size={18} />
              {t('sections.addCustom')}
            </button>
          </div>

          {editingSection && (
            <div className="bg-white rounded-[32px] border-2 border-chef-gold/30 shadow-lg p-6 md:p-8 space-y-6">
              <h4 className="font-black text-slate-900 text-lg">
                {editingSection.id ? t('sections.edit') : t('sections.new')}
              </h4>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sections.nameLabel')}</label>
                  <input
                    type="text"
                    value={editingSection.name}
                    onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                    placeholder={t('sections.namePlaceholder')}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-chef-gold/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sections.iconLabel')}</label>
                  <div className="mt-2 flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <HotelHubSectionIcon icon={editingSection.iconEmoji || HOTEL_HUB_ICON_SRC} size="lg" />
                    <span className="text-xs text-slate-500">{t('sections.iconHelp')}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sections.heroLabel')}</label>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {editingSection.heroImageUrl && (
                    <img
                      src={editingSection.heroImageUrl}
                      alt=""
                      className="w-32 h-20 rounded-2xl object-cover border border-slate-100 shadow-sm"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    disabled={uploadingHero}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    {uploadingHero ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    {editingSection.heroImageUrl ? t('sections.changeHero') : t('sections.addHero')}
                  </button>
                  <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleHeroUpload(e)} />
                </div>
              </div>

              {editingSection.sectionType === 'info' ? (
                <HotelInfoFieldsEditor
                  fields={normalizeHotelInfoFields(editingSection.infoFields ?? EMPTY_HOTEL_INFO_FIELDS)}
                  onChange={(infoFields: HotelHubInfoFields) =>
                    setEditingSection({ ...editingSection, infoFields })
                  }
                />
              ) : (
                <>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t('sections.availabilityLabel')}</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      checked={editingSection.availabilityMode === '24h'}
                      onChange={() => setEditingSection({ ...editingSection, availabilityMode: '24h' })}
                    />
                    <span className="text-sm font-medium text-slate-700">{t('sections.available24h')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      checked={editingSection.availabilityMode === 'custom'}
                      onChange={() => setEditingSection({ ...editingSection, availabilityMode: 'custom' })}
                    />
                    <span className="text-sm font-medium text-slate-700">{t('sections.customHours')}</span>
                  </label>
                </div>
                {editingSection.availabilityMode === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="text-sm text-slate-500">{t('sections.from')}</span>
                    <input
                      type="time"
                      value={editingSection.availabilityFrom || '07:00'}
                      onChange={(e) => setEditingSection({ ...editingSection, availabilityFrom: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                    <span className="text-sm text-slate-500">{t('sections.to')}</span>
                    <input
                      type="time"
                      value={editingSection.availabilityTo || '22:00'}
                      onChange={(e) => setEditingSection({ ...editingSection, availabilityTo: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sections.serviceNotesLabel')}</label>
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {SERVICE_NOTE_TEMPLATE_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setEditingSection({
                          ...editingSection,
                          serviceNotes: t(`serviceNoteTemplates.${key}`),
                        })
                      }
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-chef-cream border border-slate-200"
                    >
                      {t('sections.templateButton')}
                    </button>
                  ))}
                </div>
                <textarea
                  value={editingSection.serviceNotes || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, serviceNotes: e.target.value })}
                  rows={2}
                  placeholder={t('sections.serviceNotesPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-chef-gold/40 outline-none resize-none"
                />
              </div>
                </>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSection.isVisible !== false}
                  onChange={(e) => setEditingSection({ ...editingSection, isVisible: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-chef-gold"
                />
                <span className="text-sm font-bold text-slate-700">{t('sections.visibleForGuests')}</span>
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleSaveSection()}
                  disabled={saving || !editingSection.name.trim()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-chef-gold text-white font-black text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {t('sections.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm"
                >
                  {t('sections.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {sections.map((section) => {
              const sectionCategories = sortHotelHubCategories(
                hubData.categories.filter((c) => c.sectionId === section.id),
              );
              const isExpanded = expandedSectionId === section.id;

              return (
                <div
                  key={section.id}
                  className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="p-5 md:p-6 flex flex-wrap items-center gap-4">
                    <HotelHubSectionIcon icon={section.iconEmoji} size="lg" className="drop-shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900">{section.name}</h4>
                        {!section.isVisible && (
                          <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {t('sections.hidden')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isHotelInfoSection(section)
                          ? t('sections.infoType')
                          : t('sections.stats', {
                              count: sectionCategories.length,
                              dishes: assignedDishCount(section.id),
                            })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection({ ...section });
                          setExpandedSectionId(null);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        {t('sections.editShort')}
                      </button>
                      {!isHotelInfoSection(section) && (
                      <button
                        type="button"
                        onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteSection(section.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title={t('sections.deleteTitle')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && !isHotelInfoSection(section) && (
                    <div className="border-t border-slate-100 p-5 md:p-6 bg-slate-50/50 space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('sections.categoriesTitle')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {sectionCategories.map((cat: HotelHubCategory) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm"
                          >
                            <GripVertical size={12} className="text-slate-300" />
                            {cat.name}
                            <button
                              type="button"
                              onClick={() => void handleDeleteCategory(cat.id)}
                              className="p-1 rounded-full hover:bg-red-50 hover:text-red-600 text-slate-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 max-w-md">
                        <input
                          type="text"
                          value={newCategoryName[section.id] || ''}
                          onChange={(e) => setNewCategoryName((prev) => ({ ...prev, [section.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleAddCategory(section.id);
                          }}
                          placeholder={t('sections.newCategoryPlaceholder')}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddCategory(section.id)}
                          className="px-4 py-2.5 rounded-xl bg-chef-dark text-white text-sm font-black"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">{t('sections.assignHint')}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sections.length === 0 && !editingSection && (
            <p className="text-center text-slate-400 py-8">{t('sections.empty')}</p>
          )}
        </>
      )}
    </div>
  );
};

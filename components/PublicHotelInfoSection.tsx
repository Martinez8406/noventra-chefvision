import React from 'react';
import { ExternalLink, MapPin, Plus, Trash2 } from 'lucide-react';
import { HotelHubInfoAttraction, HotelHubInfoFields, HotelHubSection, PublicMenuLocale } from '../types';
import {
  attractionsForPublicDisplay,
  buildGoogleMapsUrl,
  getAttractionsGroupLabel,
  getContactGroupLabel,
  getHotelInfoFieldDefs,
  getImportantHoursGroupLabel,
  getTransportGroupLabel,
  getWifiGroupLabel,
  hasAnyHotelInfoContent,
  infoFieldsForPublicDisplay,
} from '../utils/hotelHubInfo';
import { HotelHubSectionIcon } from './HotelHubSectionIcon';

interface Props {
  section: HotelHubSection;
  menuLocale: PublicMenuLocale;
  primaryColor: string;
  onBack: () => void;
}

export const PublicHotelInfoSection: React.FC<Props> = ({
  section,
  menuLocale,
  primaryColor,
  onBack,
}) => {
  const isPl = menuLocale === 'pl';
  const fields = section.infoFields ?? {};
  const rows = infoFieldsForPublicDisplay(fields, menuLocale);
  const contactRows = rows.filter((r) => r.group === 'contact');
  const hoursRows = rows.filter((r) => r.group === 'hours');
  const wifiRows = rows.filter((r) => r.group === 'wifi');
  const transportRows = rows.filter((r) => r.group === 'transport');
  const attractions = attractionsForPublicDisplay(fields);

  const renderGroup = (
    title: string,
    groupRows: Array<{ label: string; value: string }>,
    icon?: string,
  ) => {
    if (groupRows.length === 0) return null;
    return (
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.05)] overflow-hidden">
        <div
          className="px-6 py-4 border-b border-slate-100"
          style={{ background: `linear-gradient(135deg, ${primaryColor}12, white)` }}
        >
          <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: primaryColor }}>
            {icon && <span aria-hidden>{icon}</span>}
            {title}
          </h2>
        </div>
        <dl className="divide-y divide-slate-100">
          {groupRows.map((row) => (
            <div key={row.label} className="px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6">
              <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400 sm:w-40 shrink-0">
                {row.label}
              </dt>
              <dd className="text-sm font-medium text-slate-800 leading-relaxed flex-1 whitespace-pre-wrap">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const renderAttractions = () => {
    if (attractions.length === 0) return null;
    return (
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.05)] overflow-hidden">
        <div
          className="px-6 py-4 border-b border-slate-100"
          style={{ background: `linear-gradient(135deg, ${primaryColor}12, white)` }}
        >
          <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: primaryColor }}>
            <span aria-hidden>🏛</span>
            {getAttractionsGroupLabel(menuLocale)}
          </h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {attractions.map((item, index) => {
            const mapsUrl = buildGoogleMapsUrl(item.name, item.mapsUrl);
            return (
              <li key={`${item.name}-${index}`}>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 px-6 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors group"
                >
                  <span className="flex items-center gap-3">
                    <MapPin size={16} className="text-slate-400 group-hover:text-chef-gold shrink-0" style={{ color: primaryColor }} />
                    {item.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-400 group-hover:text-slate-600 shrink-0">
                    Google Maps
                    <ExternalLink size={12} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-16">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-6 px-1"
      >
        ← {isPl ? 'Wszystkie sekcje' : 'All sections'}
      </button>

      <header className="rounded-[32px] overflow-hidden bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 mb-8">
        {section.heroImageUrl ? (
          <div className="h-44 sm:h-56 relative">
            <img src={section.heroImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
              <div className="mb-2">
                <HotelHubSectionIcon size="xl" className="brightness-0 invert" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black italic tracking-tight">{section.name}</h1>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${primaryColor}18, white)` }}>
            <div className="mb-2">
              <HotelHubSectionIcon size="xl" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tight">{section.name}</h1>
          </div>
        )}
      </header>

      <div className="space-y-6">
        {renderGroup(getContactGroupLabel(menuLocale), contactRows)}
        {renderGroup(getImportantHoursGroupLabel(menuLocale), hoursRows)}
        {renderGroup(getWifiGroupLabel(menuLocale), wifiRows)}
        {renderGroup(getTransportGroupLabel(menuLocale), transportRows, '🚕')}
        {renderAttractions()}
      </div>

      {!hasAnyHotelInfoContent(fields, menuLocale) && (
        <p className="text-center text-slate-400 py-16">
          {isPl ? 'Informacje wkrótce dostępne.' : 'Information coming soon.'}
        </p>
      )}
    </div>
  );
};

const emptyAttraction = (): HotelHubInfoAttraction => ({ name: '', mapsUrl: '' });

/** Pola formularza admina — edycja info_fields */
export const HotelInfoFieldsEditor: React.FC<{
  fields: HotelHubInfoFields;
  onChange: (fields: HotelHubInfoFields) => void;
}> = ({ fields, onChange }) => {
  const defs = getHotelInfoFieldDefs('pl');
  const contactDefs = defs.filter((d) => d.group === 'contact');
  const hoursDefs = defs.filter((d) => d.group === 'hours');
  const wifiDefs = defs.filter((d) => d.group === 'wifi');
  const transportDefs = defs.filter((d) => d.group === 'transport');
  const attractions = fields.attractions ?? [];

  const update = (key: Exclude<keyof HotelHubInfoFields, 'attractions'>, value: string) => {
    onChange({ ...fields, [key]: value });
  };

  const updateAttraction = (index: number, patch: Partial<HotelHubInfoAttraction>) => {
    const next = attractions.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...fields, attractions: next });
  };

  const addAttraction = () => {
    onChange({ ...fields, attractions: [...attractions, emptyAttraction()] });
  };

  const removeAttraction = (index: number) => {
    onChange({ ...fields, attractions: attractions.filter((_, i) => i !== index) });
  };

  const renderFields = (items: typeof defs, groupTitle: string, icon?: string) => (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {groupTitle}
      </p>
      <div className="grid gap-4">
        {items.map((f) => (
          <label key={f.key} className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">{f.label}</span>
            <input
              type="text"
              value={fields[f.key] || ''}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-chef-gold/40 outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pt-2 border-t border-slate-100">
      {renderFields(contactDefs, 'Kontakt')}
      {renderFields(hoursDefs, 'Ważne godziny')}
      {renderFields(wifiDefs, 'Wi-Fi')}
      {renderFields(transportDefs, 'Transport', '🚕')}

      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <span>🏛</span>
          Atrakcje w okolicy
        </p>
        <p className="text-xs text-slate-500">
          Dodaj miejsca z linkiem do Google Maps (opcjonalnie — bez linku wyszukamy miejsce po nazwie).
        </p>
        <div className="space-y-3">
          {attractions.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/60 md:grid-cols-[1fr_1fr_auto]"
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Nazwa</span>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateAttraction(index, { name: e.target.value })}
                  placeholder="np. Rynek Główny"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-chef-gold/40 outline-none"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Link Google Maps</span>
                <input
                  type="url"
                  value={item.mapsUrl || ''}
                  onChange={(e) => updateAttraction(index, { mapsUrl: e.target.value })}
                  placeholder="https://maps.google.com/…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-chef-gold/40 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => removeAttraction(index)}
                className="self-end p-3 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
                title="Usuń atrakcję"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAttraction}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:border-chef-gold hover:text-chef-gold"
        >
          <Plus size={16} />
          Dodaj atrakcję
        </button>
      </div>
    </div>
  );
};

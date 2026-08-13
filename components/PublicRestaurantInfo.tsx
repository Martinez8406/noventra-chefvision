import React from 'react';
import { CalendarDays, Clock, ExternalLink, MapPin, Phone } from 'lucide-react';
import type { PublicMenuLocale, RestaurantInfoContent } from '../types';
import {
  buildMapsUrl,
  getTodayHoursStatus,
  hasPublicRestaurantInfoContent,
  RESTAURANT_INFO_WEEKDAYS,
  upcomingEvents,
  weekdayLabel,
} from '../utils/restaurantInfo';

interface Props {
  content: RestaurantInfoContent;
  menuLocale: PublicMenuLocale;
  primaryColor: string;
  restaurantTitle: string;
}

function Card({
  title,
  icon,
  primaryColor,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  primaryColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.05)] overflow-hidden">
      <div
        className="px-6 py-4 border-b border-slate-100"
        style={{ background: `linear-gradient(135deg, ${primaryColor}12, white)` }}
      >
        <h2
          className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"
          style={{ color: primaryColor }}
        >
          {icon}
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export const PublicRestaurantInfo: React.FC<Props> = ({
  content,
  menuLocale,
  primaryColor,
  restaurantTitle,
}) => {
  const isPl = menuLocale === 'pl';
  const today = getTodayHoursStatus(content);
  const events = upcomingEvents(content);

  if (!hasPublicRestaurantInfoContent(content)) {
    return (
      <p className="text-center text-slate-400 py-16">
        {isPl ? 'Informacje wkrótce dostępne.' : 'Information coming soon.'}
      </p>
    );
  }

  const mapsHref =
    content.access.address || content.access.mapsUrl
      ? buildMapsUrl(content.access.address, content.access.mapsUrl)
      : null;

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-16 px-1 space-y-6">
      {(content.about.heroImageUrl || content.about.description.trim()) && (
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.05)] overflow-hidden">
          {content.about.heroImageUrl && (
            <img src={content.about.heroImageUrl} alt="" className="w-full h-48 sm:h-64 object-cover" />
          )}
          <div className="p-6 sm:p-8 space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
              {restaurantTitle}
            </p>
            {content.about.description.trim() && (
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{content.about.description}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title={isPl ? 'Godziny otwarcia' : 'Opening hours'}
          icon={<Clock size={14} />}
          primaryColor={primaryColor}
        >
          <p className="text-sm font-black text-slate-900 mb-4">
            {today.exception && today.note
              ? today.note
              : today.closed
                ? isPl
                  ? 'Dziś zamknięte'
                  : 'Closed today'
                : isPl
                  ? `Dziś otwarte ${today.from}–${today.to}`
                  : `Open today ${today.from}–${today.to}`}
          </p>
          <ul className="space-y-1.5">
            {RESTAURANT_INFO_WEEKDAYS.map((day) => {
              const row = content.hours.weekly[day];
              return (
                <li key={day} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500 font-medium">{weekdayLabel(day, isPl ? 'pl' : 'en')}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {row.closed ? (isPl ? 'Zamknięte' : 'Closed') : `${row.from}–${row.to}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {(content.contact.phone ||
          content.contact.email ||
          content.contact.reservationUrl ||
          content.contact.instagram) && (
            <Card title={isPl ? 'Kontakt' : 'Contact'} icon={<Phone size={14} />} primaryColor={primaryColor}>
              <dl className="space-y-3 text-sm">
                {content.contact.phone && (
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">{isPl ? 'Telefon' : 'Phone'}</dt>
                    <dd>
                      <a href={`tel:${content.contact.phone}`} className="font-semibold text-slate-800 hover:underline">
                        {content.contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {content.contact.email && (
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">E-mail</dt>
                    <dd>
                      <a href={`mailto:${content.contact.email}`} className="font-semibold text-slate-800 hover:underline">
                        {content.contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {content.contact.reservationUrl && (
                  <div>
                    <a
                      href={content.contact.reservationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-black text-sm"
                      style={{ color: primaryColor }}
                    >
                      {isPl ? 'Rezerwacja' : 'Reservations'}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
                {content.contact.instagram && (
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Instagram</dt>
                    <dd className="font-semibold text-slate-800">{content.contact.instagram}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
      </div>

      {(content.access.address || content.access.parking || content.access.directions || content.access.mapsUrl) && (
          <Card title={isPl ? 'Jak dojechać' : 'Getting here'} icon={<MapPin size={14} />} primaryColor={primaryColor}>
            <div className="space-y-4 text-sm text-slate-800">
              {content.access.address && (
                <p className="font-semibold whitespace-pre-wrap">{content.access.address}</p>
              )}
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-black"
                  style={{ color: primaryColor }}
                >
                  {isPl ? 'Otwórz w Mapach' : 'Open in Maps'}
                  <ExternalLink size={14} />
                </a>
              )}
              {content.access.parking && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1">
                    {isPl ? 'Parking' : 'Parking'}
                  </p>
                  <p className="whitespace-pre-wrap">{content.access.parking}</p>
                </div>
              )}
              {content.access.directions && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1">
                    {isPl ? 'Dojazd' : 'Directions'}
                  </p>
                  <p className="whitespace-pre-wrap">{content.access.directions}</p>
                </div>
              )}
            </div>
          </Card>
        )}

      {events.length > 0 && (
        <Card
          title={isPl ? 'Nadchodzące wydarzenia' : 'Upcoming events'}
          icon={<CalendarDays size={14} />}
          primaryColor={primaryColor}
        >
          <ul className="divide-y divide-slate-100 -mx-6">
            {events.map((item) => (
              <li key={item.id} className="px-6 py-4">
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: primaryColor }}>
                  {item.date}
                </p>
                <p className="font-black text-slate-900 mt-0.5">{item.title}</p>
                {item.description && (
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(content.extras.dressCode || content.extras.allergies || content.extras.privateDining) && (
          <Card title={isPl ? 'Przydatne informacje' : 'Good to know'} primaryColor={primaryColor}>
            <dl className="space-y-4 text-sm">
              {content.extras.dressCode && (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Dress code</dt>
                  <dd className="text-slate-800 whitespace-pre-wrap mt-1">{content.extras.dressCode}</dd>
                </div>
              )}
              {content.extras.allergies && (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    {isPl ? 'Alergie / diety' : 'Allergies / diets'}
                  </dt>
                  <dd className="text-slate-800 whitespace-pre-wrap mt-1">{content.extras.allergies}</dd>
                </div>
              )}
              {content.extras.privateDining && (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    {isPl ? 'Prywatne sale' : 'Private dining'}
                  </dt>
                  <dd className="text-slate-800 whitespace-pre-wrap mt-1">{content.extras.privateDining}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}
    </div>
  );
};

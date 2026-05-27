import React, { useState } from 'react';
import { QrCode, ImageIcon, Star } from 'lucide-react';
import { QRGenerator } from './QRGenerator';
import { UploadLogo } from './UploadLogo';
import { GoogleReviewsSettings } from './GoogleReviewsSettings';

type SettingsSection = 'qr' | 'branding' | 'google';

interface Props {
  userId: string | null;
  restaurantName?: string;
}

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof QrCode;
}[] = [
  { id: 'qr', label: 'Kod QR', icon: QrCode },
  { id: 'branding', label: 'Logo / zdjęcie główne', icon: ImageIcon },
  { id: 'google', label: 'Opinie Google', icon: Star },
];

export const SettingsPanel: React.FC<Props> = ({ userId, restaurantName }) => {
  const [section, setSection] = useState<SettingsSection>('qr');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Ustawienia</h2>
        <p className="text-sm text-slate-500 mt-2">
          Kod QR menu, wygląd nagłówka (logo i cover) oraz opinie Google — każda funkcja w osobnej zakładce.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-slate-200 bg-white shadow-sm"
        role="tablist"
        aria-label="Sekcje ustawień"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                active
                  ? 'bg-chef-dark text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="min-h-[200px]">
        {section === 'qr' && <QRGenerator userId={userId} />}

        {section === 'branding' && userId && (
          <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
            <UploadLogo userId={userId} restaurantName={restaurantName} />
          </div>
        )}

        {section === 'branding' && !userId && (
          <p className="text-sm text-slate-500">Zaloguj się, aby edytować logo i zdjęcie główne.</p>
        )}

        {section === 'google' && (
          <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
            <GoogleReviewsSettings userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
};

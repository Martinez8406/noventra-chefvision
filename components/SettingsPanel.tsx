import React from 'react';
import { QRGenerator } from './QRGenerator';
import { UploadLogo } from './UploadLogo';
import { GoogleReviewsSettings } from './GoogleReviewsSettings';
import { SubscriptionSettings } from './SubscriptionSettings';

export type SettingsSection = 'qr' | 'branding' | 'google' | 'subscription';

interface Props {
  section: SettingsSection;
  userId: string | null;
  restaurantName?: string;
}

const SECTION_TITLES: Record<SettingsSection, { title: string; description: string }> = {
  qr: {
    title: 'Kod QR',
    description: 'Wygeneruj i pobierz kod QR prowadzący do Twojego menu cyfrowego.',
  },
  branding: {
    title: 'Logo / zdjęcie główne',
    description: 'Logo restauracji i zdjęcie cover widoczne na górze Live Menu.',
  },
  google: {
    title: 'Opinie Google',
    description: 'Połącz menu z Google, aby goście mogli zostawiać opinie jednym kliknięciem.',
  },
  subscription: {
    title: 'Zarządzaj subskrypcją',
    description: 'Twój plan, płatności Stripe oraz przejście na Premium.',
  },
};

export const SettingsPanel: React.FC<Props> = ({ section, userId, restaurantName }) => {
  const meta = SECTION_TITLES[section];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ustawienia</p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic mt-1">{meta.title}</h2>
        <p className="text-sm text-slate-500 mt-2">{meta.description}</p>
      </div>

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

      {section === 'subscription' && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <SubscriptionSettings userId={userId} />
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRGenerator } from './QRGenerator';
import { UploadLogo } from './UploadLogo';
import { GoogleReviewsSettings } from './GoogleReviewsSettings';
import { GuestFeedbackSettings } from './GuestFeedbackSettings';
import { SubscriptionSettings } from './SubscriptionSettings';

export type SettingsSection = 'qr' | 'branding' | 'google' | 'feedback' | 'subscription';

interface Props {
  section: SettingsSection;
  userId: string | null;
  restaurantName?: string;
}

export const SettingsPanel: React.FC<Props> = ({ section, userId, restaurantName }) => {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('panelLabel')}</p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic mt-1">
          {t(`sections.${section}.title`)}
        </h2>
        <p className="text-sm text-slate-500 mt-2">{t(`sections.${section}.description`)}</p>
      </div>

      {section === 'qr' && <QRGenerator userId={userId} />}

      {section === 'branding' && userId && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <UploadLogo userId={userId} restaurantName={restaurantName} />
        </div>
      )}

      {section === 'branding' && !userId && (
        <p className="text-sm text-slate-500">{t('loginRequiredBranding')}</p>
      )}

      {section === 'google' && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <GoogleReviewsSettings userId={userId} />
        </div>
      )}

      {section === 'feedback' && <GuestFeedbackSettings userId={userId} />}

      {section === 'subscription' && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <SubscriptionSettings userId={userId} />
        </div>
      )}
    </div>
  );
};

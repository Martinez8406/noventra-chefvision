import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { QRGenerator } from './QRGenerator';
import { UploadLogo } from './UploadLogo';
import { GoogleReviewsSettings } from './GoogleReviewsSettings';
import { GuestFeedbackSettings } from './GuestFeedbackSettings';
import { WaiterCallSettings } from './WaiterCallSettings';
import { SubscriptionSettings } from './SubscriptionSettings';
import { PromoCodesPanel } from './PromoCodesPanel';

export type SettingsSection =
  | 'qr'
  | 'branding'
  | 'google'
  | 'feedback'
  | 'waiter'
  | 'promo'
  | 'subscription';

interface Props {
  section: SettingsSection;
  userId: string | null;
  restaurantName?: string;
  /** Kelner / rachunek — tylko Premium. */
  waiterCallAllowed?: boolean;
  onRequestPremium?: () => void;
}

export const SettingsPanel: React.FC<Props> = ({
  section,
  userId,
  restaurantName,
  waiterCallAllowed = false,
  onRequestPremium,
}) => {
  const { t } = useTranslation('settings');

  const waiterUpsell = (
    <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
        <Lock size={22} />
      </div>
      <p className="text-slate-600 text-sm max-w-md mx-auto">
        Wezwanie kelnera i prośba o rachunek są dostępne w planie{' '}
        <strong>Premium</strong>.
      </p>
      {onRequestPremium && (
        <button
          type="button"
          onClick={onRequestPremium}
          className="inline-flex px-6 py-3 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:from-emerald-300 hover:to-green-400 transition-all"
        >
          Zobacz plany
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('panelLabel')}</p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic mt-1">
          {t(`sections.${section}.title`)}
        </h2>
        <p className="text-sm text-slate-500 mt-2">{t(`sections.${section}.description`)}</p>
      </div>

      {section === 'qr' && (
        <>
          <QRGenerator userId={userId} />
          {waiterCallAllowed ? <WaiterCallSettings userId={userId} /> : waiterUpsell}
        </>
      )}

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

      {section === 'waiter' &&
        (waiterCallAllowed ? <WaiterCallSettings userId={userId} /> : waiterUpsell)}

      {section === 'promo' && <PromoCodesPanel userId={userId} />}

      {section === 'subscription' && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <SubscriptionSettings userId={userId} />
        </div>
      )}
    </div>
  );
};

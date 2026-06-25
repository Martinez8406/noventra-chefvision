import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Download, Share2, Image } from 'lucide-react';
import { buildPublicMenuUrl, getShareCopiedLabel, getShareFailedLabel, sharePublicLink } from '../utils/publicMenuShare';
import type { AppLanguage } from '../i18n';

interface Props {
  userId: string | null;
}

export const QRGenerator: React.FC<Props> = ({ userId }) => {
  const { t, i18n } = useTranslation('settings');
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const shareLocale: AppLanguage = i18n.language.startsWith('en') ? 'en' : 'pl';
  const menuUrl = userId ? buildPublicMenuUrl(userId) : '';

  const handleDownloadPng = () => {
    const canvas = qrContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = 'chefvision-menu-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareLink = async () => {
    if (!menuUrl) return;
    const outcome = await sharePublicLink({
      url: menuUrl,
      title: 'ChefVision — Digital Dining Assistant',
      text: t('qr.shareText'),
    });
    if (outcome === 'copied') setShareFeedback(getShareCopiedLabel(shareLocale));
    else if (outcome === 'failed') setShareFeedback(getShareFailedLabel(shareLocale));
    else setShareFeedback(null);
    if (outcome === 'copied' || outcome === 'failed') {
      window.setTimeout(() => setShareFeedback(null), 2600);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-3xl text-white">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-white/20 p-3 rounded-xl">
          <QrCode size={24} />
        </div>
        <h3 className="text-xl font-bold">{t('qr.title')}</h3>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div ref={qrContainerRef} className="bg-white p-4 rounded-2xl shadow-xl flex-shrink-0">
          {menuUrl && (
            <QRCodeCanvas
              value={menuUrl}
              size={200}
              level="H"
              includeMargin
            />
          )}
        </div>

        <div className="flex-1 space-y-4">
          <p className="text-white/80 text-sm">
            {userId ? t('qr.introLoggedIn') : t('qr.introLoggedOut')}
          </p>
          <div className="bg-black/20 px-4 py-2 rounded-xl text-xs font-mono break-all border border-white/10">
            {menuUrl || (userId ? t('qr.loading') : t('qr.noLink'))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPng}
              className="flex-1 min-w-[180px] bg-white text-indigo-600 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
            >
              <Image size={18} />
              {t('qr.downloadPng')}
            </button>
            <button
              onClick={() => void handleShareLink()}
              className="bg-indigo-400 text-white py-3 px-4 rounded-xl hover:bg-indigo-300 transition-colors flex items-center gap-2"
            >
              <Share2 size={18} />
              {shareFeedback || t('qr.shareLink')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

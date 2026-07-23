import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Share2, Image, Download } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import {
  buildPublicMenuUrl,
  getShareCopiedLabel,
  getShareFailedLabel,
  sharePublicLink,
} from '../utils/publicMenuShare';
import type { AppLanguage } from '../i18n';

interface Props {
  userId: string | null;
}

export const QRGenerator: React.FC<Props> = ({ userId }) => {
  const { t, i18n } = useTranslation('settings');
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const tableQrRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [tableCountInput, setTableCountInput] = useState('10');
  const [activeTableCount, setActiveTableCount] = useState(0);
  const [isSavingCount, setIsSavingCount] = useState(false);

  const shareLocale: AppLanguage = i18n.language.startsWith('en') ? 'en' : 'pl';
  const menuUrl = userId ? buildPublicMenuUrl(userId, { usePathRouting: true }) : '';

  useEffect(() => {
    if (!userId || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('waiter_table_count')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      const n = Number(data?.waiter_table_count);
      if (Number.isFinite(n) && n >= 1 && n <= 100) {
        setTableCountInput(String(n));
        setActiveTableCount(n);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const handleGenerateTables = async () => {
    const n = Math.min(100, Math.max(1, Math.floor(Number(tableCountInput) || 0)));
    if (!n) return;
    setTableCountInput(String(n));
    setActiveTableCount(n);
    if (userId && supabase) {
      setIsSavingCount(true);
      await supabase.from('profiles').update({ waiter_table_count: n }).eq('id', userId);
      setIsSavingCount(false);
    }
  };

  const downloadTableQr = (table: number) => {
    const canvas = tableQrRefs.current[table]?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `chefvision-stolik-${table}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllTableQrs = () => {
    for (let i = 1; i <= activeTableCount; i += 1) {
      window.setTimeout(() => downloadTableQr(i), i * 120);
    }
  };

  return (
    <div className="space-y-6">
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
              <QRCodeCanvas value={menuUrl} size={200} level="H" includeMargin />
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
                type="button"
                onClick={handleDownloadPng}
                className="flex-1 min-w-[180px] bg-white text-indigo-600 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
              >
                <Image size={18} />
                {t('qr.downloadPng')}
              </button>
              <button
                type="button"
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

      {userId && (
        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900">{t('qr.tablesTitle')}</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">{t('qr.tablesIntro')}</p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                {t('qr.tableCountLabel')}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={tableCountInput}
                onChange={(e) => setTableCountInput(e.target.value)}
                className="w-28 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateTables()}
              disabled={isSavingCount}
              className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
            >
              {t('qr.generateTables')}
            </button>
            {activeTableCount > 0 && (
              <button
                type="button"
                onClick={downloadAllTableQrs}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"
              >
                <Download size={14} />
                {t('qr.downloadAllTables')}
              </button>
            )}
          </div>

          {activeTableCount > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: activeTableCount }, (_, i) => i + 1).map((table) => {
                const url = buildPublicMenuUrl(userId, {
                  usePathRouting: true,
                  table,
                });
                return (
                  <div
                    key={table}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3 flex flex-col items-center gap-2"
                  >
                    <div
                      ref={(el) => {
                        tableQrRefs.current[table] = el;
                      }}
                      className="bg-white p-2 rounded-xl"
                    >
                      <QRCodeCanvas value={url} size={120} level="M" includeMargin />
                    </div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      {t('qr.tableLabel', { number: table })}
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadTableQr(table)}
                      className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                    >
                      {t('qr.downloadTable')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

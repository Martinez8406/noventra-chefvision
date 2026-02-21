import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Download, Share2, Image } from 'lucide-react';

interface Props {
  userId: string | null;
}

export const QRGenerator: React.FC<Props> = ({ userId }) => {
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`
    : '';
  const menuUrl = userId && baseUrl ? `${baseUrl}/#/menu/${userId}` : '';

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

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-3xl text-white">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-white/20 p-3 rounded-xl">
          <QrCode size={24} />
        </div>
        <h3 className="text-xl font-bold">Twój Generator QR Menu</h3>
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
            {userId
              ? 'Zeskanuj kod powyżej lub udostępnij ten link swoim gościom, aby mogli przeglądać Twoje menu online.'
              : 'Zaloguj się, aby wygenerować unikalny link i kod QR do Twojego menu.'}
          </p>
          <div className="bg-black/20 px-4 py-2 rounded-xl text-xs font-mono break-all border border-white/10">
            {menuUrl || (userId ? 'Ładowanie...' : 'Brak linku – zaloguj się')}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPng}
              className="flex-1 min-w-[180px] bg-white text-indigo-600 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
            >
              <Image size={18} />
              Pobierz jako obraz PNG
            </button>
            <button className="bg-indigo-400 text-white py-3 px-4 rounded-xl hover:bg-indigo-300 transition-colors flex items-center gap-2">
              <Share2 size={18} />
              Udostępnij link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

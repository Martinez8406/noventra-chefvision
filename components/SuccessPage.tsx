import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import { confirmPremiumSession } from '../services/stripeService';
import { authService } from '../services/supabaseService';

interface Props {
  onBack: () => void;
  /** Po udanym potwierdzeniu Premium – odśwież profil w App.tsx */
  onPremiumActivated?: () => void;
}

export const SuccessPage: React.FC<Props> = ({ onBack, onPremiumActivated }) => {
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = window.location.search || window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      setConfirming(false);
      return;
    }

    confirmPremiumSession(sessionId)
      .then(async ({ ok, userId }) => {
        if (ok && userId) {
          // Zapisz Premium w bazie (jeśli Supabase działa)
          const updated = await authService.setPremiumStatus(userId);
          // Zawsze ustaw lokalny znacznik Premium – na wypadek problemów z webhookiem / RLS
          if (typeof window !== 'undefined') {
            localStorage.setItem('chefvision_premium', '1');
          }
          if (updated) {
            await onPremiumActivated?.();
          }
        }
      })
      .catch((err) => setError(err.message || 'Błąd weryfikacji płatności.'))
      .finally(() => setConfirming(false));
  }, []);

  if (confirming) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="animate-spin text-amber-500" size={48} />
        <p className="mt-4 text-slate-500 font-medium">Aktywujemy Twoje konto Premium...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-xl border border-slate-100 p-10 text-center space-y-8">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-600">
          <CheckCircle size={48} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">Płatność zakończona</h1>
          <p className="text-slate-500 font-medium">
            {error ? error : 'Dziękujemy! Twoje konto Premium jest aktywne.'}
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
        >
          <img src={BRAND_LOGO_SRC} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded object-cover shrink-0" /> Wróć do Chefvision
        </button>
      </div>
    </div>
  );
};

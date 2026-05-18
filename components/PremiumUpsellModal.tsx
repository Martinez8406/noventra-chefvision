import React, { useEffect } from 'react';
import { Check, Crown, X } from 'lucide-react';

export const PREMIUM_UPSELL_FEATURES = [
  'Profesjonalne zdjęcia AI',
  'Usuwanie watermarku',
  'Studio tła AI',
  'Motywy sezonowe',
  'Rekomendacje sprzedażowe',
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const PremiumUpsellModal: React.FC<Props> = ({ open, onClose, onUpgrade }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-upsell-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-chef-dark/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Zamknij"
      />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_40px_rgba(52,211,153,0.08)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Zamknij"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-chef-gold/15 border border-chef-gold/30 flex items-center justify-center text-chef-gold shrink-0">
            <Crown size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Premium</p>
            <h2 id="premium-upsell-title" className="text-xl font-black text-white tracking-tight">
              Odblokuj ChefVision Premium
            </h2>
          </div>
        </div>

        <ul className="space-y-3 mb-8">
          {PREMIUM_UPSELL_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-zinc-200">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="font-semibold">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center">
          <p className="text-3xl font-black text-white tracking-tight">
            97 zł
            <span className="text-base font-bold text-zinc-400"> / miesiąc</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onUpgrade();
          }}
          className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_28px_rgba(52,211,153,0.45)] hover:from-emerald-300 hover:to-green-400 transition-all active:scale-[0.98]"
        >
          Przejdź do Premium
        </button>
      </div>
    </div>
  );
};

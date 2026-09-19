import React from 'react';

interface DishLite {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

interface Props {
  restaurantName: string;
  logoUrl?: string | null;
  firstName: string;
  headline: string;
  message: string;
  offerText: string;
  validLabel: string;
  dish: DishLite | null;
  ctaLabel: string;
  compact?: boolean;
}

export const CampaignEmailPreview: React.FC<Props> = ({
  restaurantName,
  logoUrl,
  firstName,
  headline,
  message,
  offerText,
  validLabel,
  dish,
  ctaLabel,
  compact,
}) => {
  const greeting = firstName.trim() ? `Cześć ${firstName.trim()},` : 'Cześć,';
  return (
    <div className={`bg-white text-slate-900 ${compact ? 'max-w-[360px]' : 'max-w-[520px]'} mx-auto rounded-[28px] border border-slate-200 overflow-hidden shadow-sm`}>
      <div className="px-6 pt-7 pb-2 text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover mx-auto" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-chef-gold mx-auto flex items-center justify-center text-lg font-black">
            {(restaurantName || 'R').slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-chef-gold">{restaurantName || 'Restauracja'}</p>
      </div>
      <div className="px-6 pb-6 space-y-3">
        <p className="text-sm text-slate-500">{greeting}</p>
        <h3 className="text-2xl font-black leading-tight">{headline || 'Nagłówek kampanii'}</h3>
        {dish?.imageUrl ? (
          <img src={dish.imageUrl} alt="" className="w-full h-44 object-cover rounded-[22px]" />
        ) : null}
        {dish?.name ? <p className="font-black text-lg">{dish.name}</p> : null}
        {dish?.description ? <p className="text-sm text-slate-500 leading-relaxed">{dish.description.slice(0, 220)}</p> : null}
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{message || 'Treść wiadomości…'}</p>
        {offerText ? (
          <div className="rounded-2xl bg-[#f7f1e6] text-[#3b2f1a] px-4 py-3 font-bold">
            {offerText}
            {validLabel ? <p className="text-xs font-medium text-[#6b5a3d] mt-1">{validLabel}</p> : null}
          </div>
        ) : validLabel ? (
          <p className="text-xs text-[#6b5a3d]">{validLabel}</p>
        ) : null}
        <div className="pt-2 text-center">
          <span className="inline-flex px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2">
            {ctaLabel || 'Zobacz w menu'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 pt-2">
          Stopka maila zawiera bezpieczny link wypisu z Klubu gości Premium.
        </p>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { PublicMenuLocale } from '../types';
import { GuestFeedbackModal } from './GuestFeedbackModal';

interface Props {
  restaurantId: string;
  primaryColor?: string;
  menuLocale?: PublicMenuLocale;
}

export const GuestFeedbackSection: React.FC<Props> = ({
  restaurantId,
  primaryColor = '#6366f1',
  menuLocale = 'pl',
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const isPolishLocale = menuLocale === 'pl';
  const labels = isPolishLocale
    ? {
        title: 'Masz uwagi?',
        description:
          'Podziel się swoją opinią lub sugestią. Twoja wiadomość trafi bezpośrednio do managera restauracji.',
        button: 'Wyślij wiadomość',
      }
    : {
        title: 'Have feedback?',
        description:
          'Share your opinion or suggestion. Your message will go directly to the restaurant manager.',
        button: 'Send message',
      };

  return (
    <>
      <section className="w-full max-w-2xl mx-auto mt-10 mb-4 px-2">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.18)] text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/10"
            style={{ backgroundColor: `${primaryColor}22`, color: primaryColor }}
          >
            <MessageSquareText size={22} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{labels.title}</h2>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
            {labels.description}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-6 inline-flex items-center justify-center px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide text-[#0a1a12] bg-gradient-to-r from-chef-gold to-chef-gold2 hover:from-chef-gold2 hover:to-chef-gold transition-all active:scale-[0.98] shadow-lg shadow-chef-gold/20"
          >
            {labels.button}
          </button>
        </div>
      </section>

      <GuestFeedbackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        restaurantId={restaurantId}
      />
    </>
  );
};

import React from 'react';
import { BRAND_LOGO_SRC } from '../constants';

/**
 * Pełnoekranowy szkielet menu publicznego — bez domyślnego branding restauracji
 * ani listy kategorii, dopóki dane z Supabase nie są gotowe.
 */
export const PublicMenuSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-20 animate-pulse">
        <div className="h-56 sm:h-72 lg:h-80 rounded-[30px] bg-slate-200/80 shadow-2xl border border-black/5" />

        <div className="px-2 sm:px-6 -mt-14 sm:-mt-16 relative z-10 flex items-end gap-4 sm:gap-5">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-slate-300/90 border-4 border-white shadow-xl shrink-0" />
          <div className="min-w-0 pb-2 flex-1 space-y-3">
            <div className="h-9 sm:h-11 w-3/4 max-w-md rounded-xl bg-slate-200" />
            <div className="h-4 w-1/3 max-w-[10rem] rounded-lg bg-slate-200/80" />
          </div>
        </div>

        <div className="pt-10 sm:pt-12 space-y-14">
          {[0, 1].map((section) => (
            <section key={section} className="space-y-8">
              <div className="space-y-3">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="h-px w-full bg-slate-200/70" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {[0, 1, 2].map((card) => (
                  <div key={card} className="space-y-4">
                    <div className="aspect-[4/3] rounded-3xl bg-slate-200/90" />
                    <div className="h-5 w-4/5 rounded-lg bg-slate-200" />
                    <div className="h-4 w-full rounded-lg bg-slate-200/80" />
                    <div className="h-4 w-2/3 rounded-lg bg-slate-200/70" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-8 pointer-events-none"
        aria-hidden
      >
        <img
          src={BRAND_LOGO_SRC}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-xl object-cover opacity-80"
        />
        <p className="text-slate-400 text-sm font-medium tracking-wide">Ładowanie menu…</p>
      </div>
    </div>
  );
};

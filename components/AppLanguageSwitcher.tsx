import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../i18n';

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'pl', label: 'PL' },
  { code: 'en', label: 'EN' },
];

export const AppLanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation('sidebar');
  const current: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'pl';

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {t('language')}
      </span>
      <div
        className="flex rounded-lg border border-white/10 overflow-hidden"
        role="group"
        aria-label={t('language')}
      >
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => void i18n.changeLanguage(code)}
            aria-pressed={current === code}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
              current === code
                ? 'bg-white/15 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

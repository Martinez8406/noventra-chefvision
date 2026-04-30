import React, { useEffect, useRef, useState } from 'react';
import type { PublicMenuLocale } from '../types';

const OPTIONS: { locale: PublicMenuLocale; label: string }[] = [
  { locale: 'pl', label: 'Polski' },
  { locale: 'en', label: 'English' },
  { locale: 'uk', label: 'Українська' },
  { locale: 'de', label: 'Deutsch' },
  { locale: 'es', label: 'Español' },
  { locale: 'it', label: 'Italiano' },
  { locale: 'ko', label: '한국어' },
  { locale: 'fr', label: 'Français' },
  { locale: 'zh', label: '中文 (简体)' },
];

function optionFor(locale: PublicMenuLocale) {
  return OPTIONS.find((o) => o.locale === locale)!;
}

/** Pełnokolorowe flagi (SVG), bez emoji — stałe barwy narodowe. */
function FlagSvg({ locale }: { locale: PublicMenuLocale }) {
  const cls = 'h-6 w-9 shrink-0 rounded-[4px] shadow-md ring-1 ring-black/20';
  switch (locale) {
    case 'pl':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="5" fill="#ffffff" />
          <rect y="5" width="16" height="5" fill="#dc143c" />
        </svg>
      );
    case 'de':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="3.333" fill="#000000" />
          <rect y="3.333" width="16" height="3.333" fill="#dd0000" />
          <rect y="6.666" width="16" height="3.334" fill="#ffce00" />
        </svg>
      );
    case 'uk':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="5" fill="#0057b7" />
          <rect y="5" width="16" height="5" fill="#ffd700" />
        </svg>
      );
    case 'en':
      /* Union Jack (uproszczony) — niebieski, biało-czerwone krzyże */
      return (
        <svg className={cls} viewBox="0 0 60 30" aria-hidden>
          <rect width="60" height="30" fill="#012169" />
          <path fill="none" stroke="#ffffff" strokeWidth="6" d="M0 0 L60 30 M60 0 L0 30" />
          <path fill="none" stroke="#c8102e" strokeWidth="4" d="M0 0 L60 30 M60 0 L0 30" />
          <path fill="none" stroke="#ffffff" strokeWidth="10" d="M30 0 V30 M0 15 H60" />
          <path fill="none" stroke="#c8102e" strokeWidth="6" d="M30 0 V30 M0 15 H60" />
        </svg>
      );
    case 'es':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="2.5" fill="#c60b1e" />
          <rect y="2.5" width="16" height="5" fill="#ffc400" />
          <rect y="7.5" width="16" height="2.5" fill="#c60b1e" />
        </svg>
      );
    case 'it':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="5.333" height="10" fill="#009246" />
          <rect x="5.333" width="5.334" height="10" fill="#ffffff" />
          <rect x="10.667" width="5.333" height="10" fill="#ce2b37" />
        </svg>
      );
    case 'ko':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="10" fill="#ffffff" />
          <circle cx="8" cy="5" r="2.1" fill="#cd2e3a" />
          <path d="M8 2.9a2.1 2.1 0 0 0 0 4.2a2.1 2.1 0 0 1 0-4.2z" fill="#0047a0" />
        </svg>
      );
    case 'fr':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="5.333" height="10" fill="#0055a4" />
          <rect x="5.333" width="5.334" height="10" fill="#ffffff" />
          <rect x="10.667" width="5.333" height="10" fill="#ef4135" />
        </svg>
      );
    case 'zh':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="10" fill="#de2910" />
          <polygon points="3,2 3.5,3.3 4.9,3.3 3.8,4.1 4.2,5.4 3,4.6 1.8,5.4 2.2,4.1 1.1,3.3 2.5,3.3" fill="#ffde00" />
        </svg>
      );
    default:
      return null;
  }
}

interface Props {
  value: PublicMenuLocale;
  onChange: (locale: PublicMenuLocale) => void;
}

/**
 * Przełącznik języka: jedna widoczna flaga (aktualny język, domyślnie PL),
 * po kliknięciu rozwija się lista z trzema pozostałymi językami.
 */
export const MenuLanguageSwitcher: React.FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = optionFor(value);
  const others = OPTIONS.filter((o) => o.locale !== value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (locale: PublicMenuLocale) => {
    onChange(locale);
    setOpen(false);
  };

  const btnClass =
    'flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-lg ring-2 ring-slate-800/25 transition hover:bg-white hover:ring-slate-800/40';

  return (
    <div
      ref={rootRef}
      className="fixed top-4 right-4 z-[110]"
      role="group"
      aria-label="Język menu"
    >
      <button
        type="button"
        title={current.label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="menu-lang-list"
        onClick={() => setOpen((o) => !o)}
        className={btnClass}
      >
        <FlagSvg locale={value} />
        <span className="sr-only">{current.label}</span>
      </button>

      {open && (
        <ul
          id="menu-lang-list"
          role="listbox"
          className="absolute right-0 top-full mt-2 flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white/98 p-2 shadow-xl ring-1 ring-black/10"
        >
          {others.map(({ locale, label }) => (
            <li key={locale} role="option" aria-selected={value === locale}>
              <button
                type="button"
                title={label}
                onClick={() => pick(locale)}
                className={`${btnClass} w-full min-w-[2.75rem]`}
              >
                <FlagSvg locale={locale} />
                <span className="sr-only">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

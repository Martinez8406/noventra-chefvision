import React, { useEffect, useRef, useState } from 'react';
import type { PublicMenuLocale } from '../types';

const OPTIONS: { locale: PublicMenuLocale; label: string }[] = [
  { locale: 'pl', label: 'Polski' },
  { locale: 'en', label: 'English (UK)' },
  { locale: 'he', label: 'עברית' },
  { locale: 'zh', label: '中文 (简体)' },
  { locale: 'uk', label: 'Українська' },
  { locale: 'de', label: 'Deutsch' },
  { locale: 'es', label: 'Español' },
  { locale: 'it', label: 'Italiano' },
  { locale: 'ko', label: '한국어' },
  { locale: 'ja', label: '日本語' },
  { locale: 'fr', label: 'Français' },
  { locale: 'cs', label: 'Čeština' },
  { locale: 'nl', label: 'Nederlands' },
  { locale: 'ar', label: 'العربية' },
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
    case 'he':
      /* Flaga Izraela — białe pole, niebieskie pasy, Gwiazda Dawida */
      return (
        <svg className={cls} viewBox="0 0 22 16" aria-hidden>
          <rect width="22" height="16" fill="#ffffff" />
          <rect width="22" height="2.2" fill="#0038b8" />
          <rect y="13.8" width="22" height="2.2" fill="#0038b8" />
          <g fill="#0038b8" transform="translate(11 8)">
            <path d="M0,-3.5 L3.03,1.75 L-3.03,1.75 Z" />
            <path d="M0,3.5 L-3.03,-1.75 L3.03,-1.75 Z" />
          </g>
        </svg>
      );
    case 'ar':
      /* Flaga Ligi Państw Arabskich (stylizowana): zielone pole + biały emblemat */
      return (
        <svg className={cls} viewBox="0 0 22 16" aria-hidden>
          <rect width="22" height="16" fill="#007a3d" />
          <circle cx="11" cy="8" r="3.1" fill="none" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M9.8 8a1.45 1.45 0 1 0 0-2.9 1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 1 0 0 2.5" fill="#ffffff" />
          <path d="M12.45 7.95l0.85-0.45-0.16 0.95 0.68 0.7-0.94 0.13-0.43 0.85-0.43-0.85-0.94-0.13 0.68-0.7-0.16-0.95z" fill="#ffffff" />
          <path d="M7 8a4.15 4.15 0 0 1 1.45-3.15M15 8a4.15 4.15 0 0 0-1.45-3.15M7 8a4.15 4.15 0 0 0 1.45 3.15M15 8a4.15 4.15 0 0 1-1.45 3.15" stroke="#ffffff" strokeWidth="0.45" fill="none" strokeLinecap="round" />
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
      /* Flaga Korei Południowej (Taegukgi): taegeuk + uproszczone trigramy — nie mylić z hinomaru (JP). */
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="10" fill="#ffffff" />
          <g transform="translate(8 5)">
            <path
              fill="#cd2e3a"
              d="M0,-2.1 A2.1,2.1 0 1,1 0,2.1 A1.05,1.05 0 1,1 0,0 A1.05,1.05 0 1,0 0,-2.1z"
            />
            <path
              fill="#0047a0"
              d="M0,2.1 A2.1,2.1 0 1,1 0,-2.1 A1.05,1.05 0 1,0 0,0 A1.05,1.05 0 1,1 0,2.1z"
            />
            <circle cx="0" cy="-1.05" r="1.05" fill="#0047a0" />
            <circle cx="0" cy="1.05" r="1.05" fill="#cd2e3a" />
          </g>
          <g fill="#000000" opacity={0.88}>
            <rect x="1.35" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="1.85" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="2.35" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="13.33" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="13.83" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="14.33" y="1.55" width="0.32" height="0.95" rx="0.04" />
            <rect x="1.35" y="7.5" width="0.32" height="0.95" rx="0.04" />
            <rect x="1.85" y="7.5" width="0.32" height="0.95" rx="0.04" />
            <rect x="2.35" y="7.5" width="0.32" height="0.95" rx="0.04" />
            <rect x="13.33" y="7.5" width="0.32" height="0.95" rx="0.04" />
            <rect x="13.83" y="7.5" width="0.32" height="0.95" rx="0.04" />
            <rect x="14.33" y="7.5" width="0.32" height="0.95" rx="0.04" />
          </g>
        </svg>
      );
    case 'ja':
      /* Hinomaru */
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="10" fill="#ffffff" />
          <circle cx="8" cy="5" r="2.55" fill="#bc002d" />
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
    case 'cs':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="5" fill="#ffffff" />
          <rect y="5" width="16" height="5" fill="#d7141a" />
          <polygon points="0,0 7,5 0,10" fill="#11457e" />
        </svg>
      );
    case 'nl':
      return (
        <svg className={cls} viewBox="0 0 16 10" aria-hidden>
          <rect width="16" height="3.333" fill="#ae1c28" />
          <rect y="3.333" width="16" height="3.333" fill="#ffffff" />
          <rect y="6.666" width="16" height="3.334" fill="#21468b" />
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
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-lg ring-2 ring-slate-800/25 transition hover:bg-white hover:ring-slate-800/40';

  const isRtlFlagAnchor = value === 'he' || value === 'ar';

  return (
    <div
      ref={rootRef}
      className={`fixed top-4 z-[110] w-11 ${
        isRtlFlagAnchor ? 'left-4 right-auto sm:left-6' : 'right-4 left-auto sm:right-6'
      }`}
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
          className={`absolute top-full mt-2 flex w-11 flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white/98 p-2 shadow-xl ring-1 ring-black/10 ${
            isRtlFlagAnchor ? 'start-0' : 'end-0'
          }`}
        >
          {others.map(({ locale, label }) => (
            <li key={locale} role="option" aria-selected={value === locale} className="flex justify-center">
              <button
                type="button"
                title={label}
                onClick={() => pick(locale)}
                className={btnClass}
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

import React, { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import type { PublicMenuLocale } from '../types';
import {
  getShareButtonLabel,
  getShareCopiedLabel,
  getShareFailedLabel,
  sharePublicLink,
  type ShareLinkOutcome,
} from '../utils/publicMenuShare';

interface Props {
  url: string;
  title: string;
  text?: string;
  menuLocale?: PublicMenuLocale;
  variant?: 'fab' | 'pill' | 'compact';
  className?: string;
  onShareOutcome?: (outcome: ShareLinkOutcome) => void;
}

export const ShareLinkButton: React.FC<Props> = ({
  url,
  title,
  text,
  menuLocale = 'pl',
  variant = 'pill',
  className = '',
  onShareOutcome,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setFeedback(null), 2600);
  };

  const handleShare = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !url) return;

    setBusy(true);
    try {
      const outcome = await sharePublicLink({ url, title, text });
      onShareOutcome?.(outcome);

      if (outcome === 'copied') showFeedback(getShareCopiedLabel(menuLocale));
      else if (outcome === 'failed') showFeedback(getShareFailedLabel(menuLocale));
    } finally {
      setBusy(false);
    }
  };

  const label = getShareButtonLabel(menuLocale);

  const baseButtonClass =
    variant === 'fab'
      ? 'flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 p-1.5 text-slate-900 shadow-lg ring-2 ring-slate-800/25 transition hover:bg-white hover:ring-slate-800/40 disabled:opacity-60'
      : variant === 'compact'
        ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60'
        : 'inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60';

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(event) => void handleShare(event)}
        disabled={busy}
        aria-label={label}
        title={label}
        className={baseButtonClass}
      >
        <Share2 size={variant === 'fab' ? 20 : 16} aria-hidden />
        {variant === 'pill' && <span>{label}</span>}
        {variant !== 'pill' && <span className="sr-only">{label}</span>}
      </button>

      {feedback && (
        <div
          role="status"
          className="toast-in pointer-events-none absolute bottom-full left-1/2 z-[130] mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white shadow-xl"
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

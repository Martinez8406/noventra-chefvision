import type { PublicMenuLocale } from '../types';

export type ShareLinkOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildPublicMenuUrl(
  userId: string,
  options?: { dishId?: string | null; usePathRouting?: boolean; hubSectionId?: string | null }
): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.chefvision.pl';
  const pathBase =
    typeof window !== 'undefined'
      ? `${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`
      : '';
  const encodedUserId = encodeURIComponent(userId);
  const hubSegment = options?.hubSectionId
    ? `/hub/${encodeURIComponent(options.hubSectionId)}`
    : '';
  const dishSegment = options?.dishId
    ? `/dish/${encodeURIComponent(options.dishId)}`
    : '';

  if (options?.usePathRouting) {
    return `${origin}/menu/${encodedUserId}${hubSegment}${dishSegment}`;
  }

  return `${origin}${pathBase}#/menu/${encodedUserId}${hubSegment}${dishSegment}`;
}

const SHARE_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Udostępnij',
  en: 'Share it',
  he: 'Share it',
  ar: 'Share it',
  uk: 'Поділитися',
  de: 'Teilen',
  es: 'Compartir',
  it: 'Condividi',
  ko: '공유',
  ja: '共有',
  fr: 'Partager',
  cs: 'Sdílet',
  nl: 'Delen',
  zh: '分享',
};

const SHARE_MENU_TEXT: Record<PublicMenuLocale, string> = {
  pl: 'Cyfrowe menu',
  en: 'Digital menu',
  he: 'Digital menu',
  ar: 'Digital menu',
  uk: 'Цифрове меню',
  de: 'Digitale Speisekarte',
  es: 'Menú digital',
  it: 'Menu digitale',
  ko: '디지털 메뉴',
  ja: 'デジタルメニュー',
  fr: 'Menu digital',
  cs: 'Digitální menu',
  nl: 'Digitaal menu',
  zh: '数字菜单',
};

const COPIED_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Link skopiowany!',
  en: 'Link copied!',
  he: 'Link copied!',
  ar: 'Link copied!',
  uk: 'Посилання скопійовано!',
  de: 'Link kopiert!',
  es: '¡Enlace copiado!',
  it: 'Link copiato!',
  ko: '링크가 복사되었습니다!',
  ja: 'リンクをコピーしました！',
  fr: 'Lien copié !',
  cs: 'Odkaz zkopírován!',
  nl: 'Link gekopieerd!',
  zh: '链接已复制！',
};

const FAILED_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Nie udało się udostępnić linku',
  en: 'Could not share the link',
  he: 'Could not share the link',
  ar: 'Could not share the link',
  uk: 'Не вдалося поділитися посиланням',
  de: 'Link konnte nicht geteilt werden',
  es: 'No se pudo compartir el enlace',
  it: 'Impossibile condividere il link',
  ko: '링크를 공유할 수 없습니다',
  ja: 'リンクを共有できませんでした',
  fr: 'Impossible de partager le lien',
  cs: 'Odkaz se nepodařilo sdílet',
  nl: 'Link kon niet worden gedeeld',
  zh: '无法分享链接',
};

export function getShareButtonLabel(locale: PublicMenuLocale = 'pl'): string {
  return SHARE_LABEL[locale] || SHARE_LABEL.en;
}

export function getShareCopiedLabel(locale: PublicMenuLocale = 'pl'): string {
  return COPIED_LABEL[locale] || COPIED_LABEL.en;
}

export function getShareFailedLabel(locale: PublicMenuLocale = 'pl'): string {
  return FAILED_LABEL[locale] || FAILED_LABEL.en;
}

export function getShareMenuText(locale: PublicMenuLocale = 'pl'): string {
  return SHARE_MENU_TEXT[locale] || SHARE_MENU_TEXT.en;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function sharePublicLink(params: {
  url: string;
  title: string;
  text?: string;
}): Promise<ShareLinkOutcome> {
  const { url, title, text } = params;
  const shareText = text || title;

  if (navigator.share) {
    try {
      const payload: ShareData = { url, title, text: shareText };
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'shared';
      }
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  const copied = await copyTextToClipboard(url);
  return copied ? 'copied' : 'failed';
}

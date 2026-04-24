/**
 * Helpery działające po stronie przeglądarki:
 * - konwersja data URL ↔ File,
 * - pobranie HTTPS (np. Supabase Storage) i zamiana na data URL (serwer AI
 *   akceptuje TYLKO data URL — patrz parseImagePart w api/generate-image.js),
 * - znak wodny dla kont free/trial po wyczerpaniu kredytów.
 */

export const safeImageFileBase = (name: string): string =>
  name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim().slice(0, 80) || 'danie';

export async function dataUrlToFile(dataUrl: string, baseName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes('jpeg')
    ? 'jpg'
    : blob.type.includes('webp')
      ? 'webp'
      : 'png';
  const mime = blob.type || 'image/png';
  return new File([blob], `${baseName}.${ext}`, { type: mime });
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Nie udało się pobrać obrazu (HTTP ${res.status}).`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Błąd konwersji obrazu na data URL.'));
    reader.readAsDataURL(blob);
  });
}

export function addFreeWatermark(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.drawImage(img, 0, 0);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.font = 'bold 80px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.textAlign = 'center';
      for (let i = -5; i < 5; i++) {
        for (let j = -5; j < 5; j++) ctx.fillText('CHEFVISION', i * 600, j * 300);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(canvas.width - 400, canvas.height - 80, 400, 80);
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillStyle = '#FBB02D';
      ctx.fillText('STWORZONE W CHEFVISION FREE', canvas.width - 380, canvas.height - 35);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
  });
}

/** Wywołanie natywnego menu udostępniania (Web Share API ze zdjęciem). */
export type NativeShareOutcome = 'shared' | 'cancelled' | 'unavailable';

export async function shareImageViaSystem(
  dataUrl: string,
  title: string
): Promise<NativeShareOutcome> {
  try {
    const file = await dataUrlToFile(dataUrl, safeImageFileBase(title));
    const data: ShareData = { files: [file], title: title || 'Danie', text: 'Zdjęcie z Chefvision' };
    if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) return 'unavailable';
    await navigator.share(data);
    return 'shared';
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err?.name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

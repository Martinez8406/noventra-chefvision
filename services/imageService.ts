const MAX_SIZE_BYTES = 1024 * 1024; // 1MB
const MAX_WIDTH = 1200;
const QUALITY_START = 0.85;

/**
 * Kompresuje obraz do max 1MB – optymalne ładowanie na telefonach.
 * Zwraca data URL (base64) gotowy do uploadu.
 */
export async function compressImageForUpload(file: File, maxSizeBytes = MAX_SIZE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_WIDTH) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_WIDTH) / height);
          height = MAX_WIDTH;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(img, 0, 0, width, height);

      let quality = QUALITY_START;
      const maxBase64Len = Math.floor(maxSizeBytes * (4 / 3));
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxBase64Len && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => reject(new Error('Nie można załadować obrazu'));
    img.src = URL.createObjectURL(file);
  });
}

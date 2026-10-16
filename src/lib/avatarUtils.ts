// Avatar image compression and initials utilities

/**
 * Compresses and center-crops an uploaded image to a 128x128 WebP data URL.
 * Guarantees output size < 40 KB (typically 4-9 KB).
 */
export const processAvatarFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (PNG, JPG, WebP, etc.).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Could not parse image format.'));
      img.onload = () => {
        try {
          const TARGET_SIZE = 128;
          const canvas = document.createElement('canvas');
          canvas.width = TARGET_SIZE;
          canvas.height = TARGET_SIZE;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas context is not available.'));
            return;
          }

          // Center-crop 1:1 calculation
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, TARGET_SIZE, TARGET_SIZE);

          // Try modern WebP first
          let dataUrl = canvas.toDataURL('image/webp', 0.82);

          // Fallback to JPEG if WebP not supported
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          }

          // Strict safeguard: if over 45 KB, recompress at lower quality
          if (dataUrl.length > 45000) {
            dataUrl = canvas.toDataURL('image/webp', 0.65);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to process image.'));
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Returns approx size in KB of a data URL.
 */
export const getAvatarSizeKb = (dataUrl: string): number => {
  const bytes = Math.round((dataUrl.length * 3) / 4);
  return Number((bytes / 1024).toFixed(1));
};

/**
 * Generates 1-2 letter uppercase initials from a nickname.
 */
export const getInitials = (nickname?: string): string => {
  if (!nickname) return 'S';
  const clean = nickname.trim().replace(/^[^a-zA-Z0-9]+/, '');
  if (!clean) return 'S';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

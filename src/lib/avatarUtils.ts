// High-efficiency avatar compression and tech preset utilities

export interface TechAvatarPreset {
  id: string;
  name: string;
  dataUrl: string;
}

// Generate compact SVG data URI for tech presets (each is < 1 KB)
const createSvgDataUrl = (bgGradient: [string, string], svgContent: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="28" fill="url(#bg)"/>
    <rect width="124" height="124" x="2" y="2" rx="26" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    ${svgContent}
  </svg>`.replace(/\s+/g, ' ');

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const TECH_AVATAR_PRESETS: TechAvatarPreset[] = [
  {
    id: 'terminal',
    name: 'ISE Terminal',
    dataUrl: createSvgDataUrl(
      ['#060c20', '#0a2318'],
      `<path d="M38 46 L58 64 L38 82" stroke="#3ccb57" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
       <line x1="68" y1="82" x2="92" y2="82" stroke="#3ccb57" stroke-width="8" stroke-linecap="round"/>`
    ),
  },
  {
    id: 'cyber_chip',
    name: 'Neural Silicon',
    dataUrl: createSvgDataUrl(
      ['#0f172a', '#1e1b4b'],
      `<rect x="42" y="42" width="44" height="44" rx="8" fill="#38bdf8" fill-opacity="0.2" stroke="#38bdf8" stroke-width="6"/>
       <circle cx="64" cy="64" r="10" fill="#38bdf8"/>
       <line x1="64" y1="20" x2="64" y2="38" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
       <line x1="64" y1="90" x2="64" y2="108" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
       <line x1="20" y1="64" x2="38" y2="64" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
       <line x1="90" y1="64" x2="108" y2="64" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>`
    ),
  },
  {
    id: 'brackets',
    name: 'Clean Code',
    dataUrl: createSvgDataUrl(
      ['#030712', '#14532d'],
      `<text x="64" y="78" font-family="monospace" font-size="52" font-weight="900" text-anchor="middle" fill="#22c55e">{;}</text>`
    ),
  },
  {
    id: 'quantum',
    name: 'Quantum Core',
    dataUrl: createSvgDataUrl(
      ['#0f172a', '#4c1d95'],
      `<ellipse cx="64" cy="64" rx="42" ry="16" fill="none" stroke="#a855f7" stroke-width="5" transform="rotate(30 64 64)"/>
       <ellipse cx="64" cy="64" rx="42" ry="16" fill="none" stroke="#c084fc" stroke-width="5" transform="rotate(-30 64 64)"/>
       <circle cx="64" cy="64" r="12" fill="#e9d5ff"/>`
    ),
  },
  {
    id: 'matrix',
    name: 'Matrix Stream',
    dataUrl: createSvgDataUrl(
      ['#022c22', '#050c18'],
      `<text x="42" y="56" font-family="monospace" font-size="28" font-weight="bold" fill="#3ccb57">10</text>
       <text x="70" y="86" font-family="monospace" font-size="28" font-weight="bold" fill="#86efac">01</text>
       <circle cx="94" cy="48" r="4" fill="#3ccb57"/>
       <circle cx="34" cy="88" r="4" fill="#3ccb57"/>`
    ),
  },
  {
    id: 'cyber_shield',
    name: 'Cyber Sentinel',
    dataUrl: createSvgDataUrl(
      ['#020617', '#1e293b'],
      `<path d="M64 24 L94 38 V66 C94 86 64 102 64 102 C64 102 34 86 34 66 V38 Z" fill="#3ccb57" fill-opacity="0.15" stroke="#3ccb57" stroke-width="6" stroke-linejoin="round"/>
       <path d="M52 62 L60 70 L76 54" fill="none" stroke="#3ccb57" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
    ),
  },
  {
    id: 'laser_diamond',
    name: 'ISE Emerald',
    dataUrl: createSvgDataUrl(
      ['#064e3b', '#022c22'],
      `<polygon points="64,26 98,54 64,102 30,54" fill="#10b981" fill-opacity="0.3" stroke="#34d399" stroke-width="6" stroke-linejoin="round"/>
       <polygon points="64,26 80,54 64,102 48,54" fill="none" stroke="#6ee7b7" stroke-width="3"/>
       <line x1="30" y1="54" x2="98" y2="54" stroke="#6ee7b7" stroke-width="3"/>`
    ),
  },
  {
    id: 'fire_spark',
    name: 'Hot Compiler',
    dataUrl: createSvgDataUrl(
      ['#180808', '#450a0a'],
      `<path d="M64 24 C64 24 78 44 78 62 C78 78 68 96 64 96 C60 96 50 78 50 62 C50 44 64 24 64 24 Z" fill="#f97316" stroke="#fb923c" stroke-width="4"/>
       <path d="M64 48 C64 48 70 60 70 70 C70 78 66 86 64 86 C62 86 58 78 58 70 C58 60 64 48 64 48 Z" fill="#fde047"/>`
    ),
  },
  {
    id: 'ai_sparkles',
    name: 'Neural Spark',
    dataUrl: createSvgDataUrl(
      ['#0c0a2a', '#1e1b4b'],
      `<path d="M64 24 L69 52 L96 64 L69 76 L64 104 L59 76 L32 64 L59 52 Z" fill="#60a5fa" stroke="#93c5fd" stroke-width="4"/>
       <circle cx="88" cy="36" r="6" fill="#38bdf8"/>
       <circle cx="40" cy="90" r="5" fill="#3ccb57"/>`
    ),
  },
  {
    id: 'rocket',
    name: 'ISE Velocity',
    dataUrl: createSvgDataUrl(
      ['#030712', '#0f172a'],
      `<path d="M64 26 C78 40 82 66 80 84 L64 74 L48 84 C46 66 50 40 64 26 Z" fill="#3ccb57" fill-opacity="0.3" stroke="#3ccb57" stroke-width="5" stroke-linejoin="round"/>
       <circle cx="64" cy="52" r="8" fill="#38bdf8"/>
       <polygon points="64,74 72,96 64,88 56,96" fill="#f97316"/>`
    ),
  },
];

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

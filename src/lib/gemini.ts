import type { AttachedFile } from '../types/ise';

export const readFileForGemini = (file: File): Promise<AttachedFile> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        const base64Data = result.split(',')[1] || '';
        resolve({
          name: file.name,
          mimeType: 'application/pdf',
          isPdf: true,
          base64Data,
          content: '',
          textContent: '',
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (e) => {
        const textContent = (e.target?.result as string) || '';
        resolve({
          name: file.name,
          mimeType: 'text/plain',
          isPdf: false,
          content: textContent,
          textContent,
        });
      };
      reader.readAsText(file);
    }
  });
};

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModel[];
}

interface GeminiApiError {
  error?: {
    message?: string;
  };
}

export interface GeminiModelUsage {
  modelName: string;
  lastUsedAt: string;
}

const FALLBACK_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

const modelListsByKey = new Map<string, Promise<string[]>>();
const GEMINI_USAGE_STORAGE_KEY = 'revise_gemini_model_usage_v1';

export const getGeminiModelUsage = (): GeminiModelUsage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const serialized = localStorage.getItem(GEMINI_USAGE_STORAGE_KEY);
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): GeminiModelUsage[] =>
      typeof item?.modelName === 'string' && typeof item?.lastUsedAt === 'string'
        ? [{ modelName: item.modelName, lastUsedAt: item.lastUsedAt }]
        : []
    );
  } catch (error) {
    console.warn('Could not read locally recorded Gemini model usage.', error);
    return [];
  }
};

const recordSuccessfulGeminiCall = (modelName: string) => {
  if (typeof window === 'undefined') return;
  try {
    const usage = getGeminiModelUsage();
    const now = new Date();
    const nextUsage = [
      ...usage.filter((item) => item.modelName !== modelName),
      {
      modelName,
      lastUsedAt: now.toISOString(),
      },
    ];
    localStorage.setItem(GEMINI_USAGE_STORAGE_KEY, JSON.stringify(nextUsage));
    window.dispatchEvent(new Event('revise-gemini-usage-updated'));
  } catch (error) {
    console.warn('Could not record local Gemini model usage.', error);
  }
};

const getModelVersion = (modelName: string): [number, number, number] | null => {
  const match = modelName.match(/gemini-(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
};

const getModelTier = (modelName: string) => {
  if (/\bpro\b/i.test(modelName)) return 3;
  if (/\bultra\b/i.test(modelName)) return 4;
  if (/\bflash-lite\b/i.test(modelName)) return 1;
  if (/\bflash\b/i.test(modelName)) return 2;
  return 0;
};

const compareGeminiModels = (first: string, second: string) => {
  const firstVersion = getModelVersion(first) || [0, 0, 0];
  const secondVersion = getModelVersion(second) || [0, 0, 0];
  for (let index = 0; index < firstVersion.length; index += 1) {
    if (firstVersion[index] !== secondVersion[index]) return secondVersion[index] - firstVersion[index];
  }
  return getModelTier(second) - getModelTier(first);
};

const discoverGeminiModels = async (apiKey: string): Promise<string[]> => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) throw new Error(`Could not list available Gemini models (HTTP ${response.status}).`);
  const payload = await response.json() as GeminiModelsResponse;
  return (payload.models || [])
    .filter((model) => {
      if (typeof model.name !== 'string' || !model.supportedGenerationMethods?.includes('generateContent')) return false;
      const version = getModelVersion(model.name);
      return version !== null && version[0] >= 3;
    })
    .map((model) => model.name.replace(/^models\//, ''))
    .sort(compareGeminiModels)
    .slice(0, 6);
};

const getGeminiModels = (apiKey: string): Promise<string[]> => {
  const existing = modelListsByKey.get(apiKey);
  if (existing) return existing;
  const discovered = discoverGeminiModels(apiKey)
    .then((models) => models.length > 0 ? models : FALLBACK_GEMINI_MODELS)
    .catch(() => FALLBACK_GEMINI_MODELS);
  modelListsByKey.set(apiKey, discovered);
  return discovered;
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const callGemini = async (apiKey: string, promptOrParts: string | any[], thinking = true, maxOutputTokens?: number) => {
  const errors: string[] = [];
  const parts = typeof promptOrParts === 'string' ? [{ text: promptOrParts }] : promptOrParts;
  const attemptedModels = new Set<string>();
  const tryModels = async (models: string[]) => {
    for (const modelId of models) {
      if (attemptedModels.has(modelId)) continue;
      attemptedModels.add(modelId);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
          const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json' };
          if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'medium' };
          if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
          const requestBody = { contents: [{ parts }], generationConfig };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({})) as GeminiApiError;
            errors.push(`${modelId}: ${error.error?.message || `HTTP ${response.status}`}`);
            if (response.status >= 500 && attempt === 0) {
              await wait(200);
              continue;
            }
            break;
          }

          const data = await response.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!raw) {
            errors.push(`${modelId}: response did not contain generated JSON.`);
            break;
          }

          try {
            const result = JSON.parse(raw);
            recordSuccessfulGeminiCall(modelId);
            return result;
          } catch {
            errors.push(`${modelId}: response was not valid JSON.`);
            break;
          }
        } catch (error) {
          errors.push(`${modelId}: ${error instanceof Error ? error.message : 'Network request failed.'}`);
          if (attempt === 0) await wait(200);
        }
      }
    }
    return null;
  };

  const preferredResult = await tryModels(FALLBACK_GEMINI_MODELS);
  if (preferredResult !== null) return preferredResult;
  const discoveredModels = await getGeminiModels(apiKey);
  const discoveredResult = await tryModels(discoveredModels);
  if (discoveredResult !== null) return discoveredResult;
  modelListsByKey.delete(apiKey);
  throw new Error(`All available Gemini 3+ models failed. ${errors.slice(-5).join(' | ')}`);
};
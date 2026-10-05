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

export const callGemini = async (apiKey: string, promptOrParts: string | any[], thinking = true) => {
  const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];
  let lastError = '';

  const parts = typeof promptOrParts === 'string' ? [{ text: promptOrParts }] : promptOrParts;

  for (const modelId of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      const requestBody: any = {
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      };

      if (thinking) {
        requestBody.generationConfig.thinkingConfig = { thinkingLevel: 'medium' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.status === 503 || res.status === 429) continue;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastError = err.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) return JSON.parse(raw);
    } catch (e: any) {
      lastError = e.message;
    }
  }
  throw new Error(`All models at capacity: ${lastError}`);
};
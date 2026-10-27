import React, { useState, useRef } from 'react';
import { HelpCircle, FileUp, Paperclip, ExternalLink } from 'lucide-react';
import type { AttachedFile } from '../../types/ise';
import { readFileForGemini } from '../../lib/gemini';
import { VortexBackground } from './VortexBackground';

export const ApiKeyTooltip: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      <button type="button" onClick={() => setIsVisible(!isVisible)} className="text-xs text-slate-400 hover:text-[#3ccb57] flex items-center gap-1 cursor-pointer">
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="underline">How to get an API key?</span>
      </button>
      {isVisible && (
        <div className="absolute right-0 sm:left-1/2 bottom-full mb-3 z-50 w-64 sm:w-72 sm:-translate-x-1/2 rounded-xl border border-white/15 bg-[#060c20]/95 p-3 text-left shadow-2xl backdrop-blur-xl text-[11px] text-slate-300 space-y-1">
          <p className="font-bold text-white">Google AI Studio (Free Tier)</p>
          <p>1. Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#3ccb57] underline">aistudio.google.com</a>.</p>
          <p>2. Click "Create API key" and paste it into Settings.</p>
        </div>
      )}
    </div>
  );
};

export const FileDropzone: React.FC<{
  files: AttachedFile[];
  onFilesAdded: (newFiles: AttachedFile[]) => void;
  onFileRemoved: (index: number) => void;
  label?: string;
  maxFiles?: number;
  maxFileSizeMb?: number;
}> = ({
  files,
  onFilesAdded,
  onFileRemoved,
  label = 'Attach Lecture Slides / Code Files',
  maxFiles = 20,
  maxFileSizeMb = 20,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const maxSizeBytes = maxFileSizeMb * 1024 * 1024;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    const rawArray = Array.from(fileList);
    const oversizedFiles = rawArray.filter((f) => f.size > maxSizeBytes);
    const validSizeFiles = rawArray.filter((f) => f.size <= maxSizeBytes);
    const remainingSlots = Math.max(0, maxFiles - files.length);

    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map((f) => f.name).slice(0, 2).join(', ');
      const extra = oversizedFiles.length > 2 ? ` (+${oversizedFiles.length - 2} more)` : '';
      setErrorMsg(`File exceeds ${maxFileSizeMb}MB limit: ${names}${extra}`);
    }

    if (remainingSlots <= 0) {
      setErrorMsg(`Maximum ${maxFiles} files allowed. Please remove some files first.`);
      return;
    }

    const filesToLoad = validSizeFiles.slice(0, remainingSlots);
    if (validSizeFiles.length > remainingSlots) {
      setErrorMsg(`Only ${remainingSlots} file(s) added. Maximum limit is ${maxFiles} files.`);
    }

    if (filesToLoad.length === 0) return;

    try {
      const readPromises = filesToLoad.map((f) => readFileForGemini(f));
      const loaded = await Promise.all(readPromises);
      onFilesAdded(loaded);
    } catch {
      setErrorMsg('Failed to process one or more files. Please try again.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-xs font-semibold text-slate-300">{label}</label>
        <span className="text-[10px] font-mono text-slate-400">
          {files.length}/{maxFiles} files · Max {maxFileSizeMb}MB each
        </span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) await handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3 sm:p-3.5 text-center cursor-pointer transition-all ${
          isDragging ? 'border-[#3ccb57] bg-[#3ccb57]/10' : 'border-white/15 bg-black/40 hover:border-[#3ccb57]/50 hover:bg-black/60'
        }`}
      >
        <input ref={inputRef} type="file" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-300">
          <FileUp className="h-4 w-4 text-[#3ccb57] shrink-0" />
          <span>Drag & Drop files here, or <strong className="text-white underline">browse desktop</strong></span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">Supports PDF (native multimodal), Java, TS, Py, Markdown, TXT (up to 20MB / file)</p>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-2 animate-fade-in">
          <span>⚠️ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white text-xs px-1 cursor-pointer">✕</button>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-200 max-w-full">
              <Paperclip className="h-3 w-3 text-[#3ccb57] shrink-0" />
              <span className="max-w-[140px] sm:max-w-[200px] truncate">{f.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onFileRemoved(i); }} className="text-red-400 hover:text-red-300 ml-1 cursor-pointer shrink-0">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const Navbar: React.FC = () => (
  <header className="w-full border-b border-white/[0.07] bg-[#040816]/70 backdrop-blur-md shrink-0">
    <div className="flex h-14 sm:h-16 w-full items-center justify-between px-4 sm:px-8">
        <a href="/" className="text-lg sm:text-xl font-bold tracking-tight text-white inline-flex items-center gap-2 group">
            <img src="/favicon.svg" alt="revISE Logo" className="h-5 w-5 shrink-0 object-contain" />
            <span className="leading-none flex items-center">
                 rev<span className="text-[#3ccb57]">ISE</span>
            </span>
        </a>
      <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-300 hover:text-[#3ccb57] flex items-center gap-1.5 transition-colors">
        <span className="hidden sm:inline">Google </span>AI Studio <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  </header>
);

export const BackgroundGradients: React.FC<{
  showVortex?: boolean;
  theme?: 'standard' | 'glass' | 'dark_glass';
}> = React.memo(({ showVortex = true, theme = 'standard' }) => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    {/* Слой 1: Статичные градиенты (изолированы, 0% нагрузки на процессор) */}
    <div className="absolute inset-0 overflow-hidden" style={{ isolation: 'isolate', contain: 'strict' }}>
      {theme === 'dark_glass' ? (
        <>
          <div className="absolute inset-0 bg-[#080a10]" />
          <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full blur-[140px] opacity-30" style={{ background: '#722038' }} />
          <div className="absolute -bottom-32 -right-32 h-[650px] w-[650px] rounded-full blur-[150px] opacity-25" style={{ background: '#25355a' }} />
        </>
      ) : theme === 'glass' ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #071026 0%, #071428 28%, #103644 55%, #0d362a 82%, #19663d 100%)',
            }}
          />
          <div className="absolute -bottom-20 -right-20 h-[650px] w-[650px] rounded-full blur-[130px] opacity-50" style={{ background: '#34ba4c' }} />
          <div className="absolute -top-20 -left-20 h-[700px] w-[700px] rounded-full blur-[140px] opacity-60" style={{ background: '#103a7d' }} />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #020719 0%, #05193b 30%, #07313f 55%, #0a4d38 80%, #157342 100%)',
            }}
          />
          <div className="absolute -bottom-24 -right-24 h-[650px] w-[650px] rounded-full blur-[140px] opacity-50" style={{ background: '#2a993e' }} />
          <div className="absolute -top-24 -left-24 h-[700px] w-[700px] rounded-full blur-[150px] opacity-70" style={{ background: '#0a2a7a' }} />
        </>
      )}
    </div>

    {/* Слой 2: Вортекс изолирован в собственном контейнере, не задевая карточки */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ isolation: 'isolate', contain: 'strict' }}>
      {showVortex && <VortexBackground />}
    </div>

    {theme !== 'dark_glass' && (
      <div className="absolute bottom-0 right-0 w-96 h-1 bg-gradient-to-r from-transparent via-[#3ccb57]/50 to-[#3ccb57]" />
    )}
  </div>
));

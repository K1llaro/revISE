import React, { useState, useRef } from 'react';
import { HelpCircle, FileUp, Paperclip, ExternalLink } from 'lucide-react';
import type { AttachedFile } from '../../types/ise';
import { readFileForGemini } from '../../lib/gemini';

export const ApiKeyTooltip: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      <button type="button" onClick={() => setIsVisible(!isVisible)} className="text-xs text-slate-400 hover:text-[#3ccb57] flex items-center gap-1 cursor-pointer">
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="underline">Get Free Key</span>
      </button>
      {isVisible && (
        <div className="absolute left-0 sm:left-1/2 bottom-full mb-3 z-50 w-72 -translate-x-1/2 rounded-xl border border-white/15 bg-[#060c20]/95 p-3 text-left shadow-2xl backdrop-blur-xl text-[11px] text-slate-300 space-y-1">
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
}> = ({ files, onFilesAdded, onFileRemoved, label = 'Attach Lecture Slides / Code Files' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const readPromises = Array.from(fileList).map((f) => readFileForGemini(f));
    const loaded = await Promise.all(readPromises);
    onFilesAdded(loaded);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-300">{label}</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) await handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
          isDragging ? 'border-[#3ccb57] bg-[#3ccb57]/10' : 'border-white/15 bg-black/40 hover:border-[#3ccb57]/50 hover:bg-black/60'
        }`}
      >
        <input ref={inputRef} type="file" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-300">
          <FileUp className="h-4 w-4 text-[#3ccb57]" />
          <span>Drag & Drop files here, or <strong className="text-white underline">browse desktop</strong></span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">Supports PDF (native multimodal), Java, TS, Py, Markdown, TXT</p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-200">
              <Paperclip className="h-3 w-3 text-[#3ccb57]" />
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onFileRemoved(i); }} className="text-red-400 hover:text-red-300 ml-1 cursor-pointer">
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
  <header className="w-full border-b border-white/[0.07] bg-[#040816]/70 backdrop-blur-md">
    <div className="flex h-16 w-full items-center justify-between px-6 sm:px-10">
        <a href="/" className="text-xl font-bold tracking-tight text-white inline-flex items-center gap-2.5 group">
            <img src="/favicon.svg" alt="revISE Logo" className="h-5 w-5 shrink-0 object-contain" />
            <span className="leading-none flex items-center">
                 rev<span className="text-[#3ccb57]">ISE</span>
            </span>
        </a>
      <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-300 hover:text-[#3ccb57] flex items-center gap-1.5">
        Google AI Studio <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  </header>
);

export const Footer: React.FC = () => (
  <footer className="w-full border-t border-white/[0.06] bg-[#02050f]/80 py-5 text-xs text-slate-500">
    <div className="w-full px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center gap-3">
      <span>rev<span className="text-[#3ccb57]">ISE</span></span>
      <span>Calibrated to ISE LM173 Telemetry Palette</span>
      <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#3ccb57]">Google AI Studio</a>
    </div>
  </footer>
);

export const BackgroundGradients: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #020719 0%, #05193b 30%, #07313f 55%, #0a4d38 80%, #157342 100%)' }} />
    <div className="absolute -bottom-24 -right-24 h-[650px] w-[650px] rounded-full blur-[140px] opacity-50" style={{ background: '#3ccb57' }} />
    <div className="absolute -top-24 -left-24 h-[700px] w-[700px] rounded-full blur-[150px] opacity-70" style={{ background: '#0a2a7a' }} />
    <div className="absolute bottom-0 right-0 w-96 h-1 bg-gradient-to-r from-transparent via-[#3ccb57]/50 to-[#3ccb57]" />
  </div>
);
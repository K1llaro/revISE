import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Brain, Code2, Bug, Upload, Shield, History, Settings, Cpu, Loader2,
  AlertTriangle, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Calendar, Plus, User, Trophy,
  EyeOff, Eye, Sparkles, Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttachedFile, StudyYear, TestHistoryItem, LeaderboardEntry, UserSession } from '../../types/ise';
import { getGeminiModelUsage } from '../../lib/gemini';
import { FileDropzone } from '../common/LayoutComponents';


export interface QuizPresetSettings {
  quizCustomTitle: string;
  quizQuestionCount: number;
  quizCustomCount: string;
  quizTimerMinutes: number;
  quizCustomTimer: string;
  quizScoringMode: 'partial' | 'strict' | 'negative';
  immediateQuizFeedback: boolean;
  quizTypePercentages: { mcq: number; text: number; single: number };
  quizThinkingMode: boolean;
  selectedTag: string;
  quizPrompt: string;
}

export interface QuizPreset {
  id: string;
  name: string;
  settings: QuizPresetSettings;
}

import { UploadCloud, ZoomIn, Image as ImageIcon } from 'lucide-react';

export const UserAvatar: React.FC<{ url?: string; name: string; size?: number; className?: string }> = ({ url, name, size = 40, className = '' }) => {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className={`rounded-full object-cover shrink-0 ${className}`} />;
  const initials = (name || 'ST').substring(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size }} className={`rounded-full bg-black flex items-center justify-center border border-[#3ccb57]/30 shrink-0 ${className}`}>
      <span className="text-[#3ccb57] font-bold" style={{ fontSize: size * 0.4 }}>{initials}</span>
    </div>
  );
};

const ImageCropper: React.FC<{ file: File; onCrop: (base64: string) => void; onCancel: () => void }> = ({ file, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        // Начальный масштаб, чтобы заполнить квадрат 250x250
        const initialScale = Math.max(250 / img.width, 250 / img.height);
        setScale(initialScale);
        setPosition({ x: (250 - img.width * initialScale) / 2, y: (250 - img.height * initialScale) / 2 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [file]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 250, 250);
    ctx.drawImage(image, position.x, position.y, image.width * scale, image.height * scale);
  }, [image, scale, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleSave = () => {
    if (canvasRef.current) {
      onCrop(canvasRef.current.toDataURL('image/jpeg', 0.9));
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-[#3ccb57]/50" style={{ width: 250, height: 250 }}>
        <canvas
          ref={canvasRef}
          width={250}
          height={250}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-move touch-none"
        />
        <div className="absolute inset-0 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] rounded-full m-[10px]"></div>
      </div>
      <div className="w-full max-w-[250px] flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-slate-400" />
        <input type="range" min={0.1} max={3} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="flex-1 accent-[#3ccb57]" />
        <ZoomIn className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex gap-2 w-full max-w-[250px]">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-white/5 hover:bg-white/10">Cancel</button>
        <button onClick={handleSave} className="flex-1 py-2 rounded-lg text-xs font-bold text-black bg-[#3ccb57] hover:bg-[#4ade67]">Crop & Save</button>
      </div>
    </div>
  );
};

/* ==========================================================================
   COMPONENT: SEARCHABLE TAG DROPDOWN
   ========================================================================== */
export const SearchableTagDropdown: React.FC<{
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  availableTags: string[];
}> = ({ selectedTag, onSelectTag, availableTags }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return availableTags;
    const q = search.toLowerCase().replace(/^#/, '');
    return availableTags.filter((t) => t.toLowerCase().includes(q));
  }, [availableTags, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 hover:border-[#3ccb57]/40 flex items-center justify-between text-xs cursor-pointer transition-all"
      >
        <span className={selectedTag ? 'font-mono font-bold text-[#3ccb57]' : 'text-slate-400'}>
          {selectedTag ? selectedTag : 'Select or search curriculum tag...'}
        </span>
        <div className="flex items-center gap-1.5">
          {selectedTag && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTag('');
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#3ccb57]' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full z-50 rounded-2xl border border-white/15 bg-[#060c20]/98 backdrop-blur-2xl shadow-2xl p-3 space-y-2 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="search"
              autoFocus
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag (e.g. Java, CDK, Loops)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {filteredTags.length === 0 ? (
              <div className="py-2 px-1 text-center space-y-1.5">
                <span className="text-[11px] text-slate-400 block">{search.trim() ? 'No matching tags. Clear the search and leave the tag empty to let AI classify this material.' : 'No approved curriculum tags yet. Leave empty and AI will classify this material.'}</span>
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <div
                    key={tag}
                    onClick={() => {
                      onSelectTag(tag);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-[#3ccb57] text-black font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{tag}</span>
                    {isSelected && <span className="text-black font-bold">✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   DYNAMIC DIFFICULTY ENVIRONMENT: WHITE CLOUDS & FIRESTORM ASH/EMBERS
   ========================================================================== */

/* Точный SVG-силуэт облака по картинке */
const CloudShape: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <svg
    viewBox="0 0 100 65"
    fill="white"
    className={`pointer-events-none drop-shadow-[0_4px_16px_rgba(255,255,255,0.65)] ${className}`}
    style={style}
  >
    <path d="M 22 56 C 10 56 0 47 0 36 C 0 25 7 17 17 16 C 19 7 28 0 40 0 C 50 0 58 5 62 13 C 66 10 71 9 76 10 C 87 12 95 21 95 32 C 100 35 104 40 104 46 C 104 53 98 56 90 56 Z" />
  </svg>
);

/* 40 детерминированных частиц для шторма пепла и горящих углей */
const FIRESTORM_PARTICLES = Array.from({ length: 42 }).map((_, i) => ({
  id: i,
  left: `${(i * 2.4 + 2) % 96}%`,
  size: (i % 3 === 0 ? 3 : i % 2 === 0 ? 4.5 : 2.5) + (i % 4) * 0.5,
  isAsh: i % 3 === 0, // Каждая 3-я частица — серый пепел, остальные — горящие угли
  duration: 1.8 + (i % 5) * 0.45,
  delay: (i * 0.13) % 2.2,
  sway: (i % 2 === 0 ? 1 : -1) * (15 + (i % 4) * 8),
}));

export const DifficultyAura: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const isVeryEasy = difficulty === 'Very Easy';
  const isEasy = difficulty === 'Easy';
  const isHard = difficulty === 'Hard';
  const isChallenge = difficulty === 'Challenge';

  if (!isVeryEasy && !isEasy && !isHard && !isChallenge) return null;

  return (
    <>
      <style>{`
        @keyframes cloudDriftGentle {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-7px) scale(1.03); }
        }
        @keyframes fireBorderFlickerHard {
          0%, 100% { border-color: rgba(239, 68, 68, 0.7); box-shadow: 0 0 45px rgba(239, 68, 68, 0.4), inset 0 0 35px rgba(249, 115, 22, 0.25); }
          25% { border-color: rgba(249, 115, 22, 0.95); box-shadow: 0 0 75px rgba(249, 115, 22, 0.65), inset 0 0 55px rgba(239, 68, 68, 0.4); }
          50% { border-color: rgba(239, 68, 68, 0.6); box-shadow: 0 0 35px rgba(239, 68, 68, 0.35), inset 0 0 25px rgba(249, 115, 22, 0.2); }
          75% { border-color: rgba(251, 146, 60, 1); box-shadow: 0 0 85px rgba(251, 146, 60, 0.75), inset 0 0 65px rgba(255, 69, 0, 0.45); }
        }
        @keyframes fireBorderFlickerChallenge {
          0%, 100% { border-color: #ff4500; box-shadow: 0 0 70px rgba(255, 69, 0, 0.7), inset 0 0 60px rgba(255, 120, 0, 0.4); }
          20% { border-color: #ffaa00; box-shadow: 0 0 110px rgba(255, 170, 0, 0.9), inset 0 0 85px rgba(255, 69, 0, 0.55); }
          40% { border-color: #ef4444; box-shadow: 0 0 60px rgba(239, 68, 68, 0.6), inset 0 0 45px rgba(249, 115, 22, 0.35); }
          65% { border-color: #ffea79; box-shadow: 0 0 130px rgba(255, 234, 121, 0.95), inset 0 0 95px rgba(255, 140, 0, 0.6); }
          85% { border-color: #f97316; box-shadow: 0 0 85px rgba(249, 115, 22, 0.75), inset 0 0 70px rgba(239, 68, 68, 0.5); }
        }
        @keyframes particleAscent {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          15% { opacity: 0.95; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-750px) translateX(var(--sway)) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* МЕРЦАЮЩАЯ ОГНЕННАЯ РАМКА ДЛЯ HARD И CHALLENGE */}
      {(isHard || isChallenge) && (
        <div
          className="absolute inset-0 rounded-3xl border-2 pointer-events-none z-10"
          style={{
            animation: isChallenge ? 'fireBorderFlickerChallenge 1.4s infinite ease-in-out' : 'fireBorderFlickerHard 2.2s infinite ease-in-out',
          }}
        />
      )}

      {/* БЕЛЫЕ ОБЛАКА ПО ПЕРИМЕТРУ РАМКИ (VERY EASY & EASY) */}
      {(isVeryEasy || isEasy) && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
          {/* Верхний край */}
          <CloudShape className="absolute -top-7 left-[6%] w-24 opacity-95" style={{ animation: 'cloudDriftGentle 5s ease-in-out infinite' }} />
          <CloudShape className="absolute -top-10 left-[26%] w-36 opacity-100" style={{ animation: 'cloudDriftGentle 6.5s ease-in-out infinite 0.7s' }} />
          <CloudShape className="absolute -top-6 left-[50%] w-20 opacity-90" style={{ animation: 'cloudDriftGentle 5.2s ease-in-out infinite 1.4s' }} />
          <CloudShape className="absolute -top-11 left-[70%] w-40 opacity-100" style={{ animation: 'cloudDriftGentle 6s ease-in-out infinite 0.3s' }} />
          <CloudShape className="absolute -top-8 left-[90%] w-24 opacity-95" style={{ animation: 'cloudDriftGentle 5.6s ease-in-out infinite 1.1s' }} />

          {/* Нижний край */}
          <CloudShape className="absolute -bottom-7 left-[14%] w-28 opacity-95" style={{ animation: 'cloudDriftGentle 5.8s ease-in-out infinite 0.5s' }} />
          <CloudShape className="absolute -bottom-10 left-[44%] w-36 opacity-100" style={{ animation: 'cloudDriftGentle 6.2s ease-in-out infinite 1.2s' }} />
          <CloudShape className="absolute -bottom-8 left-[76%] w-28 opacity-95" style={{ animation: 'cloudDriftGentle 5.4s ease-in-out infinite 0.8s' }} />

          {/* Боковые края (только для Very Easy) */}
          {isVeryEasy && (
            <>
              <CloudShape className="absolute top-[28%] -left-8 w-24 opacity-90" style={{ animation: 'cloudDriftGentle 6s ease-in-out infinite 0.9s' }} />
              <CloudShape className="absolute top-[64%] -left-7 w-20 opacity-85" style={{ animation: 'cloudDriftGentle 5.5s ease-in-out infinite 1.5s' }} />
              <CloudShape className="absolute top-[32%] -right-8 w-24 opacity-90" style={{ animation: 'cloudDriftGentle 6.2s ease-in-out infinite 0.4s' }} />
              <CloudShape className="absolute top-[68%] -right-7 w-20 opacity-85" style={{ animation: 'cloudDriftGentle 5.7s ease-in-out infinite 1.8s' }} />
            </>
          )}
        </div>
      )}

      {/* ШТОРМ ИЗ ЧАСТИЦ: ПЕПЕЛ (СЕРЫЙ) + ГОРЯЩИЕ ИСКРЫ (КРАСНЫЕ/ОРАНЖЕВЫЕ) */}
      {(isHard || isChallenge) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-20">
          {(isChallenge ? FIRESTORM_PARTICLES : FIRESTORM_PARTICLES.slice(0, 22)).map((p) => {
            const isAsh = p.isAsh;
            return (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={
                  {
                    left: p.left,
                    bottom: '-15px',
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: isAsh
                      ? p.id % 2 === 0 ? '#9ca3af' : '#d1d5db' // Серый пепел
                      : p.id % 4 === 0 ? '#fbbf24' : p.id % 2 === 0 ? '#f97316' : '#ef4444', // Горящие угли/искры
                    boxShadow: isAsh
                      ? 'none'
                      : `0 0 ${p.size * 2}px ${p.id % 4 === 0 ? '#fbbf24' : '#f97316'}`,
                    opacity: isAsh ? 0.65 : 0.9,
                    '--sway': `${p.sway}px`,
                    animation: `particleAscent ${p.duration}s ease-out infinite ${p.delay}s`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
};

/* ==========================================================================
   1. QUIZ CONFIG MODAL
   (Акцент: Синяя иконка и бейдж, весь UI — фирменный зелёный #3ccb57)
   ========================================================================== */
export const QuizModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  quizCustomTitle: string;
  setQuizCustomTitle: (s: string) => void;
  quizQuestionCount: number;
  setQuizQuestionCount: (n: number) => void;
  quizCustomCount: string;
  setQuizCustomCount: (s: string) => void;
  quizTimerMinutes: number;
  setQuizTimerMinutes: (n: number) => void;
  quizCustomTimer: string;
  setQuizCustomTimer: (s: string) => void;
  quizScoringMode: 'partial' | 'strict' | 'negative';
  setQuizScoringMode: (m: 'partial' | 'strict' | 'negative') => void;
  immediateQuizFeedback: boolean;
  setImmediateQuizFeedback: (enabled: boolean) => void;
  quizTypePercentages: { mcq: number; text: number; single: number };
  setQuizTypePercentages: React.Dispatch<React.SetStateAction<{ mcq: number; text: number; single: number }>>;
  quizPresets: QuizPreset[];
  selectedQuizPresetId: string | null;
  quizPresetError: string | null;
  onCreateQuizPreset: () => void;
  onApplyQuizPreset: (presetId: string) => void;
  onSaveQuizPreset: () => void;
  onRenameQuizPreset: (presetId: string, name: string) => void;
  onDeleteQuizPreset: (presetId: string) => void;
  quizThinkingMode: boolean;
  setQuizThinkingMode: (b: boolean) => void;
  selectedTag: string;
  setSelectedTag: (t: string) => void;
  availableTags: string[];
  quizAttachedFiles: AttachedFile[];
  setQuizAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  quizPrompt: string;
  setQuizPrompt: (s: string) => void;
  isGenerating: boolean;
  generationError: string | null;
  onLaunch: () => void;
}> = ({
  isOpen, onClose, quizCustomTitle, setQuizCustomTitle, quizQuestionCount, setQuizQuestionCount,
  quizCustomCount, setQuizCustomCount, quizTimerMinutes, setQuizTimerMinutes, quizCustomTimer, setQuizCustomTimer,
  quizScoringMode, setQuizScoringMode, immediateQuizFeedback, setImmediateQuizFeedback, quizTypePercentages, setQuizTypePercentages, quizThinkingMode, setQuizThinkingMode,
  quizPresets, selectedQuizPresetId, onCreateQuizPreset, onApplyQuizPreset, onSaveQuizPreset, onRenameQuizPreset, onDeleteQuizPreset,
  selectedTag, setSelectedTag, availableTags, quizAttachedFiles, setQuizAttachedFiles,
  quizPrompt, setQuizPrompt, isGenerating, generationError, onLaunch
}) => {
  if (!isOpen) return null;

  const totalPercentage = quizTypePercentages.mcq + quizTypePercentages.text + quizTypePercentages.single;
  const isPercentageValid = totalPercentage === 100;
  const activeQuestions = quizCustomCount ? parseInt(quizCustomCount, 10) || quizQuestionCount : quizQuestionCount;
  const activeMinutes = quizCustomTimer ? parseInt(quizCustomTimer, 10) || quizTimerMinutes : quizTimerMinutes;
  const secondsPerQuestion = activeQuestions > 0 ? Math.round((activeMinutes * 60) / activeQuestions) : 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1700px] h-[92vh] rounded-3xl border border-white/10 bg-[#060c20]/98 flex flex-col shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* HEADER: СИНЯЯ ИКОНКА И БЕЙДЖ, ОСТАЛЬНОЕ В СТИЛЕ СИСТЕМЫ */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#040816]/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-400/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">Quiz Examination Station</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-400/10 text-sky-400 border border-sky-400/30 uppercase">
                  Adaptive AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Configure curriculum sources, constraints and AI evaluation rubric</p>
            </div>
          </div>

          {/* Presets Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-white/10 text-xs">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold px-2">Presets:</span>
              {quizPresets.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic pr-2">None saved</span>
              ) : (
                quizPresets.map((preset) => {
                  const isSelected = selectedQuizPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#3ccb57] text-black font-bold shadow-[0_0_12px_rgba(60,203,87,0.3)]'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <button type="button" onClick={() => onApplyQuizPreset(preset.id)} className="cursor-pointer">
                        {preset.name}
                      </button>
                      {isSelected && (
                        <button type="button" onClick={onSaveQuizPreset} className="text-[10px] underline ml-1 hover:opacity-80 cursor-pointer">
                          Save
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteQuizPreset(preset.id); }}
                        className={`text-xs ml-0.5 cursor-pointer ${isSelected ? 'text-black/70 hover:text-black' : 'text-slate-500 hover:text-red-400'}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {selectedQuizPresetId && (
              <input
                type="text"
                maxLength={25}
                value={quizPresets.find(p => p.id === selectedQuizPresetId)?.name || ''}
                onChange={(e) => onRenameQuizPreset(selectedQuizPresetId, e.target.value)}
                placeholder="Rename preset"
                className="px-2.5 py-1 text-xs rounded-xl bg-black/60 border border-white/10 text-white w-28 focus:outline-none focus:border-[#3ccb57]"
              />
            )}

            <button
              type="button"
              onClick={onCreateQuizPreset}
              disabled={quizPresets.length >= 5}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#3ccb57]/40 bg-[#3ccb57]/10 text-[#3ccb57] hover:bg-[#3ccb57]/20 transition-all cursor-pointer disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save Preset</span>
            </button>

            <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {generationError && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-start gap-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{generationError}</span>
          </div>
        )}

        {/* 3 COLUMNS BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* COLUMN 1 */}
            <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                01 • Problem Specs & Reference
              </span>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
                <SearchableTagDropdown selectedTag={selectedTag} onSelectTag={setSelectedTag} availableTags={availableTags} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Test Title (Optional)</label>
                  <span className="text-[10px] font-mono text-slate-500">{quizCustomTitle.length}/80</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={quizCustomTitle}
                  onChange={(e) => setQuizCustomTitle(e.target.value)}
                  placeholder="e.g. Lab 4 AWS CDK & CloudFront Revision (max 80 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Topic Focus or Edge-Cases</label>
                  <span className="text-[10px] font-mono text-slate-500">{quizPrompt.length}/1000</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={quizPrompt}
                  onChange={(e) => setQuizPrompt(e.target.value)}
                  placeholder="e.g. Focus on memory buses, address lines, and control signal timing... (max 1000 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57] resize-none"
                />
              </div>

              <div className="[&_.flex-wrap]:max-h-24 [&_.flex-wrap]:overflow-y-auto [&_.flex-wrap]:pr-1 [&_.flex-wrap]:scrollbar-thin">
                <FileDropzone
                  files={quizAttachedFiles}
                  onFilesAdded={(newF) => setQuizAttachedFiles((prev) => [...prev, ...newF])}
                  onFileRemoved={(idx) => setQuizAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  label={`Attach Reference Slides ${quizAttachedFiles.length > 0 ? `• ${quizAttachedFiles.length} file(s)` : ''}`}
                />
              </div>
            </div>

            {/* COLUMN 2 */}
            <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                02 • Challenge Calibration
              </span>

              {/* Question Count */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Number of Questions</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 7, 10].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => { setQuizQuestionCount(count); setQuizCustomCount(''); }}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        quizQuestionCount === count && !quizCustomCount
                          ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold shadow-[0_0_12px_rgba(60,203,87,0.3)]'
                          : 'bg-black/60 border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {count} Qs
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Custom"
                    min="1"
                    max="30"
                    value={quizCustomCount}
                    onChange={(e) => {
                      setQuizCustomCount(e.target.value);
                      if (e.target.value) setQuizQuestionCount(parseInt(e.target.value, 10));
                    }}
                    className={`px-2 py-2 rounded-xl bg-black/70 border text-center text-xs text-white focus:outline-none focus:border-[#3ccb57] ${
                      quizCustomCount ? 'border-[#3ccb57] text-[#3ccb57] font-bold' : 'border-white/10'
                    }`}
                  />
                </div>
              </div>

              {/* Time Limit */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Time Limit (Minutes)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => { setQuizTimerMinutes(mins); setQuizCustomTimer(''); }}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        quizTimerMinutes === mins && !quizCustomTimer
                          ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold shadow-[0_0_12px_rgba(60,203,87,0.3)]'
                          : 'bg-black/60 border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Custom"
                    min="1"
                    max="180"
                    value={quizCustomTimer}
                    onChange={(e) => {
                      setQuizCustomTimer(e.target.value);
                      if (e.target.value) setQuizTimerMinutes(parseInt(e.target.value, 10));
                    }}
                    className={`px-2 py-2 rounded-xl bg-black/70 border text-center text-xs text-white focus:outline-none focus:border-[#3ccb57] ${
                      quizCustomTimer ? 'border-[#3ccb57] text-[#3ccb57] font-bold' : 'border-white/10'
                    }`}
                  />
                </div>
              </div>

              {/* Immediate Feedback Card */}
              <label className="flex cursor-pointer items-start justify-between rounded-xl border border-white/10 bg-black/60 p-3 transition hover:border-white/20">
                <div className="pr-2">
                  <span className="block text-xs font-bold text-white">Instant Answer Feedback</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Lock each answer upon submit and show full explanation before next question.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={immediateQuizFeedback}
                  onChange={(e) => setImmediateQuizFeedback(e.target.checked)}
                  className="h-4 w-4 accent-[#3ccb57] cursor-pointer shrink-0 mt-0.5"
                />
              </label>

              <div className="p-2.5 rounded-xl bg-black/60 border border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Calculated Pacing:</span>
                <span className="text-[#3ccb57] font-bold">~{secondsPerQuestion}s / question</span>
              </div>
            </div>

            {/* COLUMN 3 */}
            <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                03 • Rubric & AI Engine
              </span>

              {/* Scoring Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Scoring Model</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/70 border border-white/10">
                  {(['partial', 'strict', 'negative'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setQuizScoringMode(mode)}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        quizScoringMode === mode
                          ? 'bg-[#3ccb57] text-black font-bold shadow-[0_0_10px_rgba(60,203,87,0.3)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Types Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Question Types Mix</label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setQuizTypePercentages({ mcq: 75, text: 5, single: 20 })}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    >
                      Standard (75/20/5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuizTypePercentages({ mcq: 60, text: 0, single: 40 })}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    >
                      Choice Only
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'mcq', label: 'Multiple Choice' },
                    { key: 'single', label: 'Single Answer' },
                    { key: 'text', label: 'Fill In Text' },
                  ].map(({ key, label }) => (
                    <div key={key} className="rounded-xl border border-white/10 bg-black/70 p-2 text-center">
                      <span className="block text-[10px] text-slate-400 mb-1 truncate">{label}</span>
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={quizTypePercentages[key as keyof typeof quizTypePercentages]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setQuizTypePercentages((prev) => ({
                              ...prev,
                              [key]: isNaN(val) ? 0 : Math.max(0, Math.min(100, val)),
                            }));
                          }}
                          className="w-12 bg-black/80 rounded px-1.5 py-1 text-xs text-white font-mono text-center border border-white/10 focus:outline-none focus:border-[#3ccb57]"
                        />
                        <span className="text-[11px] text-slate-500">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className={`mt-1.5 text-[10px] font-mono ${isPercentageValid ? 'text-[#3ccb57]' : 'text-amber-400 font-bold'}`}>
                  Total: {totalPercentage}% {isPercentageValid ? '✓' : '(must equal 100%)'}
                </p>
              </div>

              {/* Gemini 3 Thinking Mode */}
              <div className="p-3.5 rounded-xl bg-black/70 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="h-5 w-5 text-[#3ccb57]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Gemini 3 Reasoning</span>
                    <span className="text-[10px] text-slate-400 block">Deep chain-of-thought verification</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuizThinkingMode(!quizThinkingMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ml-3 ${
                    quizThinkingMode ? 'bg-[#3ccb57]' : 'bg-white/20'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${quizThinkingMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#040816]/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="px-2.5 py-1 rounded-lg bg-[#3ccb57]/10 border border-[#3ccb57]/30 text-[#3ccb57] font-bold">
              {selectedTag || '#General'}
            </span>
            <span>•</span>
            <span className="text-white font-semibold">{activeQuestions} Questions</span>
            <span>•</span>
            <span className="text-white font-semibold">{activeMinutes} Minutes</span>
            <span>•</span>
            <span className="capitalize">{quizScoringMode} Marking</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={isGenerating || !isPercentageValid}
              className="px-8 py-3 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(60,203,87,0.35)] disabled:opacity-40"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Synthesizing Exam...</span>
                </>
              ) : (
                <span>Generate & Start Quiz →</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   2. PROGRAMMING MODAL
   (Зелёная иконка и бейдж, интерфейс в фирменном зелёном)
   ========================================================================== */
export const ProgrammingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  progCustomTitle: string;
  setProgCustomTitle: (s: string) => void;
  progDifficulty: string;
  setProgDifficulty: (d: string) => void;
  selectedTag: string;
  setSelectedTag: (t: string) => void;
  availableTags: string[];
  progAttachedFiles: AttachedFile[];
  setProgAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  progPrompt: string;
  setProgPrompt: (s: string) => void;
  isGenerating: boolean;
  onLaunch: () => void;
}> = ({
  isOpen, onClose, progCustomTitle, setProgCustomTitle, progDifficulty, setProgDifficulty,
  selectedTag, setSelectedTag, availableTags, progAttachedFiles, setProgAttachedFiles,
  progPrompt, setProgPrompt, isGenerating, onLaunch
}) => {
  if (!isOpen) return null;

  const difficultyMultipliers: Record<string, { exp: string; desc: string }> = {
    'Very Easy': { exp: '0.5x Exp', desc: 'Basic logic, single loop' },
    'Easy': { exp: '0.8x Exp', desc: 'Direct specs, straightforward operations' },
    'Standard': { exp: '1.0x Exp', desc: 'ISE baseline: nested loops & state flow' },
    'Hard': { exp: '1.5x Exp', desc: 'Edge cases, tricky algorithmic bounds' },
    'Challenge': { exp: '2.5x Exp', desc: 'Complex constraints & high performance' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1700px] h-[92vh] rounded-3xl border border-white/10 bg-[#060c20]/98 flex flex-col shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#040816]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#3ccb57]/10 border border-[#3ccb57]/30 flex items-center justify-center text-[#3ccb57] shadow-[0_0_15px_rgba(60,203,87,0.25)]">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">Java Lab Challenge Studio</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3ccb57]/10 text-[#3ccb57] border border-[#3ccb57]/30 uppercase">
                  Java 21 / OOP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Generates structured programming challenges with automated rubric grading</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2-COLUMN BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                01 • Problem Specs & Reference
              </span>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
                <SearchableTagDropdown selectedTag={selectedTag} onSelectTag={setSelectedTag} availableTags={availableTags} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Exercise Title (Optional)</label>
                  <span className="text-[10px] font-mono text-slate-500">{progCustomTitle.length}/80</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={progCustomTitle}
                  onChange={(e) => setProgCustomTitle(e.target.value)}
                  placeholder="e.g. Lab Exercise: Drawing ASCII Triangles (max 80 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Requirements / Algorithmic Focus</label>
                  <span className="text-[10px] font-mono text-slate-500">{progPrompt.length}/1000</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={progPrompt}
                  onChange={(e) => setProgPrompt(e.target.value)}
                  placeholder="e.g. Prompt user for matrix size, handle boundary checks... (max 1000 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57] resize-none"
                />
              </div>

              <div className="[&_.flex-wrap]:max-h-24 [&_.flex-wrap]:overflow-y-auto [&_.flex-wrap]:pr-1 [&_.flex-wrap]:scrollbar-thin">
                <FileDropzone
                  files={progAttachedFiles}
                  onFilesAdded={(newF) => setProgAttachedFiles((prev) => [...prev, ...newF])}
                  onFileRemoved={(idx) => setProgAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  label={`Attach Reference Slides ${progAttachedFiles.length > 0 ? `• ${progAttachedFiles.length} file(s)` : ''}`}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                02 • Challenge Calibration
              </span>

              {/* Difficulty selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Select Complexity Tier</label>
                <div className="grid grid-cols-5 gap-2">
                  {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => {
                    const isSelected = progDifficulty === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setProgDifficulty(lvl)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold shadow-[0_0_15px_rgba(60,203,87,0.3)]'
                            : 'bg-black/60 border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="block text-xs font-bold truncate">{lvl}</span>
                        <span className={`block text-[10px] font-mono mt-0.5 ${isSelected ? 'text-black/80 font-bold' : 'text-[#3ccb57]'}`}>
                          {difficultyMultipliers[lvl]?.exp}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {difficultyMultipliers[progDifficulty]?.desc}
                </p>
              </div>

              {/* 4-Tier Rubric */}
              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-2.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Automated 4-Tier Evaluation Rubric
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-[#3ccb57] font-bold block">40 pts</span>
                    <span className="text-slate-300 text-[11px]">Core Logic & Flow</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-[#3ccb57] font-bold block">30 pts</span>
                    <span className="text-slate-300 text-[11px]">Stdout Output Fidelity</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-[#3ccb57] font-bold block">20 pts</span>
                    <span className="text-slate-300 text-[11px]">Syntax & Variables</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-[#3ccb57] font-bold block">10 pts</span>
                    <span className="text-slate-300 text-[11px]">Clean Code & Style</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#3ccb57]/10 to-transparent border border-[#3ccb57]/20 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Automated Starter Solution:</span>
                Every challenge includes exact numbered Requirements, Pattern Rules, Example Terminal Output and a ready-to-run <code className="text-[#3ccb57] font-mono">public class Solution</code> boilerplate.
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#040816]/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-[#3ccb57]/10 border border-[#3ccb57]/30 text-[#3ccb57] font-bold">
              {selectedTag || '#General'}
            </span>
            <span>•</span>
            <span className="text-white font-semibold">{progDifficulty}</span>
            <span>•</span>
            <span className="text-[#3ccb57]">{difficultyMultipliers[progDifficulty]?.exp}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={isGenerating}
              className="px-8 py-3 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.35)] disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Synthesizing Java Lab...</span>
                </>
              ) : (
                <span>Launch Coding Challenge →</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   3. CODE ANALYSIS MODAL
   (Оранжевая иконка и бейдж NO IDE, интерфейс в фирменном зелёном)
   ========================================================================== */
export const AnalysisModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  analysisCustomTitle: string;
  setAnalysisCustomTitle: (s: string) => void;
  analysisDifficulty: string;
  setAnalysisDifficulty: (d: string) => void;
  selectedTag: string;
  setSelectedTag: (t: string) => void;
  availableTags: string[];
  analysisAttachedFiles: AttachedFile[];
  setAnalysisAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  analysisPrompt: string;
  setAnalysisPrompt: (s: string) => void;
  isGenerating: boolean;
  onLaunch: () => void;
}> = ({
  isOpen, onClose, analysisCustomTitle, setAnalysisCustomTitle, analysisDifficulty, setAnalysisDifficulty,
  selectedTag, setSelectedTag, availableTags, analysisAttachedFiles, setAnalysisAttachedFiles,
  analysisPrompt, setAnalysisPrompt, isGenerating, onLaunch
}) => {
  if (!isOpen) return null;

  const difficultyTiers: Record<string, { exp: string; desc: string }> = {
    'Very Easy': { exp: '0.5x Exp', desc: 'Single loop, linear accumulator' },
    'Easy': { exp: '0.8x Exp', desc: 'Double loop, simple arithmetic mutations' },
    'Standard': { exp: '1.0x Exp', desc: 'Nested loops, off-by-one indices, pre/post-increments' },
    'Hard': { exp: '1.5x Exp', desc: 'Complex conditionals, state mutations & skips' },
    'Challenge': { exp: '2.5x Exp', desc: 'Brain-twister edge cases with multi-variable tracking' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1700px] h-[92vh] rounded-3xl border border-white/10 bg-[#060c20]/98 flex flex-col shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* HEADER: ОРАНЖЕВАЯ ИКОНКА И БЕЙДЖ, ОСТАЛЬНОЕ В СТИЛЕ СИСТЕМЫ */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#040816]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-orange-400/10 border border-orange-400/30 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.25)]">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">Code Analysis & Mental Tracing</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-400/10 text-orange-400 border border-orange-400/30 uppercase">
                  No IDE / Mental Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Step through loops in your head and predict stdout without executing code</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2-COLUMN BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                01 • Tracing Context & Snippets
              </span>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
                <SearchableTagDropdown selectedTag={selectedTag} onSelectTag={setSelectedTag} availableTags={availableTags} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Drill Title (Optional)</label>
                  <span className="text-[10px] font-mono text-slate-500">{analysisCustomTitle.length}/80</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={analysisCustomTitle}
                  onChange={(e) => setAnalysisCustomTitle(e.target.value)}
                  placeholder="e.g. Nested Loop Bounds & Off-by-One Tracing (max 80 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Specific Operators or Patterns to Trace</label>
                  <span className="text-[10px] font-mono text-slate-500">{analysisPrompt.length}/1000</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={analysisPrompt}
                  onChange={(e) => setAnalysisPrompt(e.target.value)}
                  placeholder="e.g. Focus on ++i pre-increment vs i++, ternary operators... (max 1000 chars)"
                  className="w-full p-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57] resize-none"
                />
              </div>

              <div className="[&_.flex-wrap]:max-h-24 [&_.flex-wrap]:overflow-y-auto [&_.flex-wrap]:pr-1 [&_.flex-wrap]:scrollbar-thin">
                <FileDropzone
                  files={analysisAttachedFiles}
                  onFilesAdded={(newF) => setAnalysisAttachedFiles((prev) => [...prev, ...newF])}
                  onFileRemoved={(idx) => setAnalysisAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  label={`Attach Snippets or Reference Slides ${analysisAttachedFiles.length > 0 ? `• ${analysisAttachedFiles.length} file(s)` : ''}`}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-[#3ccb57] tracking-wider block border-b border-white/5 pb-2">
                02 • Cognitive Complexity
              </span>

              {/* Difficulty selector (Зелёный активный выбор) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Select Complexity Tier</label>
                <div className="grid grid-cols-5 gap-2">
                  {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => {
                    const isSelected = analysisDifficulty === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setAnalysisDifficulty(lvl)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold shadow-[0_0_15px_rgba(60,203,87,0.3)]'
                            : 'bg-black/60 border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="block text-xs font-bold truncate">{lvl}</span>
                        <span className={`block text-[10px] font-mono mt-0.5 ${isSelected ? 'text-black/80 font-bold' : 'text-[#3ccb57]'}`}>
                          {difficultyTiers[lvl]?.exp}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {difficultyTiers[analysisDifficulty]?.desc}
                </p>
              </div>

              {/* Protocol Card */}
              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#3ccb57]" />
                  <span>The No-IDE Tracing Protocol</span>
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  During the drill, no code execution is allowed. You must mentally track stack variables and loops, enter your scratchpad notes, and submit the exact console output string.
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-[#3ccb57]/10 border border-[#3ccb57]/20 text-[11px] text-[#3ccb57] font-mono">
                  100% exact stdout match = 100 Exp • Iteration breakdown provided if wrong
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#040816]/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-[#3ccb57]/10 border border-[#3ccb57]/30 text-[#3ccb57] font-bold">
              {selectedTag || '#General'}
            </span>
            <span>•</span>
            <span className="text-white font-semibold">{analysisDifficulty}</span>
            <span>•</span>
            <span className="text-[#3ccb57]">{difficultyTiers[analysisDifficulty]?.exp}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={isGenerating}
              className="px-8 py-3 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.35)] disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Synthesizing Tracing Puzzle...</span>
                </>
              ) : (
                <span>Launch Mental Tracing →</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};




/* ==========================================================================
   UPLOAD MODAL
   ========================================================================== */
export const UploadModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  uploadStatus: string | null;
  ingestionFiles: AttachedFile[];
  setIngestionFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  uploadText: string;
  setUploadText: (s: string) => void;
  onUpload: () => void;
}> = ({ isOpen, onClose, uploadStatus, ingestionFiles, setIngestionFiles, uploadText, setUploadText, onUpload }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#3ccb57]" /> Ingest Lecture Notes & Generate Curriculum Tags
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {uploadStatus && (
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-mono leading-relaxed">
            {uploadStatus}
          </div>
        )}

        <FileDropzone
          files={ingestionFiles}
          onFilesAdded={(newF) => setIngestionFiles((prev) => [...prev, ...newF])}
          onFileRemoved={(idx) => setIngestionFiles((prev) => prev.filter((_, i) => i !== idx))}
          label="Drop Slides (PDF / Text / Code)"
        />

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">Or Paste Raw Lecture Notes</label>
            <span className="text-[10px] font-mono text-slate-500">{uploadText.length}/50000</span>
          </div>
          <textarea
            rows={6}
            maxLength={50000}
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Paste syllabus notes, lecture takeaways, or code snippets here... (max 50,000 chars)"
            className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button onClick={onClose} className="text-xs text-slate-400 cursor-pointer">Close</button>
          <button onClick={onUpload} className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black cursor-pointer shadow-[0_0_15px_rgba(60,203,87,0.3)]">
            Run AI Audit & Index Tag
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   🏆 LEADERBOARD MODAL: PODIUM & UNBOUNDED RATING
   ========================================================================== */
export const LeaderboardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserSession;
  leaderboardEntries: LeaderboardEntry[];
  onConsentAccepted: (realName?: string) => void;
  isLoading: boolean;
}> = ({ isOpen, onClose, user, leaderboardEntries, onConsentAccepted, isLoading }) => {
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(user.leaderboardAccepted || false);
  const [consentRealName, setConsentRealName] = useState(user.realName || '');
  const [selectedYearFilter, setSelectedYearFilter] = useState<'all' | StudyYear>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredEntries = leaderboardEntries.filter((e) => {
    const matchesYear = selectedYearFilter === 'all' || e.studyYear === selectedYearFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || e.nickname.toLowerCase().includes(q) || (e.realName || '').toLowerCase().includes(q);
    return matchesYear && matchesSearch;
  });

  const top3 = filteredEntries.slice(0, 3);
  const restOfLeaderboard = filteredEntries.slice(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-7xl h-[92vh] rounded-3xl border border-white/10 bg-[#040816]/98 flex flex-col shadow-2xl overflow-hidden">
        
        {!hasAcceptedConsent ? (
          <div className="max-w-xl mx-auto py-12 space-y-6 text-center animate-fade-in overflow-y-auto">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[#3ccb57]/10 text-[#3ccb57] border border-[#3ccb57]/30 shadow-[0_0_30px_rgba(60,203,87,0.2)]">
              <Trophy className="h-10 w-10 animate-pulse" />
            </div>

            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">Join the revISE Leaderboard</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Compete with fellow Immersive Software Engineering students, track your unbounded mastery index, and climb the ranks.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-left text-sm text-slate-300 space-y-3 leading-relaxed">
              <p className="font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#3ccb57]" /> Leaderboard Privacy & Fairness Rules:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-400">
                <li>Your nickname, year, monthly accuracy %, and Experience will be public to UL peers.</li>
                <li>Hard & Challenge tasks award up to 2.5x Exp.</li>
                <li>Real Name & Surname are strictly optional.</li>
                <li><strong className="text-white">Security:</strong> Suspiciously fast quiz completions (speedruns) are caught and automatically invalidated by the system to ensure fairness. Database RLS prevents unauthorized record edits.</li>
                <li>You can toggle «Hide myself from Leaderboard» anytime in Settings.</li>
              </ul>
            </div>

            <div className="text-left space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                Real Name & Surname (Optional)
              </label>
              <input
                type="text"
                value={consentRealName}
                onChange={(e) => setConsentRealName(e.target.value)}
                placeholder="e.g. Kiril Kuzmenko (or leave empty)"
                className="w-full p-4 rounded-xl bg-black/60 border border-white/10 text-sm text-white focus:outline-none focus:border-[#3ccb57]"
              />
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <button onClick={onClose} className="px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => { setHasAcceptedConsent(true); onConsentAccepted(consentRealName.trim() || undefined); }}
                className="px-8 py-3.5 rounded-xl font-bold text-sm bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer"
              >
                Accept & Enter Leaderboard
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 shrink-0 bg-[#060c20]/50">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#3ccb57]/10 flex items-center justify-center border border-[#3ccb57]/30 shadow-[0_0_15px_rgba(60,203,87,0.2)]">
                  <Trophy className="h-6 w-6 text-[#3ccb57]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">revISE Leaderboard</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Unbounded Rating = Total Exp × (Monthly Accuracy % / 100)</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 cursor-pointer"><X className="h-6 w-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* === ПОДИУМ ДЛЯ ТОП 3 === */}
              {!isLoading && top3.length > 0 && (
                <div className="pt-8 pb-12 flex justify-center items-end gap-2 sm:gap-6 bg-gradient-to-b from-transparent to-[#3ccb57]/[0.02] border-b border-white/5">
                  
                  {/* Ранг 2 (Слева) */}
                  {top3[1] && (
                    <div className="flex flex-col items-center animate-fade-in" style={{ animationDelay: '0.1s' }}>
                      <UserAvatar url={(top3[1] as any).avatarUrl} name={top3[1].nickname} size={64} className="border-[3px] border-slate-400/50 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-3 z-10 bg-[#060c20]" />
                      <span className="font-bold text-white text-sm mb-1">{top3[1].nickname}</span>
                      <span className="text-xs text-[#3ccb57] font-mono font-bold mb-3">{top3[1].totalScore.toFixed(0)}</span>
                      <div className="w-24 sm:w-32 h-28 bg-gradient-to-t from-black to-slate-800/80 border-t-4 border-slate-400/80 rounded-t-lg flex items-start justify-center pt-4 relative shadow-2xl">
                        <span className="text-4xl font-black text-slate-400 opacity-60">2</span>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                      </div>
                    </div>
                  )}

                  {/* Ранг 1 (Центр) */}
                  {top3[0] && (
                    <div className="flex flex-col items-center animate-fade-in z-20">
                      <div className="relative mb-3">
                        <div className="absolute -inset-3 bg-[#3ccb57]/20 rounded-full blur-xl animate-pulse" />
                        <UserAvatar url={(top3[0] as any).avatarUrl} name={top3[0].nickname} size={84} className="border-[4px] border-[#3ccb57] shadow-[0_0_30px_rgba(60,203,87,0.4)] bg-[#060c20]" />
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]">👑</div>
                      </div>
                      <span className="font-bold text-white text-base mb-1 drop-shadow-md">{top3[0].nickname}</span>
                      <span className="text-sm text-[#3ccb57] font-mono font-black mb-4 drop-shadow-[0_0_8px_rgba(60,203,87,0.4)]">{top3[0].totalScore.toFixed(0)}</span>
                      <div className="w-28 sm:w-36 h-36 bg-gradient-to-t from-black to-[#0d2a15] border-t-4 border-[#3ccb57] rounded-t-lg flex items-start justify-center pt-4 relative shadow-[0_-10px_40px_rgba(60,203,87,0.15)]">
                        <span className="text-5xl font-black text-[#3ccb57] opacity-80">1</span>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                      </div>
                    </div>
                  )}

                  {/* Ранг 3 (Справа) */}
                  {top3[2] && (
                    <div className="flex flex-col items-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
                      <UserAvatar url={(top3[2] as any).avatarUrl} name={top3[2].nickname} size={64} className="border-[3px] border-amber-600/60 shadow-[0_0_20px_rgba(217,119,6,0.2)] mb-3 z-10 bg-[#060c20]" />
                      <span className="font-bold text-white text-sm mb-1">{top3[2].nickname}</span>
                      <span className="text-xs text-[#3ccb57] font-mono font-bold mb-3">{top3[2].totalScore.toFixed(0)}</span>
                      <div className="w-24 sm:w-32 h-24 bg-gradient-to-t from-black to-[#291708] border-t-4 border-amber-700/80 rounded-t-lg flex items-start justify-center pt-3 relative shadow-2xl">
                        <span className="text-4xl font-black text-amber-700/80 opacity-60">3</span>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Фильтры и поиск для таблицы */}
              <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#040816] sticky top-0 z-30 border-b border-white/5">
                <div className="flex flex-wrap items-center gap-2">
                  {[ { id: 'all', label: 'All Cohorts' }, { id: 'year1', label: 'Year 1' }, { id: 'year2', label: 'Year 2' }, { id: 'year3', label: 'Year 3' }, { id: 'year4', label: 'Year 4' }].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedYearFilter(f.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedYearFilter === f.id
                          ? 'bg-[#3ccb57] text-black shadow-[0_0_15px_rgba(60,203,87,0.2)]'
                          : 'bg-black/50 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by nickname or real name..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3ccb57]"
                  />
                </div>
              </div>

              {/* Таблица */}
              <div className="px-6 pb-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-4 w-16 text-center">Rank</th>
                      <th className="py-4 px-4">Student</th>
                      <th className="py-4 px-4 hidden md:table-cell">Real Name</th>
                      <th className="py-4 px-4 text-center">Accuracy</th>
                      <th className="py-4 px-4 text-center">Experience</th>
                      <th className="py-4 px-4 text-right text-[#3ccb57]">Total Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400">
                          <Loader2 className="h-8 w-8 animate-spin text-[#3ccb57] mx-auto mb-3" />
                          <span>Calculating Standings...</span>
                        </td>
                      </tr>
                    ) : restOfLeaderboard.length === 0 && top3.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 bg-white/[0.01] rounded-b-xl">
                          No students found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      restOfLeaderboard.map((student) => (
                        <tr
                          key={student.userId}
                          className={`transition-colors hover:bg-white/[0.02] ${
                            student.isCurrentUser ? 'bg-[#3ccb57]/5 border-l-4 border-l-[#3ccb57]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                            #{student.rank}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <UserAvatar url={(student as any).avatarUrl} name={student.nickname} size={32} />
                              <span className="font-bold text-white">{student.nickname}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-black/50 border border-white/10 text-slate-400 uppercase">
                                {student.studyYear}
                              </span>
                              {student.isCurrentUser && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#3ccb57]/20 border border-[#3ccb57]/30 text-[#3ccb57] font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 hidden md:table-cell">
                            {student.realName || <span className="opacity-50">—</span>}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-slate-300">
                            {student.monthlyAccuracy}%
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-[#3ccb57]">
                            {student.isePoints}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-base text-[#3ccb57]">
                            {student.totalScore.toFixed(1)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

        </>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   HISTORY MODAL (ПОЛНЫЙ РАЗБОР ВАРИАНТОВ + ИСПРАВЛЕННЫЙ ГРАФИК 26 ЧИСЛА)
   ========================================================================== */
export const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  historyList: TestHistoryItem[];
  onStartWeakQuiz: (topics: Array<{ topic: string; tagName: string }>) => void;
  onFetchDetails: (id: string) => Promise<void>;
}> = ({ isOpen, onClose, historyList, onStartWeakQuiz }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiModelUsage, setAiModelUsage] = useState(() => getGeminiModelUsage());

  useEffect(() => {
    if (!isOpen) return;
    const refreshModelUsage = () => setAiModelUsage(getGeminiModelUsage());
    refreshModelUsage();
    window.addEventListener('revise-gemini-usage-updated', refreshModelUsage);
    return () => window.removeEventListener('revise-gemini-usage-updated', refreshModelUsage);
  }, [isOpen]);

  const [rangePreset, setRangePreset] = useState<'7' | '14' | 'custom'>('14');

  const formatIrishDateTime = (isoDate?: string, fallback = '') => {
    if (!isoDate) return { dateStr: fallback || '—', timeStr: '' };
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return { dateStr: fallback || '—', timeStr: '' };
    const dateStr = d.toLocaleDateString('en-IE', {
      timeZone: 'Europe/Dublin',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const timeStr = d.toLocaleTimeString('en-IE', {
      timeZone: 'Europe/Dublin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { dateStr, timeStr };
  };

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return formatLocalDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()));

  const handlePresetChange = (preset: '7' | '14' | 'custom') => {
    setRangePreset(preset);
    if (preset !== 'custom') {
      const daysCount = parseInt(preset, 10);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (daysCount - 1));
      setStartDate(formatLocalDate(start));
      setEndDate(formatLocalDate(end));
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (rangePreset !== 'custom') {
      const daysCount = parseInt(rangePreset, 10);
      const [y, m, d] = newStart.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      dt.setDate(dt.getDate() + (daysCount - 1));
      setEndDate(formatLocalDate(dt));
    }
  };

  // ИСПРАВЛЕННЫЙ РАСЧЁТ ДАТ ГРАФИКА: 100% ГАРАНТИЯ ВКЛЮЧЕНИЯ 26 ЧИСЛА
  const chartDays = useMemo(() => {
    const days = [];
    const parseLocalYMD = (str: string) => {
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0); // Полдень исключает скачки перехода времени
    };

    const curr = parseLocalYMD(startDate);
    const end = parseLocalYMD(endDate);

    while (curr.getTime() <= end.getTime() + 3600000) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const itemsOnDay = historyList.filter((item) => {
        if (!item.rawDate) return false;
        const itemDate = new Date(item.rawDate);
        const itemY = itemDate.getFullYear();
        const itemM = String(itemDate.getMonth() + 1).padStart(2, '0');
        const itemD = String(itemDate.getDate()).padStart(2, '0');
        return `${itemY}-${itemM}-${itemD}` === dateStr;
      });

      const averageScore = (items: TestHistoryItem[]) =>
        items.length > 0
          ? Math.round(items.reduce((total, it) => total + (it.maxScore > 0 ? (it.score / it.maxScore) * 100 : 0), 0) / items.length)
          : 0;

      days.push({
        dateStr,
        displayDate: `${d}/${m}`,
        quizScore: averageScore(itemsOnDay.filter((it) => it.type.toLowerCase().includes('quiz'))),
        codeScore: averageScore(itemsOnDay.filter((it) => it.type.toLowerCase().includes('code'))),
        analysisScore: averageScore(itemsOnDay.filter((it) => it.type.toLowerCase().includes('analysis') || it.type.toLowerCase().includes('tracing'))),
        totalTests: itemsOnDay.length,
      });

      curr.setDate(curr.getDate() + 1);
      if (days.length > 40) break;
    }
    return days;
  }, [startDate, endDate, historyList]);

  const exportHistoryDetails = (item: TestHistoryItem) => {
    if (!item.details?.length) return;
    const lines = [
      item.title,
      `${item.type} · ${item.score}/${item.maxScore} · ${item.pointsEarned || 0} Exp`,
      `Date: ${item.rawDate ? new Date(item.rawDate).toLocaleString() : item.date}`,
      `Time: ${item.timeSpent}`,
      '',
      item.weakSpotsAdvice ? `Study advice: ${item.weakSpotsAdvice}` : '',
      '',
      ...item.details.flatMap((detail, index) => [
        `Question ${index + 1}${detail.topic ? ` · ${detail.topic}` : ''}`,
        detail.questionText,
        detail.codeSnippet ? `Code:\n${detail.codeSnippet}` : '',
        `Your answer: ${detail.userAnswer.join(', ') || 'No answer'}`,
        `Correct answer${detail.correctAnswers.length === 1 ? '' : 's'}: ${detail.correctAnswers.join(', ') || 'Not available'}`,
        `Result: ${detail.isCorrect ? 'Correct' : 'Incorrect'} · ${detail.points} pts`,
        detail.slideTitle ? `Study material: ${detail.slideTitle}` : '',
        `Explanation: ${detail.explanation || 'No explanation saved.'}`,
        detail.responseTimeSeconds !== undefined ? `Response time: ${detail.responseTimeSeconds}s` : '',
        '',
      ].filter(Boolean)),
    ].filter(Boolean);
    const file = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    const safeTitle = item.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 80) || 'quiz';
    anchor.href = url;
    anchor.download = `${safeTitle}-details.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(
      (h) => h.title.toLowerCase().includes(q) || h.type.toLowerCase().includes(q) || (h.aiFeedback || '').toLowerCase().includes(q)
    );
  }, [historyList, searchQuery]);

  const weakAreas = useMemo(() => {
    const areas = new Map<string, { topic: string; tagName: string; correct: number; total: number }>();
    historyList.forEach((item) => {
      const tagName = item.title.match(/#[\w-]+/)?.[0] || '#General';
      item.details?.forEach((detail) => {
        const topic = detail.topic?.trim() || detail.questionText.split(/[?.!]/)[0].trim().slice(0, 64) || 'Untitled topic';
        const key = `${tagName}:${topic.toLowerCase()}`;
        const area = areas.get(key) || { topic, tagName, correct: 0, total: 0 };
        area.total += 1;
        if (detail.isCorrect) area.correct += 1;
        areas.set(key, area);
      });
    });
    return Array.from(areas.values())
      .filter((area) => area.total > area.correct)
      .map((area) => ({ ...area, mastery: Math.round((area.correct / area.total) * 100) }))
      .sort((a, b) => a.mastery - b.mastery || b.total - a.total)
      .slice(0, 5);
  }, [historyList]);

  const activityByDay = useMemo(() => {
    const days = new Map<string, { attempts: number; score: number }>();
    historyList.forEach((item) => {
      if (!item.rawDate) return;
      const key = item.rawDate.split('T')[0];
      const value = days.get(key) || { attempts: 0, score: 0 };
      value.attempts += 1;
      value.score += item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
      days.set(key, value);
    });
    return days;
  }, [historyList]);

  const heatmapDays = useMemo(() => {
    const days = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    for (let offset = 83; offset >= 0; offset -= 1) {
      const day = new Date(end);
      day.setDate(day.getDate() - offset);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, '0');
      const d = String(day.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const activity = activityByDay.get(key);
      const accuracy = activity && activity.attempts > 0 ? activity.score / activity.attempts : 0;
      const level = !activity ? 0 : accuracy >= 80 ? 4 : accuracy >= 60 ? 3 : accuracy >= 40 ? 2 : 1;
      days.push({ 
        key, 
        level, 
        attempts: activity?.attempts || 0, 
        accuracy: Math.round(accuracy),
        displayDate: `${d}/${m}`
      });
    }
    return days;
  }, [activityByDay]);

  const streakStats = useMemo(() => {
    const activeDates = Array.from(activityByDay.keys()).sort((a, b) => b.localeCompare(a));
    if (activeDates.length === 0) return { days: 0, lastActiveDaysAgo: null as number | null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActive = new Date(`${activeDates[0]}T00:00:00`);
    const lastActiveDaysAgo = Math.floor((today.getTime() - lastActive.getTime()) / 86400000);
    if (lastActiveDaysAgo > 3) return { days: 0, lastActiveDaysAgo };
    let days = 1;
    for (let index = 1; index < activeDates.length; index += 1) {
      const previous = new Date(`${activeDates[index - 1]}T00:00:00`);
      const current = new Date(`${activeDates[index]}T00:00:00`);
      if ((previous.getTime() - current.getTime()) / 86400000 > 3) break;
      days += 1;
    }
    return { days, lastActiveDaysAgo };
  }, [activityByDay]);

  const mcqResponseTimes = historyList.flatMap((item) =>
    (item.details || []).flatMap((detail) =>
      detail.questionType !== 'text' && detail.responseTimeSeconds !== undefined ? [detail.responseTimeSeconds] : []
    )
  );
  const averageMcqSeconds = mcqResponseTimes.length > 0
    ? Math.round(mcqResponseTimes.reduce((total, seconds) => total + seconds, 0) / mcqResponseTimes.length)
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1800px] h-[92vh] rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 flex flex-col gap-4 sm:gap-6 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-[#3ccb57] shrink-0" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">History &amp; Statistics</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">Detailed quiz answers are kept for 14 days. Expand a test to view full breakdown.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* ЛЕВАЯ КОЛОНКА */}
          <div className="min-h-0 lg:overflow-y-auto lg:pr-2 space-y-4 sm:space-y-5">
            <div className="p-4 sm:p-6 rounded-2xl bg-[#030714] border border-white/10 space-y-4 sm:space-y-5 relative shadow-inner">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
                <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-sky-400"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400 shadow-[0_0_8px_#38bdf8]" /> Quiz</span>
                  <span className="flex items-center gap-1.5 text-[#3ccb57]"><span className="h-2.5 w-2.5 rounded-sm bg-[#3ccb57] shadow-[0_0_8px_#3ccb57]" /> Code</span>
                  <span className="flex items-center gap-1.5 text-orange-400"><span className="h-2.5 w-2.5 rounded-sm bg-orange-400 shadow-[0_0_8px_#fb923c]" /> Analysis</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 rounded-xl bg-black/60 border border-white/10 text-xs font-mono">
                    {(['7', '14', 'custom'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePresetChange(p)}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          rangePreset === p ? 'bg-[#3ccb57] text-black font-bold shadow-[0_0_10px_rgba(60,203,87,0.3)]' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p === 'custom' ? 'Custom' : `${p}D`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="bg-black/60 border border-white/10 px-2 py-1 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#3ccb57]"
                    />
                    <span className="text-slate-500">→</span>
                    <input
                      type="date"
                      value={endDate}
                      disabled={rangePreset !== 'custom'}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`bg-black/60 border border-white/10 px-2 py-1 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#3ccb57] ${
                        rangePreset !== 'custom' ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="relative pt-6 pb-2 overflow-x-auto scrollbar-thin">
                <div className="min-w-[340px] sm:min-w-0 relative">
                  <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none">
                    {[100, 75, 50, 25, 0].map((val) => (
                      <div key={val} className="w-full flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-7 text-right">{val}%</span>
                        <div className="flex-1 border-b border-white/[0.06] border-dashed" />
                      </div>
                    ))}
                  </div>

                  <div className="relative z-10 pl-9 pr-2 h-52 sm:h-56 flex items-end justify-between gap-1 sm:gap-2">
                    {chartDays.map((day, dIdx) => {
                      const isNearLeftEdge = dIdx <= 2;
                      const isNearRightEdge = dIdx >= chartDays.length - 3;
                      const tooltipPosClass = isNearLeftEdge
                        ? 'left-0 translate-x-0'
                        : isNearRightEdge
                        ? 'right-0 translate-x-0'
                        : 'left-1/2 -translate-x-1/2';

                      return (
                        <div key={day.dateStr} className="group relative flex-1 flex flex-col items-center h-full justify-end hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer">
                          <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-2">
                            <div style={{ height: `${day.quizScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.quizScore > 0 ? 'bg-gradient-to-t from-sky-600 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'h-1 bg-white/5'}`} />
                            <div style={{ height: `${day.codeScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.codeScore > 0 ? 'bg-gradient-to-t from-emerald-600 to-[#3ccb57] shadow-[0_0_8px_rgba(60,203,87,0.4)]' : 'h-1 bg-white/5'}`} />
                            <div style={{ height: `${day.analysisScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.analysisScore > 0 ? 'bg-gradient-to-t from-amber-600 to-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 'h-1 bg-white/5'}`} />
                          </div>

                          <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-slate-400 truncate w-full text-center block pt-1.5">
                            {day.displayDate}
                          </span>

                          <div className={`absolute top-2 hidden group-hover:block z-50 w-52 sm:w-56 p-3 rounded-xl border border-white/15 bg-[#060c20]/98 backdrop-blur-2xl shadow-[0_4px_25px_rgba(0,0,0,0.8)] text-[11px] pointer-events-none animate-fade-in ${tooltipPosClass}`}>
                            <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-2 flex justify-between">
                              <span>{day.displayDate}</span>
                              <span className="text-[#3ccb57] font-mono">{day.totalTests} tests</span>
                            </div>
                            <div className="space-y-1.5 font-mono">
                              <div className="flex justify-between text-sky-400"><span>Quiz:</span><strong>{day.quizScore > 0 ? `${day.quizScore}%` : '—'}</strong></div>
                              <div className="flex justify-between text-[#3ccb57]"><span>Code:</span><strong>{day.codeScore > 0 ? `${day.codeScore}%` : '—'}</strong></div>
                              <div className="flex justify-between text-orange-400"><span>Analysis:</span><strong>{day.analysisScore > 0 ? `${day.analysisScore}%` : '—'}</strong></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="search"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search past tests by title, tag, or feedback..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3ccb57]"
              />
            </div>

            {/* СПИСОК ИСТОРИИ */}
            <div className="space-y-3">
              {filteredHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No tests matching your query.</p>
              ) : (
                filteredHistory.map((h) => {
                  const isExpanded = expandedId === h.id;
                  const isQuiz = h.type === 'Quiz';
                  const isCode = h.type === 'Code Challenge';
                  
                  const typeColor = isQuiz
                    ? { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' }
                    : isCode
                    ? { text: 'text-[#3ccb57]', bg: 'bg-[#3ccb57]/10', border: 'border-[#3ccb57]/20' }
                    : { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };

                  const { dateStr: irishDate, timeStr: irishTime } = formatIrishDateTime(h.rawDate, h.date);

                  return (
                    <div key={h.id} className={`p-4 rounded-xl border bg-black/40 space-y-3 transition-all ${isQuiz ? 'border-sky-400/20' : isCode ? 'border-white/10' : 'border-orange-400/20'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : h.id)}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${typeColor.text} ${typeColor.bg} ${typeColor.border}`}>
                            {h.type}
                          </span>
                          <span className="text-sm font-bold text-white">{h.title}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono font-bold ${typeColor.text}`}>+{h.pointsEarned || 0} Exp</span>
                          <div className="flex flex-col items-end text-right font-mono">
                            <span className="text-xs font-semibold text-slate-200 leading-tight">{irishDate}</span>
                            <span className="text-[11px] text-slate-400 leading-tight">{irishTime}{h.timeSpent ? ` · ${h.timeSpent}` : ''}</span>
                          </div>
                          <span className={`text-base font-black font-mono ${typeColor.text}`}>{h.score}/{h.maxScore}</span>
                          <button
                            type="button"
                            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* РАСКРЫТИЕ РЕЗУЛЬТАТОВ (ВАРИАНТЫ КАРТОЧКАМИ КАК В САМОМ ТЕСТЕ) */}
                      {isExpanded && (
                        <div className="pt-2 space-y-4 border-t border-white/10 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                          {h.weakSpotsAdvice && (
                            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                              <strong className="font-bold flex items-center gap-1.5 text-amber-300">
                                <Brain className="h-4 w-4" /> AI Study Advice & Weak Spots:
                              </strong>
                              <p className="leading-relaxed text-slate-300">{h.weakSpotsAdvice}</p>
                            </div>
                          )}

                          {h.details && h.details.length > 0 ? (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Question Breakdown:</span>
                                <button
                                  type="button"
                                  onClick={() => exportHistoryDetails(h)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-[#3ccb57]/30 hover:bg-[#3ccb57]/[0.06] hover:text-[#3ccb57] cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Export full details (.txt)
                                </button>
                              </div>

                              {h.details.map((q, qIdx) => (
                                <div key={qIdx} className={`p-4 sm:p-5 rounded-2xl border ${q.isCorrect ? 'border-[#3ccb57]/20 bg-[#3ccb57]/5' : 'border-red-500/20 bg-red-950/20'} space-y-3 text-xs`}>
                                  
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                                      {q.isCorrect ? <CheckCircle2 className="h-4 w-4 text-[#3ccb57]" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                      Question {qIdx + 1}
                                    </span>
                                    <span className={`font-mono font-bold px-2 py-1 rounded-lg ${q.isCorrect ? 'bg-[#3ccb57]/10 text-[#3ccb57]' : 'bg-red-500/10 text-red-400'}`}>
                                      {q.points} pts
                                    </span>
                                  </div>
                                  
                                  <p className="text-slate-200 text-sm font-medium">{q.questionText}</p>
                                  {q.codeSnippet && <pre className="p-3 rounded-xl bg-black border border-white/5 font-mono text-xs text-[#3ccb57] overflow-x-auto">{q.codeSnippet}</pre>}

                                  {/* КАРТОЧКИ ВАРИАНТОВ ОТВЕТА (КАК В САМОМ ТЕСТЕ) */}
                                  {(q as any).options && (q as any).options.length > 0 ? (
                                    <div className="space-y-2.5 mt-3">
                                      {(q as any).options.map((opt: string, optI: number) => {
                                        const isUser = (q.userAnswer || []).includes(opt);
                                        const isCorr = (q.correctAnswers || []).includes(opt);

                                        let cardStyle = 'border-white/10 bg-black/40 text-slate-300';
                                        let badgeText = '';
                                        let badgeStyle = '';

                                        if (isCorr && isUser) {
                                          cardStyle = 'border-[#3ccb57] bg-[#3ccb57]/15 text-white font-medium shadow-[0_0_15px_rgba(60,203,87,0.15)]';
                                          badgeText = 'Your correct answer';
                                          badgeStyle = 'bg-[#3ccb57] text-black font-bold';
                                        } else if (isCorr && !isUser) {
                                          cardStyle = 'border-[#3ccb57]/60 bg-[#3ccb57]/10 text-emerald-200';
                                          badgeText = 'Correct answer';
                                          badgeStyle = 'border border-[#3ccb57] text-[#3ccb57]';
                                        } else if (!isCorr && isUser) {
                                          cardStyle = 'border-red-500/80 bg-red-950/30 text-red-200';
                                          badgeText = 'Your wrong answer';
                                          badgeStyle = 'bg-red-500 text-white font-bold';
                                        }

                                        return (
                                          <div key={optI} className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm transition-all ${cardStyle}`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
                                                isCorr ? 'border-[#3ccb57] bg-[#3ccb57] text-black' : isUser ? 'border-red-500 bg-red-500 text-white' : 'border-white/20 text-transparent'
                                              }`}>
                                                <Check className="h-3 w-3 stroke-[3]" />
                                              </span>
                                              <span className="leading-relaxed">{opt}</span>
                                            </div>
                                            {badgeText && (
                                              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ml-2 shrink-0 ${badgeStyle}`}>
                                                {badgeText}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    /* Фолбэк для старых тестов, где опции не сохранились в БД */
                                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-xs">
                                      <div className="text-slate-400">Your Answer: <span className={q.isCorrect ? 'text-[#3ccb57] font-bold' : 'text-red-400 font-bold'}>{q.userAnswer?.join(', ') || 'No answer'}</span></div>
                                      <div className="text-slate-400">Correct Answer: <span className="text-[#3ccb57] font-bold">{q.correctAnswers?.join(', ')}</span></div>
                                    </div>
                                  )}

                                  {/* ОБЪЯСНЕНИЕ ИИ СНИЗУ ПОД ВАРИАНТАМИ */}
                                  <div className="p-3.5 rounded-xl bg-[#030714] text-xs text-slate-300 leading-relaxed border border-white/5 mt-3 shadow-inner">
                                    <strong className="text-[#3ccb57] block mb-1 font-mono uppercase tracking-wider text-[11px]">AI Explanation:</strong>
                                    {q.explanation}
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                    {q.topic && <span>Topic: <span className="text-slate-300">{q.topic}</span></span>}
                                    {q.slideTitle && <span>Source: <span className="text-sky-300">{q.slideTitle}</span></span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 leading-relaxed">
                              <strong className={`${typeColor.text} block mb-1`}>AI Feedback: </strong>
                              {h.aiFeedback || 'No review details saved for this test.'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА */}
          <div className="min-h-0 lg:overflow-y-auto lg:pl-1 space-y-4 sm:space-y-5">
            <section className="p-4 sm:p-5 rounded-2xl bg-[#030714] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Brain className="h-4 w-4 text-[#3ccb57]" /> Knowledge Mastery</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Recent practice accuracy by day · last 12 weeks</p>
                </div>
                <button
                  type="button"
                  disabled={weakAreas.length === 0}
                  onClick={() => onStartWeakQuiz(weakAreas)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#3ccb57] text-black hover:bg-[#4ade67] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  Quiz weak topics
                </button>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="grid grid-rows-7 grid-flow-col auto-cols-max gap-1.5 min-w-max" aria-label="12-week learning accuracy heatmap">
                  {heatmapDays.map((day) => (
                    <div
                      key={day.key}
                      className={`group relative h-3 w-3 sm:h-4 sm:w-4 rounded-[3px] transition-transform hover:scale-125 cursor-pointer ${day.level === 0 ? 'bg-white/[0.07] hover:bg-white/20' : day.level === 1 ? 'bg-red-500/60' : day.level === 2 ? 'bg-amber-500/70' : day.level === 3 ? 'bg-lime-500/80' : 'bg-[#3ccb57]'}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-32 p-2 rounded-lg bg-black/90 border border-white/10 text-center text-[10px] shadow-xl pointer-events-none">
                        <span className="block font-bold text-white mb-0.5">{day.displayDate}</span>
                        {day.attempts > 0 ? (
                          <span className="text-[#3ccb57]">{day.attempts} tests · {day.accuracy}% avg</span>
                        ) : (
                          <span className="text-slate-500">No activity</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end items-center gap-1.5 text-[10px] text-slate-500">
                Less <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.07]" /><span className="h-2.5 w-2.5 rounded-sm bg-red-500/60" /><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/70" /><span className="h-2.5 w-2.5 rounded-sm bg-lime-500/80" /><span className="h-2.5 w-2.5 rounded-sm bg-[#3ccb57]" /> More
              </div>
            </section>

            <section className="p-4 sm:p-5 rounded-2xl bg-[#030714] border border-white/10 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-white">Topics to revisit</h4>
                <p className="text-[11px] text-slate-400 mt-1">Prioritized by your lowest accuracy in answered questions.</p>
              </div>
              {weakAreas.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Complete quizzes with question breakdowns to see which topics need more practice.</p>
              ) : (
                <div className="space-y-3">
                  {weakAreas.map((area) => {
                    const accuracyColor = area.mastery < 40 ? 'text-red-300' : area.mastery < 70 ? 'text-amber-300' : 'text-[#3ccb57]';
                    return (
                      <div key={`${area.tagName}:${area.topic}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-200" title={area.topic}>{area.topic}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{area.tagName} · {area.total - area.correct} missed of {area.total}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onStartWeakQuiz([{ topic: area.topic, tagName: area.tagName }])}
                            className="shrink-0 rounded-lg border border-[#3ccb57]/30 px-2.5 py-1 text-[10px] font-bold text-[#3ccb57] transition hover:bg-[#3ccb57]/10 cursor-pointer"
                          >
                            Practice
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div style={{ width: `${area.mastery}%` }} className={`h-full rounded-full ${area.mastery < 40 ? 'bg-red-400' : area.mastery < 70 ? 'bg-amber-400' : 'bg-[#3ccb57]'}`} />
                          </div>
                          <span className={`w-9 text-right font-mono text-[10px] ${accuracyColor}`}>{area.mastery}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#030714] border border-white/10">
                <p className="text-[11px] text-slate-400">Learning streak</p>
                <strong className="block text-2xl font-black text-[#3ccb57] mt-1">{streakStats.days} <span className="text-xs font-semibold text-slate-300">active days</span></strong>
                <p className="text-[10px] text-slate-500 mt-1">Resets after 3 consecutive days without a quiz or assignment.</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#030714] border border-white/10">
                <p className="text-[11px] text-slate-400">Average MCQ response</p>
                <strong className="block text-2xl font-black text-[#3ccb57] mt-1">{averageMcqSeconds === null ? '—' : `${averageMcqSeconds}s`}</strong>
                <p className="text-[10px] text-slate-500 mt-1">{mcqResponseTimes.length ? `From ${mcqResponseTimes.length} timed answers` : 'Tracked on new multiple/single choice quizzes'}</p>
              </div>
            </section>

            <section className="p-4 sm:p-5 rounded-2xl bg-[#030714] border border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white">AI models used on this device</h4>
              {aiModelUsage.length === 0 ? (
                <p className="text-[11px] text-slate-500">Models will appear here after they successfully generate a response.</p>
              ) : (
                <div className="space-y-2">
                  {[...aiModelUsage].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)).map((model) => (
                    <div key={model.modelName} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-mono text-slate-300">{model.modelName}</span>
                      <span className="shrink-0 text-slate-500">
                        Last used {new Date(model.lastUsedAt).toLocaleString(undefined, {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hourCycle: 'h23',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   SETTINGS MODAL: EDIT NICKNAME, REAL NAME, PASSWORD, LEADERBOARD TOGGLE & DELETE ACCOUNT
   ========================================================================== */
export const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserSession;
  onProfileUpdated: (updates: { nickname?: string; realName?: string; hideFromLeaderboard?: boolean; avatarUrl?: string }) => void;
  currentYear: StudyYear;
  onYearChange: (yr: StudyYear) => void;
  apiKeyInput: string;
  setApiKeyInput: (s: string) => void;
  onSaveKey: () => void;
  settingsStatus: string | null;
  onVortexToggled: (disabled: boolean) => void;
  uiTheme: 'standard' | 'glass' | 'dark_glass';
  onUiThemeToggled: (theme: 'standard' | 'glass' ) => void;
}> = ({ isOpen, onClose, user, onProfileUpdated, currentYear, onYearChange, apiKeyInput, setApiKeyInput, onSaveKey, settingsStatus, onVortexToggled, uiTheme, onUiThemeToggled }) => {
  const [activeTab, setActiveTab] = useState<'account' | 'data' | 'visual' | 'advanced'>('account');
  
  const [editableNickname, setEditableNickname] = useState(user.nickname || '');
  const [editableRealName, setEditableRealName] = useState(user.realName || '');
  const [hideLeaderboard, setHideLeaderboard] = useState(user.hideFromLeaderboard || false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showApiKey, setShowApiKey] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const [vortexDisabled, setVortexDisabled] = useState(user.disableVortex || false);

  const REQUIRED_DELETE_PHRASE = "I want to delete this account";

  if (!isOpen) return null;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('File is too large. Maximum size is 10 MB.');
      return;
    }
    setAvatarFile(file);
  };

  const handleAvatarCrop = async (base64Url: string) => {
    setAvatarFile(null);
    const { error } = await supabase.from('profiles').update({ avatar_url: base64Url }).eq('id', user.id);
    if (error) {
      setAvatarError(error.message);
    } else {
      onProfileUpdated({ avatarUrl: base64Url });
      setProfileMsg('Avatar updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    }
  };

  const handleApplyProfile = async () => {
    const cleanNick = editableNickname.trim();
    if (!cleanNick || cleanNick.length < 2 || cleanNick.length > 30) {
      setProfileMsg('Nickname must be between 2 and 30 characters.');
      return;
    }
    if (editableRealName.trim().length > 50) {
      setProfileMsg('Real name cannot exceed 50 characters.');
      return;
    }
    const { error } = await supabase.from('profiles').update({
      nickname: cleanNick,
      real_name: editableRealName.trim() || null,
      hide_from_leaderboard: hideLeaderboard,
    }).eq('id', user.id);

    if (!error) {
      onProfileUpdated({
        nickname: editableNickname.trim(),
        realName: editableRealName.trim() || undefined,
        hideFromLeaderboard: hideLeaderboard,
      });
      setProfileMsg('Profile settings updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    } else {
      setProfileMsg('Error updating: ' + error.message);
    }
  };

  const handleApplyPassword = async () => {
    if (!oldPassword) return setPasswordMsg({ text: 'Enter your current password.', error: true });
    if (!newPassword) return setPasswordMsg({ text: 'Enter a new password.', error: true });
    if (newPassword.length < 6 || newPassword.length > 30) {
      return setPasswordMsg({ text: 'New password must be between 6 and 30 characters.', error: true });
    }

    setIsUpdatingPassword(true);
    setPasswordMsg(null);

    try {
      // 1. Проверяем старый пароль
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword
      });

      if (verifyErr) {
        throw new Error('Incorrect current password.');
      }

      // 2. Обновляем на новый пароль
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      
      if (updateErr) throw updateErr;

      setPasswordMsg({ text: 'Password changed successfully!', error: false });
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (error) {
      setPasswordMsg({ text: error instanceof Error ? error.message : 'Error updating password.', error: true });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmText !== REQUIRED_DELETE_PHRASE) return;
    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw new Error(error.message);
      localStorage.clear();
      await supabase.auth.signOut({ scope: 'local' });
      window.location.reload();
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : 'Could not delete this account.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-[#060c20]/95 backdrop-blur-3xl animate-fade-in text-left">
        <div className="flex w-full max-w-7xl mx-auto shadow-2xl bg-[#080d1e] overflow-hidden">
          
          {/* Левое боковое меню */}
          <div className="w-64 shrink-0 border-r border-white/10 bg-[#040816] flex flex-col justify-between">
            <div>
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[#3ccb57]" /> Settings
                </h2>
              </div>
              <nav className="p-4 space-y-2">
                {[
                  { id: 'account', icon: User, label: 'Account' },
                  { id: 'data', icon: History, label: 'Data & Statistics' },
                  { id: 'visual', icon: Sparkles, label: 'Visual & Performance' },
                  { id: 'advanced', icon: Cpu, label: 'Advanced' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab.id ? 'bg-[#3ccb57]/10 text-[#3ccb57]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-6">
              <button onClick={onClose} className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <X className="h-4 w-4" /> Close Settings
              </button>
            </div>
          </div>

          {/* Контент справа */}
          <div className="flex-1 overflow-y-auto p-8 lg:p-12">
            <div className="max-w-2xl">
              
              {/* === ACCOUNT TAB === */}
              {activeTab === 'account' && (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Account Profile</h3>
                    <p className="text-xs text-slate-400 mb-6">Manage your public identity and avatar.</p>
                    
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
                      
                      {/* Avatar Upload */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-3">Profile Picture (Max 10MB)</label>
                        {avatarFile ? (
                          <ImageCropper file={avatarFile} onCrop={handleAvatarCrop} onCancel={() => setAvatarFile(null)} />
                        ) : (
                          <div className="flex items-center gap-5">
                            <UserAvatar url={(user as any).avatarUrl} name={user.nickname || 'Student'} size={80} className="shadow-xl" />
                            <div>
                              <input type="file" id="avatarUpload" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleAvatarSelect} />
                              <label htmlFor="avatarUpload" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer transition-colors">
                                <UploadCloud className="h-4 w-4" /> Upload new image
                              </label>
                              {avatarError && <p className="text-[10px] text-red-400 mt-2">{avatarError}</p>}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nickname (2–30 chars)</label>
                          <input type="text" maxLength={30} value={editableNickname} onChange={(e) => setEditableNickname(e.target.value)} className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Real Name (Optional, max 50 chars)</label>
                          <input type="text" maxLength={50} value={editableRealName} onChange={(e) => setEditableRealName(e.target.value)} className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-4">
                        <div>
                          <span className="text-sm font-bold text-white block">Hide from Leaderboard</span>
                          <span className="text-[11px] text-slate-400">Keep your performance private.</span>
                        </div>
                        <button type="button" onClick={() => setHideLeaderboard(!hideLeaderboard)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${hideLeaderboard ? 'bg-amber-500' : 'bg-white/20'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${hideLeaderboard ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#3ccb57]">{profileMsg}</span>
                        <button onClick={handleApplyProfile} className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all cursor-pointer">
                          Save Profile
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Security</h3>
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                      
                      <div className="space-y-3">
                        {/* CURRENT PASSWORD */}
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Current Password</label>
                          <div className="relative">
                            <input 
                              type={showOldPassword ? 'text' : 'password'} 
                              value={oldPassword} 
                              onChange={(e) => setOldPassword(e.target.value)} 
                              maxLength={30} placeholder="Enter current password" 
                              className="w-full p-3 pr-10 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]" 
                            />
                            <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white cursor-pointer">
                              {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* NEW PASSWORD */}
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">New Password</label>
                          <div className="relative">
                            <input 
                              type={showNewPassword ? 'text' : 'password'} 
                              value={newPassword} 
                              onChange={(e) => setNewPassword(e.target.value)} 
                              maxLength={30} placeholder="New Password (6–30 chars)" 
                              className="w-full p-3 pr-10 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]" 
                            />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white cursor-pointer">
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className={`text-xs ${passwordMsg?.error ? 'text-red-400' : 'text-[#3ccb57]'}`}>{passwordMsg?.text}</span>
                        <button onClick={handleApplyPassword} disabled={isUpdatingPassword} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50">
                          {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === DATA & STATISTICS TAB === */}
              {activeTab === 'data' && (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Data & Curriculum</h3>
                    <p className="text-xs text-slate-400 mb-6">Manage your educational cohort mapping.</p>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                      <label className="block text-sm font-semibold text-white mb-1">Study Year</label>
                      <p className="text-[11px] text-slate-400 mb-4">Calibrates AI generation difficulty and context based on your current ISE syllabus.</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {(['year1', 'year2', 'year3', 'year4'] as StudyYear[]).map((yr) => (
                          <button
                            key={yr}
                            onClick={() => onYearChange(yr)}
                            className={`py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              currentYear === yr ? 'bg-[#3ccb57] text-black border-[#3ccb57] shadow-[0_0_15px_rgba(60,203,87,0.2)]' : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {yr.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === VISUAL & PERFORMANCE TAB === */}
              {/* === VISUAL & PERFORMANCE TAB === */}
              {activeTab === 'visual' && (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Visual & Performance</h3>
                    <p className="text-xs text-slate-400 mb-6">Customize the aesthetics and optimize rendering speed.</p>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
                      
                      {/* Тройной переключатель оформления */}
                      {/* 3 режима оформления */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-sm font-bold text-white block">Стиль интерфейса</span>
                          <span className="text-[11px] text-slate-400 mt-1 block max-w-sm">
                            Обычный (оригинал), лёгкое стекло (сохраняет цвета сайта) или глубокий тёмный режим.
                          </span>
                        </div>
                        <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 shrink-0">
                          <button
                            type="button"
                            onClick={() => onUiThemeToggled('standard')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              uiTheme === 'standard'
                                ? 'bg-[#3ccb57] text-black shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Обычный
                          </button>
                          <button
                            type="button"
                            onClick={() => onUiThemeToggled('glass')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              uiTheme === 'glass'
                                ? 'bg-white/15 text-white border-t border-white/30 shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Стекло
                          </button>
                        </div>
                      </div>
                      

                      {/* Vortex Toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-white/5">
                        <div>
                          <span className="text-sm font-bold text-white block">Background Vortex Animation</span>
                          <span className="text-[11px] text-slate-400 mt-1 block max-w-sm">Disable animated background to save battery and boost framerate.</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newDisabled = !vortexDisabled;
                            setVortexDisabled(newDisabled);
                            onVortexToggled(newDisabled);
                            await supabase.from('profiles').update({ disable_vortex: newDisabled }).eq('id', user.id);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                            vortexDisabled ? 'bg-white/20' : 'bg-[#3ccb57]'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${vortexDisabled ? 'translate-x-1' : 'translate-x-6'}`} />
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* === ADVANCED TAB === */}
              {activeTab === 'advanced' && (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Advanced Controls</h3>
                    <p className="text-xs text-slate-400 mb-6">API Keys and dangerous actions.</p>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 mb-8">
                      <div className="flex flex-col gap-1 mb-2">
                        <span className="text-sm font-bold text-white">Google AI Studio API Key</span>
                        <span className="text-[11px] text-slate-400">Stored safely in local device storage. Required for generating tests.</span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full p-3 pr-10 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#3ccb57]"
                          />
                          <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white cursor-pointer">
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <button onClick={onSaveKey} className="px-6 py-3 rounded-xl font-bold text-xs bg-white/10 text-white hover:bg-white/20 cursor-pointer">
                          Save Key
                        </button>
                      </div>
                      {settingsStatus && <p className="text-xs text-[#3ccb57]">{settingsStatus}</p>}
                    </div>

                    <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/30">
                      <h4 className="text-sm font-bold text-red-300 flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" /> Danger Zone
                      </h4>
                      <p className="text-xs text-slate-400 mb-5">
                        Permanently delete your profile and test history. Submitted curriculum materials will remain anonymously in the library.
                      </p>
                      <button onClick={() => { setDeleteConfirmText(''); setDeleteAccountError(null); setShowDeleteModal(true); }} className="px-6 py-3 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 transition-colors cursor-pointer">
                        Delete Account...
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Окно подтверждения удаления аккаунта */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#060c20] p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 border-b border-red-500/20 pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Account Deletion</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action is <strong className="text-red-400">permanent and cannot be undone</strong>.
            </p>
            {deleteAccountError && <p className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">{deleteAccountError}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Type <strong className="text-[#3ccb57] font-mono select-all">I want to delete this account</strong> below:
              </label>
              <input type="text" autoFocus value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="I want to delete this account" className="w-full p-3 rounded-xl bg-black/60 border border-white/20 text-xs font-mono text-white focus:outline-none focus:border-red-400" />
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeletingAccount} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">Cancel</button>
              <button type="button" onClick={handleExecuteDeleteAccount} disabled={deleteConfirmText !== REQUIRED_DELETE_PHRASE || isDeletingAccount} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
                {isDeletingAccount ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...</> : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ADMIN MODAL */
export const AdminModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  flaggedItems: any[];
  onAction: (id: string, action: 'approve' | 'reject') => void;
}> = ({ isOpen, onClose, flaggedItems, onAction }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return flaggedItems;
    const q = searchQuery.toLowerCase();
    return flaggedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.submitterNickname || '').toLowerCase().includes(q) ||
        (item.submitterEmail || '').toLowerCase().includes(q) ||
        (item.submitterId || '').toLowerCase().includes(q) ||
        item.aiVerdictReason.toLowerCase().includes(q) ||
        item.tagName.toLowerCase().includes(q)
    );
  }, [flaggedItems, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-5xl rounded-2xl border border-amber-500/30 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Security Audit & Moderation Alerts</h3>
              <p className="text-xs text-slate-400">Review AI-flagged and rejected student submissions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts by Nickname, User ID, filename, or AI reason..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-white/5 bg-black/40 space-y-1">
              <CheckCircle2 className="h-8 w-8 text-[#3ccb57] mx-auto opacity-70" />
              <p className="text-xs text-slate-300 font-semibold">No moderation warnings found</p>
              <p className="text-[11px] text-slate-500">All submissions pass academic criteria smoothly.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isRejected = item.status === 'rejected';
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-all ${
                    isRejected
                      ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                      : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                          isRejected
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isRejected ? '⚠️ Rejected by AI' : '🚩 Flagged for Review'}
                      </span>

                      <span className="text-xs text-slate-200 font-bold flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="text-white">{item.submitterNickname || 'Student'}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          (ID: {item.submitterId ? item.submitterId.slice(0, 8) + '...' : 'anon'})
                        </span>
                      </span>

                      <span className="text-[10px] font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {item.tagName}
                      </span>
                    </div>

                    <div className="text-xs text-slate-200">
                      <strong className="text-white">{item.title}</strong>
                      <span className="text-slate-400 block sm:inline sm:ml-2">
                        — <span className="italic">{item.aiVerdictReason}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      {item.createdAt}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAction(item.id, 'reject')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/30 transition-colors cursor-pointer"
                      >
                        Dismiss / Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction(item.id, 'approve')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3ccb57] hover:bg-[#4ade67] text-black transition-all shadow-[0_0_10px_rgba(60,203,87,0.3)] cursor-pointer"
                      >
                        Force Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
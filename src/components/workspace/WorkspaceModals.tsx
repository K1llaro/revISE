import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Brain, Code2, Bug, Upload, Shield, History, Settings, Cpu, Loader2,
  AlertTriangle, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  HelpCircle, Calendar, Hash, Plus, Key, User, Trash2, Trophy,
  EyeOff, Eye, Sparkles, Filter, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttachedFile, FlaggedMaterial, StudyYear, TestHistoryItem, QuestionReviewDetail, LeaderboardEntry, UserSession } from '../../types/ise';
import { getGeminiModelUsage } from '../../lib/gemini';
import { FileDropzone, ApiKeyTooltip } from '../common/LayoutComponents';

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
   QUIZ CONFIG MODAL
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
  quizPresets, selectedQuizPresetId, quizPresetError, onCreateQuizPreset, onApplyQuizPreset, onSaveQuizPreset, onRenameQuizPreset, onDeleteQuizPreset,
  selectedTag, setSelectedTag, availableTags, quizAttachedFiles, setQuizAttachedFiles,
  quizPrompt, setQuizPrompt, isGenerating, generationError, onLaunch
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#3ccb57]" /> Configure Quiz Examination
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <section className="rounded-xl border border-white/10 bg-black/20 p-3.5 sm:p-4" aria-label="Quiz presets">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-white">Quiz Presets</h4>
              <p className="mt-1 text-[10px] text-slate-400">Save and reuse all quiz settings and prompt. Attached files are not included.</p>
            </div>
            <button
              type="button"
              onClick={onCreateQuizPreset}
              disabled={quizPresets.length >= 5}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3ccb57]/30 bg-[#3ccb57]/10 px-3 py-2 text-[11px] font-semibold text-[#7bea91] transition hover:bg-[#3ccb57]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Save current as preset
            </button>
          </div>
          {quizPresetError && <p role="alert" className="mb-2 text-[10px] text-amber-300">{quizPresetError}</p>}
          {quizPresets.length > 0 ? (
            <div className="space-y-2">
              {quizPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={`grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                    selectedQuizPresetId === preset.id ? 'border-[#3ccb57]/40 bg-[#3ccb57]/[0.06]' : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      type="text"
                      value={preset.name}
                      maxLength={40}
                      aria-label="Preset name"
                      onChange={(event) => onRenameQuizPreset(preset.id, event.target.value)}
                      onBlur={() => {
                        if (!preset.name.trim()) onRenameQuizPreset(preset.id, 'Quiz Preset');
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white focus:border-[#3ccb57] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onApplyQuizPreset(preset.id)}
                      className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onSaveQuizPreset}
                      disabled={selectedQuizPresetId !== preset.id}
                      className="rounded-lg border border-[#3ccb57]/25 px-3 py-2 text-[10px] font-semibold text-[#7bea91] transition hover:bg-[#3ccb57]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save settings
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteQuizPreset(preset.id)}
                      aria-label={`Delete ${preset.name || 'quiz preset'}`}
                      className="inline-flex items-center justify-center rounded-lg border border-red-500/20 p-2 text-red-300 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[10px] text-slate-500">No saved presets yet. Save the current configuration to create one.</p>
          )}
          <p className="mt-2 text-right text-[10px] text-slate-500">{quizPresets.length}/5 presets</p>
        </section>

        {generationError && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{generationError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Test Title (Optional - for history search)</label>
          <input
            type="text"
            autoComplete="new-password"
            value={quizCustomTitle}
            onChange={(e) => setQuizCustomTitle(e.target.value)}
            placeholder="e.g. Lab 4 AWS CDK & CloudFront Revision"
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Number of Questions</label>
            <div className="flex flex-wrap gap-2">
              {[5, 7, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => { setQuizQuestionCount(count); setQuizCustomCount(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    quizQuestionCount === count && !quizCustomCount ? 'bg-[#3ccb57] text-black border-[#3ccb57]' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {count} Questions
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
                className="w-28 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Time Limit (Minutes)</label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => { setQuizTimerMinutes(mins); setQuizCustomTimer(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    quizTimerMinutes === mins && !quizCustomTimer ? 'bg-[#3ccb57] text-black border-[#3ccb57]' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {mins} Minutes
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom (m)"
                min="1"
                max="180"
                value={quizCustomTimer}
                onChange={(e) => {
                  setQuizCustomTimer(e.target.value);
                  if (e.target.value) setQuizTimerMinutes(parseInt(e.target.value, 10));
                }}
                className="w-32 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3.5 transition hover:border-white/20">
          <input
            type="checkbox"
            checked={immediateQuizFeedback}
            onChange={(event) => setImmediateQuizFeedback(event.target.checked)}
            className="mt-0.5 accent-[#3ccb57]"
          />
          <span>
            <span className="block text-xs font-bold text-white">Show feedback after each answer</span>
            <span className="mt-1 block text-[11px] leading-5 text-slate-400">Lock each answer when submitted, then show the correct answer and explanation. Leave off to review results at the end.</span>
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Scoring Mode</label>
            <div className="space-y-2">
              <label
                onClick={() => setQuizScoringMode('partial')}
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  quizScoringMode === 'partial' ? 'border-[#3ccb57] bg-[#3ccb57]/10 text-white' : 'border-white/10 bg-black/30 text-slate-400'
                }`}
              >
                <input type="radio" checked={quizScoringMode === 'partial'} readOnly className="mt-0.5" />
                <div>
                  <span className="text-xs font-bold block text-white">Partial Credit</span>
                  <span className="text-[11px] text-slate-400">1 correct + 1 wrong = 0.5 points</span>
                </div>
              </label>

              <label
                onClick={() => setQuizScoringMode('strict')}
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  quizScoringMode === 'strict' ? 'border-[#3ccb57] bg-[#3ccb57]/10 text-white' : 'border-white/10 bg-black/30 text-slate-400'
                }`}
              >
                <input type="radio" checked={quizScoringMode === 'strict'} readOnly className="mt-0.5" />
                <div>
                  <span className="text-xs font-bold block text-white">Strict Binary</span>
                  <span className="text-[11px] text-slate-400">1 correct + 1 wrong = 0 points</span>
                </div>
              </label>

              <label
                onClick={() => setQuizScoringMode('negative')}
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  quizScoringMode === 'negative' ? 'border-[#3ccb57] bg-[#3ccb57]/10 text-white' : 'border-white/10 bg-black/30 text-slate-400'
                }`}
              >
                <input type="radio" checked={quizScoringMode === 'negative'} readOnly className="mt-0.5" />
                <div>
                  <span className="text-xs font-bold block text-white">Negative Marking</span>
                  <span className="text-[11px] text-slate-400">Each missed correct or checked wrong option deducts 2/N of the question; unanswered questions score 0.</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Question Type Percentages</label>
            <p className="text-[10px] text-slate-500 mb-2">Set a whole-number percentage for each type. The total must equal 100%; counts are rounded to the nearest possible mix. Multiple Choice questions have 4–10 options.</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['mcq', 'Multiple Choice'],
                ['text', 'Fill In'],
                ['single', 'Single Answer'],
              ] as const).map(([type, label]) => (
                <label key={type} className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-2.5">
                  <span className="mb-1.5 block truncate text-[10px] font-semibold text-slate-300">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={quizTypePercentages[type]}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        setQuizTypePercentages((previous) => ({
                          ...previous,
                          [type]: Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value)),
                        }));
                      }}
                      aria-label={`${label} percentage`}
                      className="w-full min-w-0 rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white focus:border-[#3ccb57] focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </label>
              ))}
            </div>
            <p className={`mt-2 text-[10px] font-semibold ${quizTypePercentages.mcq + quizTypePercentages.text + quizTypePercentages.single === 100 ? 'text-emerald-400' : 'text-amber-300'}`}>
              Total: {quizTypePercentages.mcq + quizTypePercentages.text + quizTypePercentages.single}%
              {quizTypePercentages.mcq + quizTypePercentages.text + quizTypePercentages.single !== 100 && ' — must equal 100%'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-transparent border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-[#3ccb57]" />
            <div>
              <span className="text-xs font-bold text-white block">Enhanced Thinking Mode</span>
              <span className="text-[11px] text-slate-400">Activates Gemini 3 reasoning for deep architectural and syntax verification.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuizThinkingMode(!quizThinkingMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              quizThinkingMode ? 'bg-[#3ccb57]' : 'bg-white/20'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${quizThinkingMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
          />
          <p className="mt-1.5 text-[10px] text-slate-500">AI checks the tag against your material and may reuse or assign a more relevant tag.</p>
        </div>

        <FileDropzone
          files={quizAttachedFiles}
          onFilesAdded={(newF) => setQuizAttachedFiles((prev) => [...prev, ...newF])}
          onFileRemoved={(idx) => setQuizAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
          label="Attach Lecture Slides or Code Files (Multimodal PDF analysis supported)"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Prompt / Topic Focus</label>
          <textarea
            rows={2}
            value={quizPrompt}
            onChange={(e) => setQuizPrompt(e.target.value)}
            placeholder="e.g. Focus on memory buses, address lines, and control signal timing..."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-white cursor-pointer">Cancel</button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={isGenerating}
            className="px-7 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <span>Generate & Start Quiz</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   PROGRAMMING MODAL
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
}> = ({ isOpen, onClose, progCustomTitle, setProgCustomTitle, progDifficulty, setProgDifficulty, selectedTag, setSelectedTag, availableTags, progAttachedFiles, setProgAttachedFiles, progPrompt, setProgPrompt, isGenerating, onLaunch }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Code2 className="h-5 w-5 text-[#3ccb57]" /> Configure Programming Challenge
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exercise Title (Optional)</label>
          <input
            type="text"
            autoComplete="new-password"
            value={progCustomTitle}
            onChange={(e) => setProgCustomTitle(e.target.value)}
            placeholder="e.g. Lab Exercise: Drawing ASCII Triangles with Nested Loops"
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Difficulty</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setProgDifficulty(lvl)}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  progDifficulty === lvl ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
          />
          <p className="mt-1.5 text-[10px] text-slate-500">AI checks the tag against your material and may reuse or assign a more relevant tag.</p>
        </div>

        <FileDropzone
          files={progAttachedFiles}
          onFilesAdded={(newF) => setProgAttachedFiles((prev) => [...prev, ...newF])}
          onFileRemoved={(idx) => setProgAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
          label="Attach Problem Specs or Reference Slides (PDF / Code)"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prompt / Requirements Focus</label>
          <textarea
            rows={2}
            value={progPrompt}
            onChange={(e) => setProgPrompt(e.target.value)}
            placeholder="e.g. Prompt user for triangle height, build Task A and Task B using nested loops..."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button onClick={onClose} className="text-xs text-slate-400 cursor-pointer">Cancel</button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={isGenerating}
            className="px-7 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <span>Start Coding Challenge</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   CODE ANALYSIS MODAL
   ========================================================================= */
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
}> = ({ isOpen, onClose, analysisCustomTitle, setAnalysisCustomTitle, analysisDifficulty, setAnalysisDifficulty, selectedTag, setSelectedTag, availableTags, analysisAttachedFiles, setAnalysisAttachedFiles, analysisPrompt, setAnalysisPrompt, isGenerating, onLaunch }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Bug className="h-5 w-5 text-[#3ccb57]" /> Configure Code Analysis & Mental Tracing
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Drill Title (Optional)</label>
          <input
            type="text"
            autoComplete="new-password"
            value={analysisCustomTitle}
            onChange={(e) => setAnalysisCustomTitle(e.target.value)}
            placeholder="e.g. Nested Loop Bounds & Off-by-One Tracing"
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Complexity</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setAnalysisDifficulty(lvl)}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  analysisDifficulty === lvl ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Optional)</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
          />
          <p className="mt-1.5 text-[10px] text-slate-500">AI checks the tag against your material and may reuse or assign a more relevant tag.</p>
        </div>

        <FileDropzone
          files={analysisAttachedFiles}
          onFilesAdded={(newF) => setAnalysisAttachedFiles((prev) => [...prev, ...newF])}
          onFileRemoved={(idx) => setAnalysisAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
          label="Attach Code Snippets or Reference Slides"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tracing Focus / Specific Operators</label>
          <textarea
            rows={2}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            placeholder="e.g. Nested for-loops with pre-increment ++i and accumulator..."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button onClick={onClose} className="text-xs text-slate-400 cursor-pointer">Cancel</button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={isGenerating}
            className="px-7 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <span>Start Mental Tracing</span>}
          </button>
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
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Or Paste Raw Lecture Notes</label>
          <textarea
            rows={6}
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Paste syllabus notes, lecture takeaways, or code snippets here..."
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
   🏆 LEADERBOARD MODAL: UNBOUNDED TOTAL RATING + CONSENT SCREEN
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {!hasAcceptedConsent ? (
          <div className="max-w-xl mx-auto py-4 sm:py-6 space-y-5 sm:space-y-6 text-center animate-fade-in">
            <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#3ccb57]/10 text-[#3ccb57] border border-[#3ccb57]/30 shadow-[0_0_20px_rgba(60,203,87,0.2)]">
              <Trophy className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white">Join the revISE Leaderboard</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Compete with fellow Immersive Software Engineering students, track your unbounded mastery index, and climb the ranks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-left text-xs text-slate-300 space-y-2 leading-relaxed">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#3ccb57]" /> Leaderboard Privacy & Fairness Rules:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Your nickname, year, monthly accuracy %, and Experience will be public to UL peers.</li>
                <li>Hard & Challenge tasks award up to 250 Exp with difficulty multipliers.</li>
                <li>Real Name & Surname are strictly optional.</li>
                <li>You can toggle <strong>«Hide myself from Leaderboard»</strong> anytime in Settings.</li>
              </ul>
            </div>

            <div className="text-left space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Real Name & Surname (Optional)
              </label>
              <input
                type="text"
                value={consentRealName}
                onChange={(e) => setConsentRealName(e.target.value)}
                placeholder="e.g. Kiril Kuzmenko (or leave empty)"
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasAcceptedConsent(true);
                  onConsentAccepted(consentRealName.trim() || undefined);
                }}
                className="px-7 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer"
              >
                Accept & Enter Leaderboard
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Trophy className="h-6 w-6 text-[#3ccb57] shrink-0" />
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">revISE Leaderboard</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-mono">Unbounded Rating = Total Exp × (Monthly Accuracy % / 100)</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer self-end sm:self-auto"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {[
                  { id: 'all', label: 'All Cohorts' },
                  { id: 'year1', label: 'Year 1' },
                  { id: 'year2', label: 'Year 2' },
                  { id: 'year3', label: 'Year 3' },
                  { id: 'year4', label: 'Year 4' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedYearFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedYearFilter === f.id
                        ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3ccb57]"
                />
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl overflow-x-auto bg-black/40 scrollbar-thin">
              <table className="w-full min-w-[520px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 sm:px-4 w-14 sm:w-16 text-center">Rank</th>
                    <th className="py-3 px-3 sm:px-4">Student</th>
                    <th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Real Name</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Accuracy</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Experience</th>
                    <th className="py-3 px-3 sm:px-4 text-right font-black text-[#3ccb57]">Total Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin text-[#3ccb57] mx-auto mb-2" />
                        <span>Calculating Leaderboard Standings...</span>
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No students found on the leaderboard.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((student) => {
                      const isTop1 = student.rank === 1;
                      const isTop2 = student.rank === 2;
                      const isTop3 = student.rank === 3;

                      return (
                        <tr
                          key={student.userId}
                          className={`transition-colors ${
                            student.isCurrentUser
                              ? 'bg-[#3ccb57]/10 border-l-4 border-l-[#3ccb57]'
                              : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-3 px-3 sm:px-4 text-center font-mono font-black">
                            {isTop1 ? (
                              <span className="text-xl">🥇</span>
                            ) : isTop2 ? (
                              <span className="text-xl">🥈</span>
                            ) : isTop3 ? (
                              <span className="text-xl">🥉</span>
                            ) : (
                              <span className="text-slate-400 font-bold">#{student.rank}</span>
                            )}
                          </td>

                          <td className="py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="font-bold text-white text-xs sm:text-sm">{student.nickname}</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 uppercase border border-white/10">
                                {student.studyYear}
                              </span>
                              {student.isCurrentUser && (
                                <span className="text-[9px] font-mono text-[#3ccb57] bg-[#3ccb57]/10 px-1.5 py-0.2 rounded font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-slate-400 font-medium hidden sm:table-cell">
                            {student.realName || <span className="text-slate-600">—</span>}
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-center font-mono font-semibold text-slate-200">
                            {student.monthlyAccuracy}%
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-center font-mono font-bold text-[#3ccb57]">
                            {student.isePoints} Exp
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-right font-mono font-black text-xs sm:text-sm text-[#3ccb57]">
                            {student.totalScore.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   HISTORY MODAL
   ========================================================================== */
export const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  historyList: TestHistoryItem[];
  onStartWeakQuiz: (topics: Array<{ topic: string; tagName: string }>) => void;
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
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const localDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const handlePresetChange = (preset: '7' | '14' | 'custom') => {
    setRangePreset(preset);
    if (preset !== 'custom') {
      const daysCount = parseInt(preset, 10);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (daysCount - 1));
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const chartDays = useMemo(() => {
    const days = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);
    let limit = 0;

    while (curr <= end && limit < 40) {
      const dateStr = curr.toISOString().split('T')[0];
      const itemsOnDay = historyList.filter((item) => item.rawDate?.startsWith(dateStr));
      const averageScore = (items: TestHistoryItem[]) =>
        items.length > 0
          ? Math.round(items.reduce((total, item) => total + (item.maxScore > 0 ? item.score / item.maxScore * 100 : 0), 0) / items.length)
          : 0;
      const quizItems = itemsOnDay.filter((item) => item.type.toLowerCase().includes('quiz'));
      const codeItems = itemsOnDay.filter((item) => item.type.toLowerCase().includes('code'));
      const analysisItems = itemsOnDay.filter((item) => item.type.toLowerCase().includes('analysis') || item.type.toLowerCase().includes('tracing'));

      days.push({
        dateStr,
        displayDate: `${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}`,
        quizScore: averageScore(quizItems),
        codeScore: averageScore(codeItems),
        analysisScore: averageScore(analysisItems),
        totalTests: itemsOnDay.length,
        items: itemsOnDay,
      });
      curr.setDate(curr.getDate() + 1);
      limit += 1;
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

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (rangePreset !== 'custom') {
      const daysCount = parseInt(rangePreset, 10);
      const d = new Date(newStart);
      d.setDate(d.getDate() + (daysCount - 1));
      setEndDate(d.toISOString().split('T')[0]);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(
      (h) => h.title.toLowerCase().includes(q) || h.type.toLowerCase().includes(q) || h.aiFeedback.toLowerCase().includes(q)
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
      const key = localDateKey(new Date(item.rawDate));
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
      const key = localDateKey(day);
      const activity = activityByDay.get(key);
      const accuracy = activity && activity.attempts > 0 ? activity.score / activity.attempts : 0;
      const level = !activity ? 0 : accuracy >= 80 ? 4 : accuracy >= 60 ? 3 : accuracy >= 40 ? 2 : 1;
      days.push({ key, level, attempts: activity?.attempts || 0, accuracy: Math.round(accuracy) });
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
              <p className="mt-0.5 text-[10px] text-slate-500">Detailed quiz answers are kept for 14 days. Export them from an expanded result to keep a copy.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
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

        {/* Search Bar */}
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

        {/* History Items List */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No tests matching your query.</p>
          ) : (
            filteredHistory.map((h) => {
              const isExpanded = expandedId === h.id;
              const isQuiz = h.type === 'Quiz';
              const isCode = h.type === 'Code Challenge';
              // Quiz → sky blue, Code Challenge → neon green, Analysis/Tracing → orange
              const typeColor = isQuiz
                ? { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' }
                : isCode
                ? { text: 'text-[#3ccb57]', bg: 'bg-[#3ccb57]/10', border: 'border-[#3ccb57]/20' }
                : { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
              return (
                <div key={h.id} className={`p-4 rounded-xl border bg-black/40 space-y-3 transition-all ${isQuiz ? 'border-sky-400/20' : isCode ? 'border-white/10' : 'border-orange-400/20'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${typeColor.text} ${typeColor.bg} ${typeColor.border}`}>
                        {h.type}
                      </span>
                      <span className="text-sm font-bold text-white">{h.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold ${typeColor.text}`}>+{h.pointsEarned || 0} Exp</span>
                      <span className="text-xs text-slate-400">{h.timeSpent} · {h.date}</span>
                      <span className={`text-base font-black font-mono ${typeColor.text}`}>{h.score}/{h.maxScore}</span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : h.id)}
                        className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-300 leading-relaxed">
                    <strong className="text-[#3ccb57]">AI Rubric Diagnosis: </strong>
                    {h.aiFeedback}
                  </div>

                  {isExpanded && (
                    <div className="pt-2 space-y-4 border-t border-white/10 animate-fade-in">
                      {h.weakSpotsAdvice && (
                        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                          <strong className="font-bold flex items-center gap-1.5 text-amber-300">
                            <Brain className="h-4 w-4" /> AI Study Advice & Weak Spots:
                          </strong>
                          <p className="leading-relaxed text-slate-300">{h.weakSpotsAdvice}</p>
                        </div>
                      )}

                      {h.details && h.details.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Question-by-Question Breakdown:</span>
                            <button
                              type="button"
                              onClick={() => exportHistoryDetails(h)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200"
                            >
                              <Download className="h-3.5 w-3.5" /> Export full details (.txt)
                            </button>
                          </div>
                          {h.details.map((q, qIdx) => (
                            <div key={qIdx} className={`p-3.5 rounded-xl border ${q.isCorrect ? 'border-[#3ccb57]/30 bg-[#3ccb57]/5' : 'border-red-500/30 bg-red-950/20'} space-y-2 text-xs`}>
                              <div className="flex justify-between items-center font-mono">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  {q.isCorrect ? <CheckCircle2 className="h-3.5 w-3.5 text-[#3ccb57]" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                                  Question {qIdx + 1}
                                </span>
                                <span className={q.isCorrect ? 'text-[#3ccb57] font-bold' : 'text-red-400 font-bold'}>
                                  {q.points} pts
                                </span>
                              </div>
                              <p className="text-slate-200">{q.questionText}</p>
                              {q.codeSnippet && <pre className="p-2.5 rounded bg-black/60 font-mono text-[11px] text-[#3ccb57] overflow-x-auto">{q.codeSnippet}</pre>}
                              <div className="font-mono text-[11px] space-y-0.5">
                                <div className="text-slate-400">Your answer: <span className="text-white">{q.userAnswer.join(', ') || 'No answer'}</span></div>
                                <div className="text-[#3ccb57]">Correct: {q.correctAnswers.join(', ')}</div>
                              </div>
                              {q.topic && <div className="text-[11px] text-slate-400">Topic: <span className="text-slate-200">{q.topic}</span></div>}
                              {q.slideTitle && <div className="text-[11px] text-slate-400">Study material: <span className="text-sky-300">{q.slideTitle}</span></div>}
                              <div className="p-2 rounded bg-black/40 text-[11px] text-slate-400">{q.explanation}</div>
                            </div>
                          ))}
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
                  <Sparkles className="h-3.5 w-3.5" /> Quiz weak topics
                </button>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="grid grid-rows-7 grid-flow-col auto-cols-max gap-1 min-w-max" aria-label="12-week learning accuracy heatmap">
                  {heatmapDays.map((day) => (
                    <span
                      key={day.key}
                      title={`${day.key}: ${day.attempts ? `${day.attempts} tests · ${day.accuracy}% average` : 'No tests'}`}
                      className={`h-3 w-3 rounded-[3px] ${day.level === 0 ? 'bg-white/[0.07]' : day.level === 1 ? 'bg-red-500/60' : day.level === 2 ? 'bg-amber-500/70' : day.level === 3 ? 'bg-lime-500/80' : 'bg-[#3ccb57]'}`}
                    />
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
                            className="shrink-0 rounded-lg border border-[#3ccb57]/30 px-2.5 py-1 text-[10px] font-bold text-[#3ccb57] transition hover:bg-[#3ccb57]/10"
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
                <strong className="block text-2xl font-black text-sky-300 mt-1">{averageMcqSeconds === null ? '—' : `${averageMcqSeconds}s`}</strong>
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
              <p className="border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-500">
                This list only records models that successfully generated responses in this browser. It does not show request counts, Google AI Studio quota, or daily token usage.
              </p>
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
  onProfileUpdated: (updates: { nickname?: string; realName?: string; hideFromLeaderboard?: boolean }) => void;
  currentYear: StudyYear;
  onYearChange: (yr: StudyYear) => void;
  apiKeyInput: string;
  setApiKeyInput: (s: string) => void;
  onSaveKey: () => void;
  settingsStatus: string | null;
  onVortexToggled: (disabled: boolean) => void;
}> = ({ isOpen, onClose, user, onProfileUpdated, currentYear, onYearChange, apiKeyInput, setApiKeyInput, onSaveKey, settingsStatus, onVortexToggled }) => {
  const [editableNickname, setEditableNickname] = useState(user.nickname || '');
  const [editableRealName, setEditableRealName] = useState(user.realName || '');
  const [hideLeaderboard, setHideLeaderboard] = useState(user.hideFromLeaderboard || false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const [vortexDisabled, setVortexDisabled] = useState(user.disableVortex || false);

  const REQUIRED_DELETE_PHRASE = "I want to delete this account";

  if (!isOpen) return null;

  const handleApplyProfile = async () => {
    const { error } = await supabase.from('profiles').update({
      nickname: editableNickname.trim(),
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
    if (!newPassword) {
      setPasswordMsg({ text: 'Enter a new password.', error: true });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters.', error: true });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMsg(null);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        setPasswordMsg({ text: updateErr.message, error: true });
      } else {
        setPasswordMsg({ text: 'Password changed successfully!', error: false });
        setNewPassword('');
        setTimeout(() => setPasswordMsg(null), 4000);
      }
    } catch (error) {
      setPasswordMsg({
        text: error instanceof Error ? error.message : 'Could not update your password. Please try again.',
        error: true,
      });
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
        <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#3ccb57]" /> User Settings & Account Controls
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
          </div>

          {/* 1. Profile: Nickname, Real Name & Leaderboard Toggle */}
          <div className="p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User className="h-4 w-4 text-[#3ccb57]" /> Public Identity & Leaderboard Privacy
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nickname</label>
                <input
                  type="text"
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={editableNickname}
                  onChange={(e) => setEditableNickname(e.target.value)}
                  placeholder="e.g. Kiril_Dev"
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Real Name & Surname (Optional)</label>
                <input
                  type="text"
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={editableRealName}
                  onChange={(e) => setEditableRealName(e.target.value)}
                  placeholder="e.g. Kiril Kuzmenko"
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>
            </div>

            {/* Hide myself from Leaderboard toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">Hide myself from Leaderboard</span>
                <span className="text-[11px] text-slate-400">Keep your performance private. You won't appear in the public ranking.</span>
              </div>
              <button
                type="button"
                onClick={() => setHideLeaderboard(!hideLeaderboard)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  hideLeaderboard ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${hideLeaderboard ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              {profileMsg ? <span className="text-xs text-[#3ccb57]">{profileMsg}</span> : <span />}
              <button
                onClick={handleApplyProfile}
                className="px-5 py-2 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all cursor-pointer"
              >
                Apply Profile Changes
              </button>
            </div>
          </div>

          {/* 2. Change Password */}
          <div className="p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-[#3ccb57]" /> Change Password
            </label>
            <p className="text-[11px] text-slate-400">
              Your signed-in session verifies your account; a current password is not required.
            </p>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 6 chars)"
                className="w-full p-2.5 pr-10 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((shown) => !shown)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                aria-pressed={showNewPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex justify-between items-center pt-1">
              {passwordMsg ? (
                <span className={`text-xs ${passwordMsg.error ? 'text-red-400' : 'text-[#3ccb57]'}`}>
                  {passwordMsg.text}
                </span>
              ) : <span />}
              <button
                onClick={handleApplyPassword}
                disabled={isUpdatingPassword}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all cursor-pointer disabled:opacity-50"
              >
                {isUpdatingPassword ? 'Updating...' : 'Apply Password Change'}
              </button>
            </div>
          </div>

          {/* 3. Study Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Study Year (Calibrated for ISE 2026)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['year1', 'year2', 'year3', 'year4'] as StudyYear[]).map((yr) => (
                <button
                  key={yr}
                  onClick={() => onYearChange(yr)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    currentYear === yr ? 'bg-[#3ccb57] text-black border-[#3ccb57] shadow-[0_0_12px_rgba(60,203,87,0.3)]' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {yr.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Google AI Studio Key */}
          <div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-300 mb-1.5">
              <span>Google AI Studio API Key (Local Device Storage)</span>
              <ApiKeyTooltip />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                autoComplete="new-password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((shown) => !shown)}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                aria-pressed={showApiKey}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showApiKey ? 'Hide' : 'Show'}
              </button>
              <button onClick={onSaveKey} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black cursor-pointer w-full sm:w-auto">
                Save
              </button>
            </div>
            {settingsStatus && <p className="text-xs text-[#3ccb57] mt-1">{settingsStatus}</p>}
          </div>

          {/* 5. Graphics & Performance */}
          <div className="p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>🎨</span> Graphics &amp; Performance
            </label>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Background Vortex Animation</span>
                <span className="text-[11px] text-slate-400">Disabling this may improve performance on slower devices.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const newDisabled = !vortexDisabled;
                  setVortexDisabled(newDisabled);
                  onVortexToggled(newDisabled);
                  await supabase.from('profiles').update({ disable_vortex: newDisabled }).eq('id', user.id);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  vortexDisabled ? 'bg-white/20' : 'bg-[#3ccb57]'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${vortexDisabled ? 'translate-x-1' : 'translate-x-6'}`} />
              </button>
            </div>
          </div>

          {/* 6. DANGER ZONE */}
          <div className="pt-4 border-t border-red-500/20">
            <div className="p-4 sm:p-5 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Trash2 className="h-4 w-4 text-red-400" /> Danger Zone: Delete Account
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Permanently delete your profile and test history. Your uploaded curriculum slides will remain anonymously in the library.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmText('');
                  setDeleteAccountError(null);
                  setShowDeleteModal(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 transition-colors cursor-pointer shrink-0 w-full sm:w-auto"
              >
                Delete Account
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer">Close</button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#060c20] p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 border-b border-red-500/20 pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Confirm Permanent Account Deletion
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action is <strong className="text-red-400">permanent and cannot be undone</strong>. Your personal profile and test scores will be completely erased.
            </p>
            {deleteAccountError && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
                {deleteAccountError}
              </p>
            )}

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] text-slate-400">
              💡 <em>Note: Any lecture slides you contributed will remain anonymously in the community library for other students.</em>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 leading-relaxed">
                To confirm, type <strong className="text-[#3ccb57] font-mono select-all">I want to delete this account</strong> below:
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="I want to delete this account"
                className="w-full p-3 rounded-xl bg-black/60 border border-white/20 text-xs font-mono text-white focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeletingAccount}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteAccount}
                disabled={deleteConfirmText !== REQUIRED_DELETE_PHRASE || isDeletingAccount}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-lg"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Permanently Delete</span>
                )}
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
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Brain, Code2, Bug, Upload, Shield, History, Settings, Cpu, Loader2,
  AlertTriangle, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  HelpCircle, Calendar, Hash, Plus, Key, User, BarChart3, Trash2, Trophy,
  EyeOff, Eye, Sparkles, Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttachedFile, FlaggedMaterial, StudyYear, TestHistoryItem, QuestionReviewDetail, LeaderboardEntry, UserSession } from '../../types/ise';
import { FileDropzone, ApiKeyTooltip } from '../common/LayoutComponents';

/* ==========================================================================
   COMPONENT: SEARCHABLE TAG DROPDOWN
   ========================================================================== */
export const SearchableTagDropdown: React.FC<{
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  availableTags: string[];
  onAddNewTag: (tag: string) => void;
}> = ({ selectedTag, onSelectTag, availableTags, onAddNewTag }) => {
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

  const handleCreate = () => {
    if (!search.trim()) return;
    const formatted = '#' + search.trim().replace(/^#+/, '').replace(/\s+/g, '_');
    onAddNewTag(formatted);
    onSelectTag(formatted);
    setSearch('');
    setIsOpen(false);
  };

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
                <span className="text-[11px] text-slate-400 block">No matching tags found</span>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#3ccb57]/15 hover:bg-[#3ccb57]/25 text-[#3ccb57] text-[11px] font-bold border border-[#3ccb57]/30 transition-all cursor-pointer"
                  >
                    + Create & Select "#{search.replace(/^#+/, '').replace(/\s+/g, '_')}"
                  </button>
                )}
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
  quizScoringMode: 'partial' | 'strict';
  setQuizScoringMode: (m: 'partial' | 'strict') => void;
  quizTypes: { mcq: boolean; text: boolean; single: boolean };
  setQuizTypes: React.Dispatch<React.SetStateAction<{ mcq: boolean; text: boolean; single: boolean }>>;
  quizThinkingMode: boolean;
  setQuizThinkingMode: (b: boolean) => void;
  selectedTag: string;
  setSelectedTag: (t: string) => void;
  availableTags: string[];
  onAddNewTag: (t: string) => void;
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
  quizScoringMode, setQuizScoringMode, quizTypes, setQuizTypes, quizThinkingMode, setQuizThinkingMode,
  selectedTag, setSelectedTag, availableTags, onAddNewTag, quizAttachedFiles, setQuizAttachedFiles,
  quizPrompt, setQuizPrompt, isGenerating, generationError, onLaunch
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#3ccb57]" /> Configure Quiz Examination
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

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
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Question Types</label>
            <div className="space-y-2">
              <label onClick={() => setQuizTypes((p) => ({ ...p, mcq: !p.mcq }))} className="p-2.5 rounded-xl border border-white/10 bg-black/30 flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={quizTypes.mcq} readOnly />
                <span>Multiple Choice (Multiple Correct)</span>
              </label>
              <label onClick={() => setQuizTypes((p) => ({ ...p, single: !p.single }))} className="p-2.5 rounded-xl border border-white/10 bg-black/30 flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={quizTypes.single} readOnly />
                <span>Single Choice Only</span>
              </label>
              <label onClick={() => setQuizTypes((p) => ({ ...p, text: !p.text }))} className="p-2.5 rounded-xl border border-white/10 bg-black/30 flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={quizTypes.text} readOnly />
                <span>Fill-in / Open Text Answers</span>
              </label>
            </div>
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
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Curriculum Tag (Searchable)</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
            onAddNewTag={onAddNewTag}
          />
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
  onAddNewTag: (t: string) => void;
  progAttachedFiles: AttachedFile[];
  setProgAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  progPrompt: string;
  setProgPrompt: (s: string) => void;
  isGenerating: boolean;
  onLaunch: () => void;
}> = ({ isOpen, onClose, progCustomTitle, setProgCustomTitle, progDifficulty, setProgDifficulty, selectedTag, setSelectedTag, availableTags, onAddNewTag, progAttachedFiles, setProgAttachedFiles, progPrompt, setProgPrompt, isGenerating, onLaunch }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
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
          <div className="grid grid-cols-5 gap-2">
            {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setProgDifficulty(lvl)}
                className={`py-2 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  progDifficulty === lvl ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Curriculum Tag</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
            onAddNewTag={onAddNewTag}
          />
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
  onAddNewTag: (t: string) => void;
  analysisAttachedFiles: AttachedFile[];
  setAnalysisAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  analysisPrompt: string;
  setAnalysisPrompt: (s: string) => void;
  isGenerating: boolean;
  onLaunch: () => void;
}> = ({ isOpen, onClose, analysisCustomTitle, setAnalysisCustomTitle, analysisDifficulty, setAnalysisDifficulty, selectedTag, setSelectedTag, availableTags, onAddNewTag, analysisAttachedFiles, setAnalysisAttachedFiles, analysisPrompt, setAnalysisPrompt, isGenerating, onLaunch }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
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
          <div className="grid grid-cols-5 gap-2">
            {['Very Easy', 'Easy', 'Standard', 'Hard', 'Challenge'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setAnalysisDifficulty(lvl)}
                className={`py-2 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  analysisDifficulty === lvl ? 'bg-[#3ccb57] text-black border-[#3ccb57] font-bold' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Curriculum Tag</label>
          <SearchableTagDropdown
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
            onAddNewTag={onAddNewTag}
          />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {!hasAcceptedConsent ? (
          <div className="max-w-xl mx-auto py-6 space-y-6 text-center animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3ccb57]/10 text-[#3ccb57] border border-[#3ccb57]/30 shadow-[0_0_20px_rgba(60,203,87,0.2)]">
              <Trophy className="h-8 w-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">Join the revISE Leaderboard</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Compete with fellow Immersive Software Engineering students, track your unbounded mastery index, and climb the ranks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-left text-xs text-slate-300 space-y-2 leading-relaxed">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#3ccb57]" /> Leaderboard Privacy & Fairness Rules:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Your nickname, year, monthly accuracy %, and ISE Points will be public to UL peers.</li>
                <li>Hard & Challenge tasks award up to 250 XP with difficulty multipliers.</li>
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

            <div className="pt-2 flex gap-3 justify-center">
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Trophy className="h-6 w-6 text-[#3ccb57]" />
                <div>
                  <h3 className="text-xl font-black text-white">revISE Leaderboard</h3>
                  <p className="text-xs text-slate-400 font-mono">Unbounded Rating = Total ISE Points × (Monthly Accuracy % / 100)</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
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

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Real Name</th>
                    <th className="py-3.5 px-4 text-center">Monthly Accuracy</th>
                    <th className="py-3.5 px-4 text-center">ISE Points</th>
                    <th className="py-3.5 px-4 text-right font-black text-[#3ccb57]">Total Rating</th>
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
                          <td className="py-3.5 px-4 text-center font-mono font-black">
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

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{student.nickname}</span>
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

                          <td className="py-3.5 px-4 text-slate-400 font-medium">
                            {student.realName || <span className="text-slate-600">—</span>}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-200">
                            {student.monthlyAccuracy}%
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-[#3ccb57]">
                            {student.isePoints} XP
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-[#3ccb57]">
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
}> = ({ isOpen, onClose, historyList }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [rangePreset, setRangePreset] = useState<'7' | '14' | 'custom'>('14');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (rangePreset !== 'custom') {
      const daysCount = parseInt(rangePreset, 10);
      const d = new Date(newStart);
      d.setDate(d.getDate() + (daysCount - 1));
      setEndDate(d.toISOString().split('T')[0]);
    }
  };

  const chartDays = useMemo(() => {
    const days = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);

    let limit = 0;
    while (curr <= end && limit < 40) {
      const dateStr = curr.toISOString().split('T')[0];
      const itemsOnDay = historyList.filter((h) => h.rawDate?.startsWith(dateStr));

      const quizItems = itemsOnDay.filter((i) => i.type.toLowerCase().includes('quiz'));
      const codeItems = itemsOnDay.filter((i) => i.type.toLowerCase().includes('code'));
      const analysisItems = itemsOnDay.filter((i) => i.type.toLowerCase().includes('analysis') || i.type.toLowerCase().includes('tracing'));

      const avgQuiz = quizItems.length > 0 ? Math.round(quizItems.reduce((acc, q) => acc + q.score, 0) / quizItems.length) : 0;
      const avgCode = codeItems.length > 0 ? Math.round(codeItems.reduce((acc, c) => acc + c.score, 0) / codeItems.length) : 0;
      const avgAnalysis = analysisItems.length > 0 ? Math.round(analysisItems.reduce((acc, a) => acc + a.score, 0) / analysisItems.length) : 0;

      days.push({
        dateStr,
        displayDate: `${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}`,
        quizScore: avgQuiz,
        codeScore: avgCode,
        analysisScore: avgAnalysis,
        totalTests: itemsOnDay.length,
        items: itemsOnDay,
      });

      curr.setDate(curr.getDate() + 1);
      limit++;
    }
    return days;
  }, [startDate, endDate, historyList]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(
      (h) => h.title.toLowerCase().includes(q) || h.type.toLowerCase().includes(q) || h.aiFeedback.toLowerCase().includes(q)
    );
  }, [historyList, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-[#3ccb57]" />
            <h3 className="text-lg font-bold text-white">Evaluation History & Performance Heatmap</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 rounded-2xl bg-[#030714] border border-white/10 space-y-5 relative shadow-inner">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-4 text-xs font-mono">
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

          <div className="relative pt-6 pb-2">
            <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 w-7 text-right">{val}%</span>
                  <div className="flex-1 border-b border-white/[0.06] border-dashed" />
                </div>
              ))}
            </div>

            <div className="relative z-10 pl-9 pr-2 h-56 flex items-end justify-between gap-1 sm:gap-2">
              {chartDays.map((day, dIdx) => {
                const isNearRightEdge = dIdx >= chartDays.length - 4;
                const tooltipPosClass = isNearRightEdge ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2';

                return (
                  <div key={day.dateStr} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                    <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-2">
                      <div style={{ height: `${day.quizScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.quizScore > 0 ? 'bg-gradient-to-t from-sky-600 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'h-1 bg-white/5'}`} />
                      <div style={{ height: `${day.codeScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.codeScore > 0 ? 'bg-gradient-to-t from-emerald-600 to-[#3ccb57] shadow-[0_0_8px_rgba(60,203,87,0.4)]' : 'h-1 bg-white/5'}`} />
                      <div style={{ height: `${day.analysisScore}%` }} className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-500 ${day.analysisScore > 0 ? 'bg-gradient-to-t from-amber-600 to-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 'h-1 bg-white/5'}`} />
                    </div>

                    <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-slate-400 truncate w-full text-center block pt-1.5">
                      {day.displayDate}
                    </span>

                    <div className={`absolute bottom-full mb-3 hidden group-hover:block z-50 w-56 p-3 rounded-xl border border-white/15 bg-[#060c20]/98 backdrop-blur-2xl shadow-2xl text-[11px] pointer-events-none animate-fade-in ${tooltipPosClass}`}>
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
              return (
                <div key={h.id} className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-3 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#3ccb57] bg-[#3ccb57]/10 px-2 py-0.5 rounded border border-[#3ccb57]/20">
                        {h.type}
                      </span>
                      <span className="text-sm font-bold text-white">{h.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-[#3ccb57]">+{h.pointsEarned || 0} XP</span>
                      <span className="text-xs text-slate-400">{h.timeSpent} · {h.date}</span>
                      <span className="text-base font-black font-mono text-[#3ccb57]">{h.score}/{h.maxScore}</span>
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
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Question-by-Question Breakdown:</span>
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
}> = ({ isOpen, onClose, user, onProfileUpdated, currentYear, onYearChange, apiKeyInput, setApiKeyInput, onSaveKey, settingsStatus }) => {
  const [editableNickname, setEditableNickname] = useState(user.nickname || '');
  const [editableRealName, setEditableRealName] = useState(user.realName || '');
  const [hideLeaderboard, setHideLeaderboard] = useState(user.hideFromLeaderboard || false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
    if (!oldPassword || !newPassword) {
      setPasswordMsg({ text: 'Please fill both old and new password fields.', error: true });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters.', error: true });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMsg(null);

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInErr) {
      setIsUpdatingPassword(false);
      setPasswordMsg({ text: 'Incorrect current password!', error: true });
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (updateErr) {
      setPasswordMsg({ text: updateErr.message, error: true });
    } else {
      setPasswordMsg({ text: 'Password changed successfully! No email needed.', error: false });
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    }
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmText !== REQUIRED_DELETE_PHRASE) return;
    setIsDeletingAccount(true);

    try {
      await supabase.rpc('delete_user_account');
    } catch (e) {}

    try {
      await supabase.from('profiles').delete().eq('id', user.id);
    } catch (e) {}

    localStorage.clear();
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
        <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#060c20] p-7 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#3ccb57]" /> User Settings & Account Controls
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
          </div>

          {/* 1. Profile: Nickname, Real Name & Leaderboard Toggle */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
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
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-[#3ccb57]" /> Change Password (No verification required)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Current Password"
                className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
              />
              <input
                type="password"
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 6 chars)"
                className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
              />
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
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span>Google AI Studio API Key (Local Device Storage)</span>
              <ApiKeyTooltip />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="new-password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-mono"
              />
              <button onClick={onSaveKey} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black cursor-pointer">
                Save
              </button>
            </div>
            {settingsStatus && <p className="text-xs text-[#3ccb57] mt-1">{settingsStatus}</p>}
          </div>

          {/* 5. DANGER ZONE */}
          <div className="pt-4 border-t border-red-500/20">
            <div className="p-5 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                  setShowDeleteModal(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 transition-colors cursor-pointer shrink-0"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#060c20] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 border-b border-red-500/20 pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Confirm Permanent Account Deletion
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action is <strong className="text-red-400">permanent and cannot be undone</strong>. Your personal profile and test scores will be completely erased.
            </p>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-5xl rounded-2xl border border-amber-500/30 bg-[#060c20] p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
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
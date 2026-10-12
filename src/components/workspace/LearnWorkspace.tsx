import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, FilePlus2, FolderPlus, Loader2, Maximize2, MessageCircle, Minus, Paperclip, Pencil, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttachedFile, UserSession } from '../../types/ise';
import { callGemini, readFileForGemini } from '../../lib/gemini';
import {
  hasStandardLearnSummaryFormat,
  LEARN_SUMMARY_REFORMAT_PROMPT,
  LEARN_SUMMARY_TEMPLATE_INSTRUCTIONS,
} from '../../lib/learnSummaryFormat';

interface LearnCategory {
  id: string;
  name: string;
}

interface LearnSection {
  id: string;
  category_id: string;
  name: string;
}

interface LearnNote {
  id: string;
  title: string;
  content_text: string;
  source_name: string | null;
  created_at: string;
  terms: NoteTerm[];
}

interface NoteTerm {
  term: string;
  explanation: string;
  example?: string;
  analogy?: string;
  whyItMatters?: string;
}

interface LearnClarification {
  id: string;
  selected_text: string;
  question: string;
  answer: string;
  created_at: string;
}

const SUMMARY_MODES = [
  { id: 'very_short', label: 'Very Short Summary', maxCharacters: 700, guidance: 'Keep only the essential takeaway and a few critical facts.' },
  { id: 'short', label: 'Short Summary', maxCharacters: 2000, guidance: 'Condense the material to its main ideas, key definitions, essential steps, and the most useful examples. Still cover every major section and the ending slides.' },
  { id: 'standard', label: 'Standard Summary', maxCharacters: 5000, guidance: 'Give a thorough study-ready explanation of every important idea, definition, process, relationship, formula, and example. Explain how and why things work, include key details from each section, and do not skip the final slides. This mode should be meaningfully detailed, not a brief overview.' },
  { id: 'expanded', label: 'Expanded Summary (Recommended)', maxCharacters: 10000, guidance: 'Write like a careful student making useful exam notes, not like a generic essay or a compressed slide transcript. Use a clear hierarchy of headings and compact, complete bullet points. Cover every slide/section in source order. Preserve exact examinable details: dates and years, capacities and units, numerical values, names, model/version identifiers, limits, classifications, formulas, examples, comparisons, and stated advantages/disadvantages. Explain important mechanisms as understandable cause-and-effect steps so the reader can reconstruct how they work. Keep each fact with its context and exact source slide heading; do not merge distinct facts into vague generalizations. Ignore practical activities assigned for students to perform in class, including worksheet/lab tasks, discussion prompts, group activities, and submission instructions. Keep worked examples that explain a concept or establish an examinable fact. Remove repetition, filler, decorative wording, and irrelevant material.' },
  { id: 'detailed', label: 'Detailed Summary', maxCharacters: 14000, guidance: 'Write thorough, exam-ready student notes, not a generic essay or a compressed slide transcript. Follow every slide and section in source order with clear headings and compact, complete bullet points. Preserve precise facts and their context: dates and years, capacities and units, numerical values, names, model/version identifiers, limits, classifications, formulas, examples, comparisons, qualifications, advantages, and disadvantages. Explain mechanisms as cause-and-effect steps, including enough detail to understand and reproduce how they work. Keep slide-specific facts under the exact source heading; never invent missing values or replace precise facts with vague statements. Ignore practical activities assigned for students to perform in class, including worksheet/lab tasks, discussion prompts, group activities, and submission instructions. Keep worked examples that explain a concept or establish an examinable fact. Remove repetition, filler, decorative wording, and irrelevant material.' },
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getSupabaseErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return error instanceof Error ? error.message : 'Unknown Supabase error';
};

const COMMON_TECHNICAL_TERMS: NoteTerm[] = [
  {
    term: 'open drain',
    explanation: 'An output that can pull a shared wire down to 0, but cannot push it up to 1 by itself.',
    analogy: 'It is like a switch that can connect a wire to the floor; a pull-up resistor acts like a spring that lifts it back up.',
    example: 'Several open-drain devices can share one wire: any device can pull it low, and the resistor makes it high when none do.',
    whyItMatters: 'It lets several devices safely share a signal without fighting over whether it should be high or low.',
  },
  {
    term: 'open collector',
    explanation: 'A transistor output that can pull a wire down to 0, but needs a pull-up resistor to make the wire 1.',
    analogy: 'Like open drain, it is a switch that can pull a shared wire down; a resistor lifts it back up.',
    example: 'An open-collector output can signal an error by pulling a shared alert wire low.',
    whyItMatters: 'It allows devices to share a signal and can make it easier to connect circuits that use different voltage levels.',
  },
  {
    term: 'totem pole',
    explanation: 'An output circuit with one transistor to drive the signal high and another to drive it low.',
    analogy: 'One switch pushes the signal up while the other pulls it down.',
    example: 'A standard push-pull logic output is a totem-pole style output.',
    whyItMatters: 'It changes signals quickly, but two such outputs must not be connected together because they could push against each other.',
  },
  {
    term: 'pull-up resistor',
    explanation: 'A resistor that gently holds a signal at the high (1) level when no device is pulling it low.',
    analogy: 'Like a light spring that returns a shared signal wire to its resting high position.',
    example: 'An open-drain output uses a pull-up resistor to produce a high signal when its transistor is off.',
    whyItMatters: 'Without it, an undriven signal could float and be read unpredictably.',
  },
  {
    term: 'wire-OR',
    explanation: 'A shared wire that lets any device signal an alert by pulling it low; in active-low logic this behaves like OR.',
    analogy: 'Like several people who can each pull the same alarm cord; any one of them can activate it.',
    example: 'Multiple open-drain outputs with a pull-up can share an alert line.',
    whyItMatters: 'It lets multiple devices report a condition using one wire, without their outputs driving against each other.',
  },
  {
    term: 'wired-OR',
    explanation: 'A logic function made by connecting compatible outputs together so any one of them can assert the shared signal.',
    analogy: 'Like several buttons connected to one bell: pressing any button can activate it.',
    example: 'Several open-drain outputs can create a shared interrupt line.',
    whyItMatters: 'It combines signals from multiple devices while saving separate input pins or wires.',
  },
  {
    term: 'wired-AND',
    explanation: 'A shared signal arrangement where the line is high only when no connected output is pulling it low.',
    analogy: 'The shared line stays high only while every device leaves it alone.',
    example: 'Open-drain outputs are often described as wired-AND because any one can pull the line low.',
    whyItMatters: 'It provides a simple way for several devices to share a signal and indicate that at least one needs attention.',
  },
  {
    term: 'high impedance',
    explanation: 'An output state where a device effectively disconnects from the signal wire instead of driving it high or low.',
    analogy: 'Like taking your hand off a rope so another person can move it.',
    example: 'An open-drain output is high impedance when it is not pulling the line low.',
    whyItMatters: 'It allows several devices to share one wire without unwanted interference.',
  },
  {
    term: 'floating input',
    explanation: 'An input pin that is not firmly set to 0 or 1, so the computer may read either value by accident.',
    analogy: 'Like a loose sign that can drift because nothing is holding it in place.',
    example: 'An input without a pull-up or pull-down resistor may float.',
    whyItMatters: 'A floating input can be misread and may cause unreliable behavior or extra power use.',
  },
  {
    term: 'active-low',
    explanation: 'A signal that means “on” or “asserted” when its voltage is low (0), rather than high.',
    analogy: 'An alarm that turns on when the wire is pulled down.',
    example: 'An active-low reset is triggered by bringing its pin to 0.',
    whyItMatters: 'Recognizing the convention prevents interpreting a low signal as “off” when it actually means “active”.',
  },
  {
    term: 'TTL',
    explanation: 'A way of building digital circuits using transistors; it defines how the circuit treats electrical signals as 0s and 1s.',
    analogy: 'Like a shared set of rules that tells connected parts what counts as on and off.',
    example: 'A TTL output can be connected to another circuit that accepts compatible TTL signal levels.',
    whyItMatters: 'Knowing the logic family helps determine which signals and voltage levels can safely work together.',
  },
  {
    term: 'CMOS',
    explanation: 'A common way to build digital circuits that uses very little power when signals are not changing.',
    analogy: 'Like switches arranged so the circuit usually uses energy only while changing state.',
    example: 'Most modern processor chips are made using CMOS technology.',
    whyItMatters: 'It makes complex chips practical by keeping their power use relatively low.',
  },
];

const getVisibleTerms = (content: string, terms: NoteTerm[]) => {
  const byName = new Map(terms.map((term) => [term.term.toLocaleLowerCase(), term]));
  for (const fallbackTerm of COMMON_TECHNICAL_TERMS) {
    const match = content.match(new RegExp(escapeRegExp(fallbackTerm.term), 'i'));
    if (match) {
      const existing = byName.get(fallbackTerm.term.toLocaleLowerCase());
      byName.set(fallbackTerm.term.toLocaleLowerCase(), {
        ...existing,
        ...fallbackTerm,
        term: existing?.term || match[0],
      });
    }
  }
  return [...byName.values()];
};

const formatMathNotation = (value: string) => {
  const superscriptDigits: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾' };
  const subscriptDigits: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
  return value
    .replace(/\\(?:text|mathrm|mathbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:times|cdot)\b/g, '×')
    .replace(/\\(?:leq|le)\b/g, '≤')
    .replace(/\\(?:geq|ge)\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\^\{([^{}]+)\}|\^([0-9+-]+)/g, (_match, braced: string | undefined, plain: string | undefined) =>
      [...(braced || plain || '')].map((character) => superscriptDigits[character] || character).join('')
    )
    .replace(/_\{([^{}]+)\}|_([0-9+-]+)/g, (_match, braced: string | undefined, plain: string | undefined) =>
      [...(braced || plain || '')].map((character) => subscriptDigits[character] || character).join('')
    )
    .replace(/\\([{}])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeInlineMath = (text: string) => text.replace(/\$([^$\n]+)\$/g, (_match, math: string) => formatMathNotation(math));

const renderInlineText = (text: string, terms: NoteTerm[], onTermHover?: (term: NoteTerm, x: number, y: number) => void, onTermLeave?: () => void, paperTheme = false) => {
  const sortedTerms = [...terms]
    .filter((term) => term.term.trim())
    .sort((first, second) => second.term.length - first.term.length);
  const termLookup = new Map(sortedTerms.map((term) => [term.term.toLocaleLowerCase(), term]));
  const termPattern = sortedTerms.length
    ? `(?<![\\w])(?:${sortedTerms.map((term) => escapeRegExp(term.term)).join('|')})(?![\\w])`
    : '(?!)';
  const matcher = new RegExp(`(\\*\\*[^*]+\\*\\*|__[^_]+__|\`[^\`]+\`|\\*[^*]+\\*|_[^_]+_|${termPattern})`, 'gi');
  return normalizeInlineMath(text).split(matcher).map((part, index) => {
    const term = termLookup.get(part.toLocaleLowerCase());
    if (term) {
      return <span key={`${part}-${index}`} className="text-emerald-400 underline decoration-emerald-500/40 decoration-dotted underline-offset-4 cursor-help" onMouseEnter={(event) => onTermHover?.(term, event.clientX, event.clientY)} onMouseLeave={onTermLeave}>{part}</span>;
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${part}-${index}`} className={`font-semibold ${paperTheme ? 'text-[#282319]' : 'text-slate-100'}`}>{renderInlineText(part.slice(2, -2), terms, onTermHover, onTermLeave, paperTheme)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={`${part}-${index}`}>{renderInlineText(part.slice(1, -1), terms, onTermHover, onTermLeave, paperTheme)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`} className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${paperTheme ? 'bg-[#d9c9a5] text-[#302a20]' : 'bg-black/30 text-emerald-200'}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const FormattedMarkdown: React.FC<{
  content: string;
  terms?: NoteTerm[];
  className?: string;
  paperTheme?: boolean;
  onTermHover?: (term: NoteTerm, x: number, y: number) => void;
  onTermLeave?: () => void;
}> = ({ content, terms = [], className = '', paperTheme = false, onTermHover, onTermLeave }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(<pre key={`code-${index}`} className={`overflow-x-auto rounded-lg p-3 font-mono text-xs ${paperTheme ? 'bg-[#dfd0ad] leading-[30px] text-[#302a20]' : 'bg-black/40 leading-6 text-emerald-200'}`}><code>{codeLines.join('\n')}</code></pre>);
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }
    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className={paperTheme ? 'h-[30px]' : 'h-2'} />);
      return;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const headingClass = level <= 2 ? 'text-lg font-bold text-white' : level === 3 ? 'text-base font-semibold text-slate-100' : 'text-sm font-semibold text-slate-200';
      blocks.push(<h3 key={`heading-${index}`} className={`${paperTheme ? 'text-[#282319] leading-[30px]' : `${headingClass} pt-2`} font-bold`}>{renderInlineText(heading[2], terms, onTermHover, onTermLeave, paperTheme)}</h3>);
      return;
    }

    const unordered = line.match(/^\s*[*+-]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      blocks.push(
        <div key={`list-${index}`} className={`flex gap-2 pl-2 ${paperTheme ? 'leading-[30px]' : ''}`}>
          <span className={`shrink-0 ${paperTheme ? 'text-[#8b6c32]' : 'text-emerald-500'}`}>{unordered ? '•' : `${line.match(/^\s*(\d+)[.)]/)?.[1]}.`}</span>
          <span className="min-w-0">{renderInlineText((unordered || ordered)![1], terms, onTermHover, onTermLeave, paperTheme)}</span>
        </div>
      );
      return;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    blocks.push(
      quote
        ? <blockquote key={`quote-${index}`} className={`border-l-2 pl-3 ${paperTheme ? 'border-[#aa8b52] leading-[30px] text-[#554a36]' : 'border-emerald-500/50 text-slate-400'}`}>{renderInlineText(quote[1], terms, onTermHover, onTermLeave, paperTheme)}</blockquote>
        : <p key={`paragraph-${index}`} className={paperTheme ? 'min-h-[30px] leading-[30px]' : 'min-h-[1.5em]'}>{renderInlineText(line, terms, onTermHover, onTermLeave, paperTheme)}</p>
    );
  });

  if (codeLines.length > 0) {
    blocks.push(<pre key="code-end" className={`overflow-x-auto rounded-lg p-3 font-mono text-xs ${paperTheme ? 'bg-[#dfd0ad] leading-[30px] text-[#302a20]' : 'bg-black/40 leading-6 text-emerald-200'}`}><code>{codeLines.join('\n')}</code></pre>);
  }

  return (
    <div
      className={`mt-4 whitespace-pre-wrap text-sm ${paperTheme ? 'space-y-0 leading-[30px] break-words text-[#302a20]' : 'space-y-1 leading-7 text-slate-300'} ${className}`}
      style={paperTheme ? {
        backgroundImage: 'linear-gradient(to bottom, transparent 29px, rgba(128, 103, 61, 0.2) 30px)',
        backgroundSize: '100% 30px',
      } : undefined}
    >
      {blocks}
    </div>
  );
};

const AnnotatedSummary: React.FC<{ content: string; terms: NoteTerm[]; visualHintsEnabled: boolean; paperTheme?: boolean }> = ({ content, terms, visualHintsEnabled, paperTheme = false }) => {
  const [hoveredTerm, setHoveredTerm] = useState<{ term: NoteTerm; x: number; y: number } | null>(null);
  const tooltipDismissTimer = useRef<number | null>(null);
  const orderedTerms = visualHintsEnabled
    ? getVisibleTerms(content, terms).filter((term) => term.term.trim() && term.explanation.trim()).sort((a, b) => b.term.length - a.term.length)
    : [];
  const tooltipWidth = Math.min(320, typeof window === 'undefined' ? 320 : window.innerWidth - 24);
  const tooltipHeight = typeof window === 'undefined' ? 420 : Math.min(420, window.innerHeight * 0.7);
  const tooltipPosition = hoveredTerm
    ? {
        left: Math.max(12, Math.min(hoveredTerm.x + 12, window.innerWidth - tooltipWidth - 12)),
        top: Math.max(12, Math.min(hoveredTerm.y + 16, window.innerHeight - tooltipHeight - 12)),
      }
    : undefined;

  const dismissTooltipSoon = () => {
    if (tooltipDismissTimer.current !== null) window.clearTimeout(tooltipDismissTimer.current);
    tooltipDismissTimer.current = window.setTimeout(() => setHoveredTerm(null), 450);
  };

  useEffect(() => {
    if (!visualHintsEnabled) setHoveredTerm(null);
  }, [visualHintsEnabled]);

  useEffect(() => () => {
    if (tooltipDismissTimer.current !== null) window.clearTimeout(tooltipDismissTimer.current);
  }, []);

  return (
    <>
      <FormattedMarkdown
        content={content}
        terms={orderedTerms}
        paperTheme={paperTheme}
        onTermHover={(term, x, y) => {
          if (tooltipDismissTimer.current !== null) window.clearTimeout(tooltipDismissTimer.current);
          setHoveredTerm((current) => current?.term.term === term.term ? current : { term, x, y });
        }}
        onTermLeave={dismissTooltipSoon}
      />
      {hoveredTerm && tooltipPosition && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={tooltipPosition}
          onMouseEnter={() => {
            if (tooltipDismissTimer.current !== null) window.clearTimeout(tooltipDismissTimer.current);
          }}
          onMouseLeave={dismissTooltipSoon}
          className="fixed z-[100] w-80 max-w-[calc(100vw-24px)] max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain rounded-xl border border-emerald-400/30 bg-[#101714] p-3 shadow-2xl"
        >
          <strong className="block text-xs font-bold text-emerald-300">{hoveredTerm.term.term}</strong>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">{hoveredTerm.term.explanation}</p>
          {hoveredTerm.term.analogy && <p className="mt-2 text-[11px] leading-relaxed text-slate-300"><span className="font-semibold text-slate-200">Think of it as: </span>{hoveredTerm.term.analogy}</p>}
          {hoveredTerm.term.example && <p className="mt-2 text-[11px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Example: </span>{hoveredTerm.term.example}</p>}
          {hoveredTerm.term.whyItMatters && <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Why it matters: </span>{hoveredTerm.term.whyItMatters}</p>}
        </div>,
        document.body
      )}
    </>
  );
};

type SummaryModeId = typeof SUMMARY_MODES[number]['id'];

type NotebookPage = {
  note: LearnNote;
  content: string;
  startsNote: boolean;
};

const paginateNotebookNotes = (notes: LearnNote[], pageCharacterTarget = 1250): NotebookPage[] =>
  notes.flatMap((note) => {
    const content = typeof note.content_text === 'string' ? note.content_text : '';
    const blocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    const noteBlocks: string[] = [];
    let currentPage = '';
    const flushPage = () => {
      if (currentPage.trim()) noteBlocks.push(currentPage.trim());
      currentPage = '';
    };

    for (const block of blocks) {
      if (block.length > pageCharacterTarget) {
        flushPage();
        let remainder = block;
        while (remainder.length > pageCharacterTarget) {
          const target = remainder.slice(0, pageCharacterTarget);
          const lastNewline = target.lastIndexOf('\n');
          const lastSentence = Math.max(target.lastIndexOf('. '), target.lastIndexOf('? '), target.lastIndexOf('! '));
          const lastSpace = target.lastIndexOf(' ');
          const splitAt = lastNewline > pageCharacterTarget * 0.6
            ? lastNewline
            : lastSentence > pageCharacterTarget * 0.6
              ? lastSentence + 1
              : lastSpace > 0
                ? lastSpace
                : pageCharacterTarget;
          noteBlocks.push(remainder.slice(0, splitAt).trim());
          remainder = remainder.slice(splitAt).trim();
        }
        if (remainder) currentPage = remainder;
        continue;
      }
      if (currentPage && currentPage.length + block.length + 2 > pageCharacterTarget) {
        flushPage();
      }
      currentPage = currentPage ? `${currentPage}\n\n${block}` : block;
    }
    flushPage();

    return noteBlocks.map((content, index) => ({
      note,
      content,
      startsNote: index === 0,
    }));
  });

export const LearnWorkspace: React.FC<{
  user: UserSession;
  currentYear: string;
  onBack: () => void;
}> = ({ user, currentYear, onBack }) => {
  const [categories, setCategories] = useState<LearnCategory[]>([]);
  const [sections, setSections] = useState<LearnSection[]>([]);
  const [notes, setNotes] = useState<LearnNote[]>([]);
  const [clarifications, setClarifications] = useState<LearnClarification[]>([]);
  const [askEnabledSections, setAskEnabledSections] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [notebookMode, setNotebookMode] = useState(false);
  const [isNotebookFullscreen, setIsNotebookFullscreen] = useState(false);
  const [notebookLayoutMode, setNotebookLayoutMode] = useState<'simple' | 'advanced'>('simple');
  const [composerCollapsed, setComposerCollapsed] = useState(false);
  const [bookPageIndex, setBookPageIndex] = useState(0);
  const [notebookPageTarget, setNotebookPageTarget] = useState(1250);
  const [bookTurnDirection, setBookTurnDirection] = useState<'next' | 'previous'>('next');
  const [pageTurn, setPageTurn] = useState<{
    direction: 'next' | 'previous';
    page: NotebookPage;
    pages: NotebookPage[];
    targetPages: NotebookPage[];
    targetPageIndex: number;
  } | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [noteToDelete, setNoteToDelete] = useState<LearnNote | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [deleteNoteError, setDeleteNoteError] = useState<string | null>(null);
  const [isRegeneratingNoteId, setIsRegeneratingNoteId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [summaryMode, setSummaryMode] = useState<SummaryModeId>('expanded');
  const [visualHintsEnabled, setVisualHintsEnabled] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const summaryContainerRef = useRef<HTMLDivElement | null>(null);
  const notebookPageRefs = useRef(new Map<string, HTMLElement>());
  const clarificationEndRef = useRef<HTMLDivElement | null>(null);
  const loadingSteps = [
    'Reading through your slides',
    'Finding the key ideas and connections',
    'Building a complete study summary',
    'Polishing your notes for revision',
  ];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`revise_learn_notebook_mode_${user.id}`);
      if (saved !== null) setNotebookMode(saved === 'true');
    } catch (error) {
      console.warn('Could not restore notebook view preference.', error);
    }
  }, [user.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`revise_learn_notebook_layout_${user.id}`);
      if (saved === 'simple' || saved === 'advanced') setNotebookLayoutMode(saved);
    } catch (error) {
      console.warn('Could not restore notebook layout preference.', error);
    }
  }, [user.id]);

  useEffect(() => {
    if (!isNotebookFullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotebookFullscreen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isNotebookFullscreen]);

  useEffect(() => {
    if (!isSaving) {
      setAnalysisStep(0);
      return;
    }
    const interval = window.setInterval(() => {
      setAnalysisStep((step) => (step + 1) % loadingSteps.length);
    }, 2400);
    return () => window.clearInterval(interval);
  }, [isSaving, loadingSteps.length]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`revise_learn_visual_hints_${user.id}`);
      if (saved !== null) setVisualHintsEnabled(saved === 'true');
    } catch (error) {
      console.warn('Could not restore visual hint preference.', error);
    }
  }, [user.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`revise_learn_ask_enabled_${user.id}`);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setAskEnabledSections(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
    } catch (error) {
      console.warn('Could not restore Learn clarification panel preferences.', error);
    }
  }, [user.id]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('learn_categories')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const nextCategories = (data || []) as LearnCategory[];
    setCategories(nextCategories);
    setSelectedCategoryId((current) =>
      current && nextCategories.some((category) => category.id === current)
        ? current
        : nextCategories[0]?.id || null
    );
    setLoadError(null);
  };

  useEffect(() => {
    loadCategories().catch((error: Error) => setLoadError(error.message));
  }, [user.id]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setSections([]);
      setSelectedSectionId(null);
      return;
    }
    let cancelled = false;
    const loadSections = async () => {
      const { data, error } = await supabase
        .from('learn_sections')
        .select('id, category_id, name')
        .eq('user_id', user.id)
        .eq('category_id', selectedCategoryId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (cancelled) return;
      const nextSections = (data || []) as LearnSection[];
      setSections(nextSections);
      setSelectedSectionId((current) =>
        current && nextSections.some((section) => section.id === current)
          ? current
          : nextSections[0]?.id || null
      );
    };
    loadSections().catch((error: Error) => setLoadError(error.message));
    return () => { cancelled = true; };
  }, [selectedCategoryId, user.id]);

  useEffect(() => {
    if (!selectedSectionId) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    const loadNotes = async () => {
      const { data, error } = await supabase
        .from('learn_notes')
        .select('id, title, content_text, source_name, created_at, terms')
        .eq('user_id', user.id)
        .eq('section_id', selectedSectionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!cancelled) {
        setNotes((data || []).map((note) => ({
          ...note,
          content_text: typeof note.content_text === 'string' ? note.content_text : '',
          terms: Array.isArray(note.terms) ? note.terms : [],
        })) as LearnNote[]);
      }
    };
    loadNotes().catch((error: Error) => setLoadError(error.message));
    return () => { cancelled = true; };
  }, [selectedSectionId, user.id]);

  useEffect(() => {
    setClarifications([]);
    setSelectedText('');
    setClarificationQuestion('');
    setSelectionMenu(null);
    setBookPageIndex(0);
    setNotebookPageTarget(1250);
    if (!selectedSectionId) {
      return;
    }
    let cancelled = false;
    const loadClarifications = async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await supabase
        .from('learn_clarifications')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoff);
      if (cleanupError) throw cleanupError;
      const { data, error } = await supabase
        .from('learn_clarifications')
        .select('id, selected_text, question, answer, created_at')
        .eq('user_id', user.id)
        .eq('section_id', selectedSectionId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!cancelled) setClarifications((data || []) as LearnClarification[]);
    };
    loadClarifications().catch((error: Error) => setLoadError(`Could not load Ask clarifications: ${error.message}`));
    return () => { cancelled = true; };
  }, [selectedSectionId, user.id]);

  useEffect(() => {
    clarificationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [clarifications.length, selectedSectionId]);

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from('learn_categories')
      .insert({ user_id: user.id, name })
      .select('id, name')
      .single();
    if (error) {
      setLoadError(error.message);
      return;
    }
    setCategories((current) => [...current, data as LearnCategory]);
    setSelectedCategoryId(data.id);
    setCategoryName('');
    setIsAddingCategory(false);
  };

  const createSection = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = sectionName.trim();
    if (!name || !selectedCategoryId) return;
    const { data, error } = await supabase
      .from('learn_sections')
      .insert({ user_id: user.id, category_id: selectedCategoryId, name })
      .select('id, category_id, name')
      .single();
    if (error) {
      setLoadError(error.message);
      return;
    }
    setSections((current) => [...current, data as LearnSection]);
    setSelectedSectionId(data.id);
    setSectionName('');
    setIsAddingSection(false);
  };

  const renameCategory = async (categoryId: string) => {
    const name = editingCategoryName.trim();
    if (!name) return;
    const { error } = await supabase
      .from('learn_categories')
      .update({ name })
      .eq('id', categoryId)
      .eq('user_id', user.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, name } : category));
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const renameSection = async (sectionId: string) => {
    const name = editingSectionName.trim();
    if (!name) return;
    const { error } = await supabase
      .from('learn_sections')
      .update({ name })
      .eq('id', sectionId)
      .eq('user_id', user.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, name } : section));
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const deleteNote = async () => {
    if (!noteToDelete) return;
    setIsDeletingNote(true);
    const { error } = await supabase
      .from('learn_notes')
      .delete()
      .eq('id', noteToDelete.id)
      .eq('user_id', user.id);
    if (error) {
      setDeleteNoteError(`Could not delete note: ${error.message}`);
      setIsDeletingNote(false);
      return;
    }
    setNotes((current) => current.filter((item) => item.id !== noteToDelete.id));
    setNoteToDelete(null);
    setIsDeletingNote(false);
  };

  const regenerateNote = async (note: LearnNote) => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) {
      setStatus('Add your Gemini API key in Settings to regenerate Learn notes.');
      return;
    }
    setIsRegeneratingNoteId(note.id);
    setStatus(`Regenerating "${note.title}" from its saved notebook text…`);
    try {
      const result = await callGemini(key, [{
        text: `You are revising an existing student's Computer Science study note. Regenerate it as clear, accurate, exam-ready Markdown using only the saved note below as source material. Preserve all useful facts, definitions, examples, values, qualifications, and source headings; improve clarity and organization without inventing or silently dropping examinable content.

Title: ${note.title}
Original source name: ${note.source_name || 'Pasted study notes'}
Existing saved note (the source of truth; do not exceed 18,000 characters in cleanSummary):
"""
${note.content_text.slice(0, 18000)}
"""

${LEARN_SUMMARY_TEMPLATE_INSTRUCTIONS}

After writing the note, identify up to 40 specialist technical terms that appear exactly in the new summary and are not explained there. Explain each in plain language without cutting off a sentence; keep explanations under 240 characters. Include analogy, example, and why-it-matters only when useful, with each optional field under 240 characters.

Return JSON only:
{"title":"short note title","cleanSummary":"complete regenerated Markdown study note","terms":[{"term":"exact term in cleanSummary","explanation":"plain-language meaning","analogy":"short analogy or empty string","example":"short example or empty string","whyItMatters":"plain-language purpose or empty string"}]}`,
      }], false, 12000);

      let summary = typeof result.cleanSummary === 'string' ? result.cleanSummary.trim() : '';
      if (!summary) throw new Error('The AI returned an empty regenerated note.');
      if (!hasStandardLearnSummaryFormat(summary)) {
        const formatted = await callGemini(key, [LEARN_SUMMARY_REFORMAT_PROMPT(note.title, summary)], false, 12000);
        summary = typeof formatted.cleanSummary === 'string' ? formatted.cleanSummary.trim() : '';
      }
      if (!summary || !hasStandardLearnSummaryFormat(summary)) {
        throw new Error('The AI could not format the regenerated note into the required notebook template. The existing note was left unchanged; please retry.');
      }
      if (summary.length > 18000) throw new Error('The regenerated note exceeded the 18,000-character note limit. The existing note was left unchanged.');
      const normalizedTerms: NoteTerm[] = Array.isArray(result.terms)
        ? result.terms
          .filter((item: Partial<NoteTerm>) =>
            typeof item.term === 'string'
            && item.term.trim().length > 0
            && typeof item.explanation === 'string'
            && item.explanation.trim().length > 0
            && summary.toLocaleLowerCase().includes(item.term.trim().toLocaleLowerCase())
          )
          .slice(0, 40)
          .map((item: Partial<NoteTerm>) => ({
            term: item.term!.trim().slice(0, 60),
            explanation: item.explanation!.trim().slice(0, 240),
            analogy: typeof item.analogy === 'string' ? item.analogy.trim().slice(0, 240) : undefined,
            example: typeof item.example === 'string' ? item.example.trim().slice(0, 240) : undefined,
            whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters.trim().slice(0, 240) : undefined,
          }))
        : [];
      const title = typeof result.title === 'string' && result.title.trim()
        ? result.title.trim().slice(0, 160)
        : note.title;
      const { data, error } = await supabase
        .from('learn_notes')
        .update({ title, content_text: summary, terms: normalizedTerms })
        .eq('id', note.id)
        .eq('user_id', user.id)
        .select('id, title, content_text, source_name, created_at, terms')
        .single();
      if (error) throw error;
      setNotes((current) => current.map((item) => item.id === note.id ? data as LearnNote : item));
      setStatus(`Regenerated "${title}" from the saved note. Original files are not retained in Learn.`);
    } catch (error) {
      setStatus(`Could not regenerate note: ${getSupabaseErrorMessage(error)}`);
    } finally {
      setIsRegeneratingNoteId(null);
    }
  };

  const openAskForSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!text || !selectionRange || !summaryContainerRef.current?.contains(selectionRange.commonAncestorContainer)) {
      setSelectionMenu(null);
      return;
    }
    const rect = selectionRange.getBoundingClientRect();
    setSelectedText(text.slice(0, 4000));
    setSelectionMenu({
      x: Math.max(12, Math.min(rect.right + 8, window.innerWidth - 90)),
      y: Math.max(12, Math.min(rect.top, window.innerHeight - 48)),
    });
  };

  const activateAskPanel = () => {
    if (!selectedSectionId) return;
    setAskEnabledSections((current) => {
      const next = current.includes(selectedSectionId) ? current : [...current, selectedSectionId];
      try {
        localStorage.setItem(`revise_learn_ask_enabled_${user.id}`, JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save Learn clarification panel preference.', error);
      }
      return next;
    });
    setSelectionMenu(null);
  };

  const closeAskPanel = (sectionId: string) => {
    setAskEnabledSections((current) => {
      const next = current.filter((id) => id !== sectionId);
      try {
        localStorage.setItem(`revise_learn_ask_enabled_${user.id}`, JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save Learn clarification panel preference.', error);
      }
      return next;
    });
  };

  const submitClarification = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = clarificationQuestion.trim();
    if (!question || !selectedSectionId || !selectedText || isAsking) return;
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) {
      setStatus('Add your Gemini API key in Settings to ask about your study notes.');
      return;
    }
    setIsAsking(true);
    setStatus(null);
    try {
      const selectedNote = notes.find((note) => note.content_text.includes(selectedText));
      const orderedNotes = selectedNote
        ? [selectedNote, ...notes.filter((note) => note.id !== selectedNote.id)]
        : notes;
      const noteContext = orderedNotes
        .map((note) => `${note.title}\n${note.content_text}`)
        .join('\n\n')
        .slice(0, 12000);
      const glossaryContext = (selectedNote?.terms || [])
        .map((term) => `${term.term}: ${term.explanation}${term.example ? ` Example: ${term.example}` : ''}`)
        .join('\n')
        .slice(0, 5000);
      const subjectName = categories.find((category) => category.id === selectedCategoryId)?.name || 'Study notes';
      const sectionName = sections.find((section) => section.id === selectedSectionId)?.name || 'General';
      const result = await callGemini(key, `You are a careful subject tutor answering a student's question about course material.
Use the selected passage and Learn notes (summaries of the student's uploaded slides) as the primary source. Check them first and accurately explain anything they say. You may also use reliable general academic knowledge to clarify the concept, resolve ambiguity, and give a concrete example, even when the slides do not include one. Do not claim that supplementary details appeared in the slides. If course notes and general knowledge differ, explain the distinction and prioritize what the notes explicitly state for this course.
Disambiguate technical terms using the subject and surrounding passage, not the most common meaning of an isolated word. For example, in computer organization, "register" means a small, fast storage location inside a processor, not the act of registering at an office.
Answer in the same language as the student's question. Be a little more detailed than a one-line definition: give a direct definition, explain how or why it works when relevant, and include a simple concrete example if asked or if it improves understanding. Prefer a correct basic example from general knowledge over saying no example exists in the slides. Keep the response focused, beginner-friendly, and based on facts; if a detail is uncertain, say so rather than guessing. Use concise Markdown.
Return JSON only as {"answer":"..."}.

Subject: ${subjectName}
Section: ${sectionName}
Selected passage:
"""${selectedText}"""

Question: ${question}

Relevant glossary from the matching note:
"""${glossaryContext || 'No glossary entries for this note.'}"""

Learn notes (summaries of the uploaded course slides):
"""${noteContext}"""`, false);
      const answer = typeof result.answer === 'string' ? result.answer.trim() : '';
      if (!answer) throw new Error('The AI returned an empty clarification.');
      const { data, error } = await supabase
        .from('learn_clarifications')
        .insert({
          user_id: user.id,
          section_id: selectedSectionId,
          selected_text: selectedText,
          question,
          answer,
        })
        .select('id, selected_text, question, answer, created_at')
        .single();
      if (error) throw error;
      setClarifications((current) => [...current, data as LearnClarification]);
      setClarificationQuestion('');
    } catch (error) {
      setStatus(`Could not answer your question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAsking(false);
    }
  };

  const deleteCategory = async (category: LearnCategory) => {
    if (!window.confirm(`Delete "${category.name}" and all its sections and notes?`)) return;
    const { error } = await supabase.from('learn_categories').delete().eq('id', category.id).eq('user_id', user.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    const remaining = categories.filter((item) => item.id !== category.id);
    setCategories(remaining);
    if (selectedCategoryId === category.id) setSelectedCategoryId(remaining[0]?.id || null);
  };

  const handleFileSelection = async (fileList: FileList | null) => {
    if (!fileList) return;
    try {
      const loaded = await Promise.all(Array.from(fileList).map(readFileForGemini));
      setAttachedFiles((current) => [...current, ...loaded]);
      setStatus(null);
    } catch (error) {
      setStatus(`Could not read attachment: ${error instanceof Error ? error.message : 'Unknown file error'}`);
    }
  };

  const saveNote = async () => {
    if (!selectedSectionId) {
      setStatus('Create or select a section before adding a note.');
      return;
    }
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) {
      setStatus('Add your Gemini API key in Settings to moderate and summarize Learn materials.');
      return;
    }
    const sourceText = composerText.trim();
    if (!sourceText && attachedFiles.length === 0) {
      setStatus('Write a note or attach a study file first.');
      return;
    }

    setIsSaving(true);
    setStatus('Reviewing your study material…');
    const selectedSummaryMode = SUMMARY_MODES.find((mode) => mode.id === summaryMode) || SUMMARY_MODES[3];
    const sourceNames = attachedFiles.map((file) => file.name);
    let existingTags: string[] = [];
    let tagWarning = '';
    try {
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('curriculum_materials')
          .select('tag_name')
          .eq('status', 'approved')
          .not('tag_name', 'is', null)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        existingTags.push(...(data || [])
          .map((material) => material.tag_name)
          .filter((tag): tag is string => typeof tag === 'string'));
        if (!data || data.length < pageSize) break;
      }
    } catch (error) {
      tagWarning = `Existing tags could not be loaded (${getSupabaseErrorMessage(error)}); moderation and submission will continue without tag matching.`;
      console.warn('Could not load approved curriculum material tags before Learn material moderation.', error);
    }
    const textualFiles = attachedFiles
      .filter((file) => !file.isPdf)
      .map((file) => `[File: ${file.name}]\n${file.textContent || file.content}`);
    const requestParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = attachedFiles
      .filter((file) => file.isPdf && file.base64Data)
      .map((file) => ({ inlineData: { mimeType: 'application/pdf', data: file.base64Data || '' } }));
    requestParts.push({
      text: `You are the same strict academic content moderator used for revISE quiz uploads.
Student year: ${currentYear}
Learn subject and section: ${categories.find((category) => category.id === selectedCategoryId)?.name || 'Study notes'} / ${sections.find((section) => section.id === selectedSectionId)?.name || 'General'}
Source filenames: ${sourceNames.join(', ') || 'Pasted study notes'}
Existing curriculum tags (reuse an exact match when appropriate): ${existingTags.join(', ') || 'None'}
Pasted notes and readable file contents:
"""
${[sourceText, ...textualFiles].filter(Boolean).join('\n\n')}
"""

Inspect the ENTIRE attached document and every PDF page, from the first page to the last. Do not stop after the first few topics. Before drafting, identify the distinct slide/section headings and main concepts throughout the source, including its final pages; then ensure the summary covers them in source order. Preserve exact slide/section headings where useful. If the source has more material than the selected mode can explain in depth, briefly cover every section rather than omitting later slides.
Approve only genuine Computer Science or Software Engineering study material. Reject vendor installers/software, personal/system logs, memes, jokes, and non-educational content. Mark niche or uncertain material as flagged.
If approved, produce a complete, faithful study-note summary of the entire source, preserving important concepts from the beginning, middle, and ending slides.
Mandatory for EVERY summary mode, including Very Short, Short, Standard, Expanded, and Detailed: do not include practical tasks for students to carry out during class. Omit exercise, worksheet, and lab instructions; group or discussion activities; class prompts; and submission requirements. Apply this exclusion regardless of the selected length or coverage target. Retain factual content and worked examples from the same slide when they explain a concept or are useful for exam revision.
Do not mention classroom practicals, labs, exercises, worksheets, or submission activities at all, even to say that they were omitted.
Selected summary mode: ${selectedSummaryMode.label}
Summary guidance: ${selectedSummaryMode.guidance}
Approximate length target: about ${selectedSummaryMode.maxCharacters} characters. Treat this as a guide, not a hard cutoff: completeness and coverage of the final slides are more important than staying under the target. Never end mid-sentence or silently omit later sections to meet the target.
Never invent details. Do not retain the original file or full source transcript.
Write the summary in clean, readable Markdown. Use normal Unicode for powers, subscripts, and symbols (for example, 2²⁰ = 1 MiB); do not output LaTeX delimiters ($), LaTeX commands, or raw markup such as \text{}.
After writing the summary, carefully scan every sentence and heading for technical concepts a student may not know. Include all specialist terms and non-obvious abbreviations/acronyms, including multi-word terms, even when their meaning is only implied by surrounding text. In particular, in digital logic identify terms such as open drain, open collector, totem pole, pull-up resistor, wire-OR/wired-OR, wired-AND, high impedance, floating input, active-low, TTL, and CMOS whenever they appear and are not explicitly explained in plain language. Do not omit a term just because it appears in a heading or inside another highlighted term. Exclude only ordinary words, very common basic abbreviations CPU, GPU, RAM, or terms already clearly defined.
For every term, use the exact spelling/case from the summary. Explain it in everyday language a beginner can picture; avoid unexplained jargon. Keep fields concise but complete (maximum 240 characters each); never cut a sentence off mid-word. Include an analogy, example, and purpose only when useful. Return up to 40 terms, prioritizing exam-relevant concepts and terms that the notes use without fully explaining.

${LEARN_SUMMARY_TEMPLATE_INSTRUCTIONS}

Keep notes easy to learn from and concise without omitting relevant examinable material. If a value or explanation is absent or unreadable, explicitly mark it as "not specified/readable in source" rather than guessing. Specialist terms may be explained in the hover glossary, but the notes must still state the term correctly in context.

Return JSON only:
{"verdict":"approved|flagged|rejected","title":"short note title","tagName":"existing matching tag or concise new tag beginning with # and no more than 25 characters","reason":"brief moderation reason","cleanSummary":"complete summary of all source sections; the selected character count is a target, not a hard limit","terms":[{"term":"exact term from cleanSummary","explanation":"plain-language meaning, max 120 characters","analogy":"short everyday comparison or empty string","example":"short example or empty string","whyItMatters":"purpose in plain language or empty string"}]}`,
    });

    try {
      const result = await callGemini(key, requestParts, false, 12000);
      if (!['approved', 'flagged', 'rejected'].includes(result.verdict)) {
        throw new Error('The AI moderation response did not include a valid verdict.');
      }
      if (result.verdict === 'rejected') {
        setStatus(`Not saved: the material did not pass academic-content moderation. ${result.reason || ''}`);
        return;
      }

      let summary = String(result.cleanSummary || '').trim();
      if (!summary) throw new Error('The AI returned an empty study summary. Please try again.');
      const moderationTitle = String(result.title || sourceNames[0] || 'Learn study material').trim().slice(0, 160);
      if (!hasStandardLearnSummaryFormat(summary)) {
        const formatted = await callGemini(key, [LEARN_SUMMARY_REFORMAT_PROMPT(moderationTitle, summary)], false, 12000);
        summary = typeof formatted.cleanSummary === 'string' ? formatted.cleanSummary.trim() : '';
      }
      if (!summary || !hasStandardLearnSummaryFormat(summary)) {
        throw new Error('The AI could not format the study notes into the required notebook template. Nothing was saved; please retry.');
      }
      const proposedTag = typeof result.tagName === 'string'
        ? `#${result.tagName.trim().replace(/^#+/, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_#-]/g, '').slice(0, 24)}`
        : '';
      const normalizedProposedTag = proposedTag.length > 1 ? proposedTag : '#General';
      const tagName = existingTags.find((tag) => tag.toLocaleLowerCase() === normalizedProposedTag.toLocaleLowerCase()) || normalizedProposedTag;

      const { data: curriculumMaterial, error: materialError } = await supabase
        .from('curriculum_materials')
        .insert({
          submitted_by: user.id,
          submitter_email: user.email,
          title: moderationTitle,
          tag_name: tagName,
          content_text: summary,
          status: result.verdict,
          ai_verdict_reason: result.verdict === 'flagged'
            ? `Submitted from Learn for admin review: ${String(result.reason || 'The AI could not confidently approve this material.').slice(0, 1000)}`
            : `AI Guardrail approved Learn material from ${categories.find((category) => category.id === selectedCategoryId)?.name || 'Learn'} / ${sections.find((section) => section.id === selectedSectionId)?.name || 'Study notes'}.`,
        })
        .select('id')
        .single();
      if (materialError) throw new Error(`Could not submit the moderated material to the shared curriculum: ${materialError.message}`);

      if (result.verdict === 'flagged') {
        setComposerText('');
        setAttachedFiles([]);
        setStatus(`This material needs admin review. A compact report was sent to the Admin menu; it will not be used in quizzes unless approved. ${tagWarning}`);
        return;
      }

      const terms: NoteTerm[] = Array.isArray(result.terms)
        ? result.terms
          .filter((item: Partial<NoteTerm>) =>
            typeof item.term === 'string'
            && item.term.trim().length > 0
            && typeof item.explanation === 'string'
            && item.explanation.trim().length > 0
            && summary.toLocaleLowerCase().includes(item.term.trim().toLocaleLowerCase())
          )
          .slice(0, 40)
          .map((item: Partial<NoteTerm>) => ({
            term: item.term!.trim().slice(0, 60),
            explanation: item.explanation!.trim().slice(0, 240),
            analogy: typeof item.analogy === 'string' ? item.analogy.trim().slice(0, 240) : undefined,
            example: typeof item.example === 'string' ? item.example.trim().slice(0, 240) : undefined,
            whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters.trim().slice(0, 240) : undefined,
          }))
        : [];
      const { data, error } = await supabase
        .from('learn_notes')
        .insert({
          user_id: user.id,
          section_id: selectedSectionId,
          title: moderationTitle,
          content_text: summary,
          source_name: sourceNames.join(', ').slice(0, 500) || null,
          terms,
        })
        .select('id, title, content_text, source_name, created_at, terms')
        .single();
      if (error) {
        if (error.code === '23514' && error.message.includes('learn_notes_content_text_check')) {
          const { error: rollbackError } = await supabase
            .from('curriculum_materials')
            .delete()
            .eq('id', curriculumMaterial.id)
            .eq('submitted_by', user.id);
          const rollbackMessage = rollbackError
            ? ` The shared curriculum copy could not be removed automatically (${rollbackError.message}).`
            : '';
          throw new Error(`Supabase is still enforcing the old note length limit. Run supabase/learn-note-content-limit.sql in Supabase SQL Editor, then try again.${rollbackMessage}`);
        }
        const { error: rollbackError } = await supabase
          .from('curriculum_materials')
          .delete()
          .eq('id', curriculumMaterial.id)
          .eq('submitted_by', user.id);
        if (rollbackError) {
          throw new Error(`${error.message} The curriculum copy could not be removed automatically (${rollbackError.message}).`);
        }
        throw error;
      }

      setNotes((current) => [...current, data as LearnNote]);
      setComposerText('');
      setAttachedFiles([]);
      setStatus(`Approved and saved privately. A compact summary was also added to the shared curriculum as ${tagName}. Original files were not stored. ${tagWarning}`);
    } catch (error) {
      setStatus(`Could not save study note: ${getSupabaseErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCategory = categories.find((category) => category.id === selectedCategoryId);
  const activeSection = sections.find((section) => section.id === selectedSectionId);
  const isAskPanelOpen = Boolean(activeSection && askEnabledSections.includes(activeSection.id));
  const advancedNotebookPages = paginateNotebookNotes(notes, notebookPageTarget);
  const notebookPageCount = advancedNotebookPages.length;
  const notebookContentPages = notes.map((note) => ({
    note,
    content: note.content_text,
    startsNote: true,
  }));
  const getNotebookPages = (pageIndex: number) => notebookLayoutMode === 'advanced'
    ? advancedNotebookPages.slice(pageIndex, pageIndex + 2)
    : advancedNotebookPages.slice(pageIndex, pageIndex + 1);
  const visibleNotebookPages = getNotebookPages(bookPageIndex);
  const displayedNotebookPages = (() => {
    if (!pageTurn) return visibleNotebookPages;
    const pages = [...pageTurn.pages];
    if (pageTurn.direction === 'next') {
      const revealedPage = pageTurn.targetPages[1] || pageTurn.targetPages[0];
      if (revealedPage) pages[1] = revealedPage;
    } else {
      const revealedPage = pageTurn.targetPages[0];
      if (revealedPage) pages[0] = revealedPage;
    }
    return pages;
  })();
  const turningPageBack = pageTurn
    ? pageTurn.direction === 'next'
      ? pageTurn.targetPages[0]
      : pageTurn.targetPages[1] || pageTurn.targetPages[0]
    : null;
  const finishBookPageTurn = () => {
    if (!pageTurn) return;
    setBookPageIndex(pageTurn.targetPageIndex);
    setPageTurn(null);
  };

  useEffect(() => {
    const lastAvailablePage = Math.max(0, advancedNotebookPages.length - 1);
    setBookPageIndex((index) => Math.min(index, lastAvailablePage));
  }, [advancedNotebookPages.length, notebookLayoutMode, notes.length]);

  useEffect(() => {
    if (!pageTurn) return;
    const timeout = window.setTimeout(() => {
      setBookPageIndex(pageTurn.targetPageIndex);
      setPageTurn(null);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [pageTurn]);

  useLayoutEffect(() => {
    if (!notebookMode || pageTurn) return;
    const fitVisiblePages = () => {
      const hasOverflow = [...notebookPageRefs.current.values()].some(
        (page) => page.scrollHeight > page.clientHeight + 2
      );
      if (hasOverflow) {
        setNotebookPageTarget((target) => target > 80 ? Math.max(80, Math.floor(target * 0.72)) : target);
      }
    };

    fitVisiblePages();
    window.addEventListener('resize', fitVisiblePages);
    return () => window.removeEventListener('resize', fitVisiblePages);
  }, [notebookMode, notebookPageTarget, bookPageIndex, notebookLayoutMode, advancedNotebookPages.length, notes.length, pageTurn]);

  const turnBookPage = (direction: 'next' | 'previous') => {
    if (pageTurn) return;
    const step = notebookLayoutMode === 'advanced' ? 2 : 1;
    const lastPage = Math.max(0, notebookPageCount - 1);
    const targetPage = direction === 'next'
      ? Math.min(lastPage, bookPageIndex + step)
      : Math.max(0, bookPageIndex - step);
    if (targetPage === bookPageIndex) return;
    const targetPages = getNotebookPages(targetPage);
    const turningPage = direction === 'next'
      ? visibleNotebookPages[1] || visibleNotebookPages[0]
      : visibleNotebookPages[0] || visibleNotebookPages[1];
    if (!turningPage) return;

    setBookTurnDirection(direction);
    setPageTurn({
      direction,
      page: turningPage,
      pages: visibleNotebookPages,
      targetPages,
      targetPageIndex: targetPage,
    });
  };

  const getNoteSurfaceClass = (visibleIndex: number) => {
    if (!notebookMode) return 'rounded-xl border border-white/[0.08] bg-[#191919] p-4 sm:p-5';
    if (notebookLayoutMode === 'simple') {
      return 'relative rounded-2xl border border-[#c9b98f] bg-[#f2e8ce] p-5 text-[#302a20] shadow-inner sm:p-8';
    }
    const pageEdgeClass = visibleIndex === 0
      ? 'rounded-l-2xl lg:rounded-l-2xl lg:rounded-r-none lg:border-r-0'
      : 'rounded-r-2xl lg:rounded-l-none lg:rounded-r-2xl';
    const pageHeightClass = isNotebookFullscreen ? 'h-[calc(100dvh-4rem)] min-h-0' : 'h-[min(72vh,640px)] min-h-[420px]';
    return `relative ${pageHeightClass} overflow-hidden border border-[#c9b98f] bg-[#f2e8ce] p-5 text-[#302a20] shadow-inner sm:p-8 ${pageEdgeClass}`;
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-[#111111] text-slate-100">
      <aside className="w-64 sm:w-72 shrink-0 border-r border-white/10 bg-[#171717] flex flex-col min-h-0">
        <div className="flex items-start gap-3 border-b border-white/10 p-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to menu"
            title="Back to menu"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BookOpen className="h-4 w-4 text-emerald-400" /> My learning
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Subjects and lecture sections</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {categories.map((category) => {
            const categorySections = selectedCategoryId === category.id ? sections : [];
            const expanded = selectedCategoryId === category.id;
            return (
              <div key={category.id} className="group">
                <div className={`flex items-center rounded-lg ${expanded ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
                  {editingCategoryId === category.id ? (
                    <form onSubmit={(event) => { event.preventDefault(); void renameCategory(category.id); }} className="flex flex-1 min-w-0 items-center gap-1 px-2 py-1">
                      <input autoFocus maxLength={80} value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} aria-label="Rename subject" className="min-w-0 w-full rounded-md bg-black/30 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-emerald-400/50" />
                      <button type="submit" aria-label="Save subject name" className="p-1 text-emerald-300 hover:text-emerald-200 cursor-pointer"><Check className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Cancel rename" onClick={() => setEditingCategoryId(null)} className="p-1 text-slate-500 hover:text-white cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className="flex-1 min-w-0 px-3 py-2 text-left text-xs font-medium text-slate-200 truncate cursor-pointer"
                      >
                        <ChevronDown className={`inline h-3 w-3 mr-2 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                        {category.name}
                      </button>
                      <button type="button" aria-label={`Rename ${category.name}`} title="Rename subject" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }} className="p-2 text-slate-500 hover:text-emerald-300 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`Delete ${category.name}`} onClick={() => deleteCategory(category)} className="p-2 text-slate-500 hover:text-red-300 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {expanded && (
                  <div className="ml-4 mt-1 pl-3 border-l border-white/10 space-y-1">
                    {categorySections.map((section) => (
                      <div key={section.id} className="group/section flex items-center gap-1">
                        {editingSectionId === section.id ? (
                          <form onSubmit={(event) => { event.preventDefault(); void renameSection(section.id); }} className="flex flex-1 min-w-0 items-center gap-1">
                            <input autoFocus maxLength={100} value={editingSectionName} onChange={(event) => setEditingSectionName(event.target.value)} aria-label="Rename section" className="min-w-0 w-full rounded-md bg-black/30 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-emerald-400/50" />
                            <button type="submit" aria-label="Save section name" className="p-1 text-emerald-300 hover:text-emerald-200 cursor-pointer"><Check className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Cancel rename" onClick={() => setEditingSectionId(null)} className="p-1 text-slate-500 hover:text-white cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedSectionId(section.id)}
                              className={`flex-1 min-w-0 text-left rounded-md px-2.5 py-2 text-xs truncate cursor-pointer ${selectedSectionId === section.id ? 'bg-emerald-400/10 text-emerald-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}
                            >
                              {section.name}
                            </button>
                            <button type="button" aria-label={`Rename ${section.name}`} title="Rename section" onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }} className="shrink-0 p-1.5 text-slate-600 hover:text-emerald-300 opacity-100 sm:opacity-0 group-hover/section:opacity-100 focus:opacity-100 cursor-pointer">
                              <Pencil className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {isAddingSection && expanded ? (
                      <form onSubmit={createSection} className="flex gap-1 pt-1">
                        <input autoFocus value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="Section name" className="min-w-0 w-full rounded-md bg-black/30 px-2 py-1.5 text-xs outline-none ring-1 ring-white/10 focus:ring-emerald-400/50" />
                        <button type="submit" aria-label="Create section" className="text-emerald-300 cursor-pointer"><Plus className="h-4 w-4" /></button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => { setSelectedCategoryId(category.id); setIsAddingSection(true); }} className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-slate-500 hover:text-emerald-300 cursor-pointer">
                        <Plus className="h-3 w-3" /> Add section
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {isAddingCategory ? (
            <form onSubmit={createCategory} className="flex gap-1 pt-2">
              <input autoFocus value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Subject name" className="min-w-0 w-full rounded-md bg-black/30 px-2 py-2 text-xs outline-none ring-1 ring-white/10 focus:ring-emerald-400/50" />
              <button type="submit" aria-label="Create subject" className="text-emerald-300 cursor-pointer"><Plus className="h-4 w-4" /></button>
            </form>
          ) : (
            <button type="button" onClick={() => setIsAddingCategory(true)} className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-white cursor-pointer">
              <FolderPlus className="h-4 w-4" /> New subject
            </button>
          )}
          {loadError && <p className="px-2 pt-2 text-[11px] text-red-300 break-words">{loadError}</p>}
        </div>
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            aria-pressed={notebookMode}
            onClick={() => {
              const nextValue = !notebookMode;
              setNotebookMode(nextValue);
              setBookPageIndex(0);
              try {
                localStorage.setItem(`revise_learn_notebook_mode_${user.id}`, String(nextValue));
              } catch (error) {
                console.warn('Could not save notebook view preference.', error);
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-medium transition-colors ${notebookMode ? 'border-amber-300/30 bg-amber-200/[0.08] text-amber-100' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
          >
            <BookOpen className="h-3.5 w-3.5" /> Notebook: {notebookMode ? 'On' : 'Off'}
          </button>
          <div className={`mt-2 flex items-center justify-between gap-2 ${notebookMode ? '' : 'opacity-40'}`}>
            <span className="text-[10px] text-slate-500">Layout</span>
            <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5">
              {(['simple', 'advanced'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={notebookLayoutMode === mode}
                  disabled={!notebookMode}
                  onClick={() => {
                    setNotebookLayoutMode(mode);
                    setBookPageIndex(0);
                    setPageTurn(null);
                    try {
                      localStorage.setItem(`revise_learn_notebook_layout_${user.id}`, mode);
                    } catch (error) {
                      console.warn('Could not save notebook layout preference.', error);
                    }
                  }}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${!notebookMode ? 'cursor-not-allowed text-slate-600' : notebookLayoutMode === mode ? 'bg-amber-100 text-[#302719]' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-600">Private to you · only moderated text summaries are stored.</p>
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#111111]">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-7 border-b border-white/[0.07]">
          <div className="min-w-0 text-xs text-slate-500 truncate">
            {activeCategory?.name || 'Choose a subject'}{activeSection ? <><span className="mx-2 text-slate-700">/</span><span className="text-slate-200">{activeSection.name}</span></> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-slate-600">Private notebook</span>
            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => setIsNotebookFullscreen(true)}
                aria-label="Open Learn fullscreen"
                title="Open Learn fullscreen"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-slate-300 transition hover:border-amber-200/30 hover:bg-white/[0.08] hover:text-white"
              >
                <Maximize2 className="h-3.5 w-3.5" /> Full screen
              </button>
            )}
          </div>
        </div>
        <div className="relative flex flex-1 min-h-0">
          <div ref={summaryContainerRef} onMouseUp={openAskForSelection} className="flex-1 min-w-0 min-h-0 overflow-y-auto px-4 sm:px-8 py-5">
              <div className={`mx-auto space-y-5 ${notebookMode ? 'max-w-5xl' : 'max-w-3xl'}`}>
              {!activeSection ? (
                <div className="min-h-[40vh] flex flex-col items-center justify-center text-center">
                  <BookOpen className="h-9 w-9 text-slate-700 mb-4" />
                  <h1 className="text-lg font-medium text-slate-200">Your learning journal</h1>
                  <p className="max-w-sm mt-2 text-sm text-slate-500">Create a subject and a section such as “Computer Organisation → Week 1.1” to start collecting your notes.</p>
                </div>
              ) : notes.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-500">This section is empty. Add notes or attach lecture material below.</div>
                ) : (
                  <>
                    {notebookMode && notebookLayoutMode === 'advanced' && <style>{`
                      @keyframes learn-page-turn-forward {
                        0% { transform: rotateY(0); box-shadow: 0 8px 18px rgba(30,20,8,.22); }
                        42% { box-shadow: 10px 10px 24px rgba(30,20,8,.34); }
                        100% { transform: rotateY(-180deg); box-shadow: 0 3px 8px rgba(30,20,8,.12); }
                      }
                      @keyframes learn-page-turn-backward {
                        0% { transform: rotateY(0); box-shadow: 0 8px 18px rgba(30,20,8,.22); }
                        42% { box-shadow: -10px 10px 24px rgba(30,20,8,.34); }
                        100% { transform: rotateY(180deg); box-shadow: 0 3px 8px rgba(30,20,8,.12); }
                      }
                      .learn-page-turn-leaf { transform-style: preserve-3d; animation-duration: .78s; animation-timing-function: cubic-bezier(.45,.02,.35,1); animation-fill-mode: both; }
                      .learn-page-turn-leaf.forward { transform-origin: left center; animation-name: learn-page-turn-forward; }
                      .learn-page-turn-leaf.backward { transform-origin: right center; animation-name: learn-page-turn-backward; }
                      .learn-page-turn-face { backface-visibility: hidden; }
                      .learn-page-turn-back { transform: rotateY(180deg); }
                      @media (prefers-reduced-motion: reduce) { .learn-page-turn-leaf { animation-duration: .01ms; } }
                    `}</style>}
                    <div className={`${isNotebookFullscreen
                      ? !notebookMode || notebookLayoutMode === 'simple'
                        ? 'fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 shadow-none backdrop-blur-md sm:p-8'
                        : 'fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/60 p-4 shadow-none backdrop-blur-md sm:p-8'
                      : 'contents'}${isNotebookFullscreen && isAskPanelOpen ? ' sm:pr-[360px]' : ''}`}>
                      <div
                        key={notebookMode ? `book-${bookPageIndex}` : 'notes-list'}
                        className={notebookMode
                          ? isNotebookFullscreen
                            ? notebookLayoutMode === 'simple'
                              ? 'relative my-auto grid w-full max-w-[820px] grid-cols-1 gap-3'
                              : `relative grid w-full max-w-[1180px] grid-cols-1 items-center gap-3 lg:grid-cols-2 lg:gap-0 learn-page-${bookTurnDirection}`
                            : notebookLayoutMode === 'simple'
                              ? 'relative mx-auto grid w-full max-w-[820px] grid-cols-1 gap-3'
                              : `relative grid grid-cols-1 gap-3 rounded-[1.75rem] border border-[#d8c89f] bg-[#332b1d] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:p-5 lg:grid-cols-2 lg:gap-0 learn-page-${bookTurnDirection}`
                          : isNotebookFullscreen
                            ? 'relative mx-auto w-full max-w-3xl space-y-5 pb-4'
                            : 'space-y-5'}
                        style={notebookMode && notebookLayoutMode === 'advanced' ? { perspective: '1800px' } : undefined}
                      >
                      {(notebookMode
                        ? notebookLayoutMode === 'simple' ? notebookContentPages : displayedNotebookPages
                        : notebookContentPages
                      ).map((page, visibleIndex) => (
                        <article
                          key={`${page.note.id}-${notebookMode ? `${bookPageIndex + visibleIndex}-${page.content.length}` : 'list'}`}
                          ref={notebookMode ? (element) => {
                            const pageKey = `${page.note.id}-${bookPageIndex + visibleIndex}-${page.content.length}`;
                            if (element) notebookPageRefs.current.set(pageKey, element);
                            else notebookPageRefs.current.delete(pageKey);
                          } : undefined}
                          className={getNoteSurfaceClass(visibleIndex)}
                          style={notebookMode ? {
                            backgroundImage: 'linear-gradient(#f5ecd7, #eee1c2)',
                          } : undefined}
                        >
                          {notebookLayoutMode === 'advanced' && <div className={`absolute bottom-0 top-0 w-6 ${visibleIndex === 0 ? 'left-0 bg-gradient-to-r from-[#967c4a]/15 to-transparent' : 'right-0 bg-gradient-to-l from-[#967c4a]/15 to-transparent'}`} />}
                          <div className="relative flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              {page.startsNote && <h2 className={`break-words text-sm font-semibold ${notebookMode ? 'text-[#282319]' : 'text-slate-100'}`}>{page.note.title}</h2>}
                              {page.startsNote && <time className={`mt-1 block text-[10px] ${notebookMode ? 'text-[#796b50]' : 'text-slate-600'}`}>{new Date(page.note.created_at).toLocaleString()}</time>}
                            </div>
                            {page.startsNote && <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void regenerateNote(page.note)}
                                aria-label={`Regenerate note ${page.note.title}`}
                                title="Regenerate note from saved text"
                                disabled={Boolean(isRegeneratingNoteId)}
                                className={`rounded-lg p-2 cursor-pointer disabled:cursor-wait disabled:opacity-50 ${notebookMode ? 'text-[#796b50] hover:bg-emerald-900/10 hover:text-emerald-700' : 'text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-300'}`}
                              >
                                {isRegeneratingNoteId === page.note.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <RefreshCw className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setDeleteNoteError(null); setNoteToDelete(page.note); }} aria-label={`Delete note ${page.note.title}`} title="Delete note" className={`rounded-lg p-2 cursor-pointer ${notebookMode ? 'text-[#796b50] hover:bg-red-900/10 hover:text-red-700' : 'text-slate-500 hover:bg-red-500/10 hover:text-red-300'}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>}
                          </div>
                          {page.startsNote && page.note.source_name && <p className={`relative mt-1 text-[10px] ${notebookMode ? 'text-[#796b50]' : 'text-slate-500'}`}>Source: {page.note.source_name}</p>}
                          <div className="relative">
                            <AnnotatedSummary content={page.content} terms={page.note.terms || []} visualHintsEnabled={visualHintsEnabled} paperTheme={notebookMode} />
                          </div>
                          {notebookMode && notebookLayoutMode === 'advanced' && <span className="absolute bottom-4 right-5 font-serif text-[10px] italic text-[#8a7a59]">{pageTurn && pageTurn.direction === 'next' && visibleIndex === 1 ? pageTurn.targetPageIndex + 2 : pageTurn && pageTurn.direction === 'previous' && visibleIndex === 0 ? pageTurn.targetPageIndex + 1 : bookPageIndex + visibleIndex + 1}</span>}
                        </article>
                      ))}
                      {notebookMode && notebookLayoutMode === 'advanced' && displayedNotebookPages.length === 1 && (
                        <div className={`relative flex ${isNotebookFullscreen ? 'h-[calc(100dvh-4rem)] min-h-0' : 'h-[min(72vh,640px)] min-h-[420px]'} flex-col items-center justify-center rounded-r-2xl border border-[#c9b98f] p-8 text-center text-[#796b50] shadow-inner`} style={{ backgroundImage: 'linear-gradient(#f5ecd7, #eee1c2)' }}>
                          <BookOpen className="h-8 w-8 opacity-50" />
                          <p className="mt-3 font-serif text-sm italic">Your next note will appear on this page.</p>
                          <span className="absolute bottom-4 right-5 font-serif text-[10px]">{bookPageIndex + 2}</span>
                        </div>
                      )}
                      {notebookMode && notebookLayoutMode === 'advanced' && pageTurn && (
                        <div
                          aria-hidden="true"
                          className={isNotebookFullscreen
                            ? `pointer-events-none absolute inset-y-0 z-20 w-1/2 ${pageTurn.direction === 'next' ? 'right-0 rounded-r-2xl' : 'left-0 rounded-l-2xl'}`
                            : `pointer-events-none absolute inset-y-3 z-20 w-[calc(50%-13px)] sm:inset-y-5 sm:w-[calc(50%-21px)] ${pageTurn.direction === 'next' ? 'right-3 rounded-r-2xl sm:right-5' : 'left-3 rounded-l-2xl sm:left-5'}`}
                          style={{ perspective: '1800px' }}
                        >
                          <div
                            className={`learn-page-turn-leaf ${pageTurn.direction === 'next' ? 'forward rounded-r-2xl' : 'backward rounded-l-2xl'} relative h-full w-full border border-[#c9b98f]`}
                            onAnimationEnd={finishBookPageTurn}
                          >
                            <div
                              className={`learn-page-turn-face absolute inset-0 overflow-hidden p-5 text-[#302a20] sm:p-8 ${pageTurn.direction === 'next' ? 'rounded-r-2xl' : 'rounded-l-2xl'}`}
                              style={{ backgroundImage: 'linear-gradient(#f5ecd7, #eee1c2)' }}
                            >
                              {pageTurn.page.startsNote && (
                                <>
                                  <h2 className="break-words text-sm font-semibold">{pageTurn.page.note.title}</h2>
                                  <time className="mt-1 block text-[10px] text-[#796b50]">{new Date(pageTurn.page.note.created_at).toLocaleString()}</time>
                                  {pageTurn.page.note.source_name && <p className="relative mt-1 text-[10px] text-[#796b50]">Source: {pageTurn.page.note.source_name}</p>}
                                </>
                              )}
                              <FormattedMarkdown content={pageTurn.page.content} terms={[]} paperTheme />
                            </div>
                            <div
                              className={`learn-page-turn-face learn-page-turn-back absolute inset-0 border border-[#c9b98f] ${pageTurn.direction === 'next' ? 'rounded-l-2xl' : 'rounded-r-2xl'}`}
                              style={{ backgroundImage: 'linear-gradient(#f5ecd7, #eee1c2)' }}
                            >
                              {turningPageBack && (
                                <div className={`h-full overflow-hidden p-5 text-[#302a20] sm:p-8 ${pageTurn.direction === 'next' ? 'rounded-l-2xl' : 'rounded-r-2xl'}`}>
                                  {turningPageBack.startsNote && (
                                    <>
                                      <h2 className="break-words text-sm font-semibold">{turningPageBack.note.title}</h2>
                                      <time className="mt-1 block text-[10px] text-[#796b50]">{new Date(turningPageBack.note.created_at).toLocaleString()}</time>
                                      {turningPageBack.note.source_name && <p className="relative mt-1 text-[10px] text-[#796b50]">Source: {turningPageBack.note.source_name}</p>}
                                    </>
                                  )}
                                  <FormattedMarkdown content={turningPageBack.content} terms={turningPageBack.note.terms || []} paperTheme />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {notebookMode && (
                        <>
                          {notebookLayoutMode === 'advanced' && (
                            <>
                              <button
                                type="button"
                                aria-label="Previous pages"
                                title="Previous pages"
                                disabled={bookPageIndex === 0 || Boolean(pageTurn)}
                                onClick={() => turnBookPage('previous')}
                                className="absolute left-0 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8c89f] bg-[#332b1d] p-2.5 text-[#f0dfb8] shadow-lg transition hover:scale-110 hover:bg-[#4a3c27] disabled:pointer-events-none disabled:opacity-0 sm:p-3"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Next pages"
                                title="Next pages"
                                disabled={bookPageIndex + 2 >= notebookPageCount || Boolean(pageTurn)}
                                onClick={() => turnBookPage('next')}
                                className="absolute right-0 top-1/2 z-30 translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8c89f] bg-[#332b1d] p-2.5 text-[#f0dfb8] shadow-lg transition hover:scale-110 hover:bg-[#4a3c27] disabled:pointer-events-none disabled:opacity-0 sm:p-3"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {notebookMode && notebookLayoutMode === 'advanced' && (
                      <div className={isNotebookFullscreen ? 'fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-[#d8c89f]/30 bg-[#332b1d]/95 px-4 py-2 shadow-lg' : 'flex items-center justify-center pt-2'}>
                        <span className={`text-[11px] ${isNotebookFullscreen ? 'text-[#e6d6b2]' : 'text-slate-500'}`}>
                          {`Pages ${bookPageIndex + 1}–${Math.min(bookPageIndex + 2, notebookPageCount)} of ${notebookPageCount}`}
                        </span>
                      </div>
                    )}
                    {isNotebookFullscreen && (
                      <button
                        type="button"
                        onClick={() => setIsNotebookFullscreen(false)}
                        aria-label="Close Learn fullscreen"
                        title="Close fullscreen (Esc)"
                        className="fixed right-5 top-5 z-[90] inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#171717]/95 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg transition hover:bg-[#292929]"
                      >
                        <X className="h-4 w-4" /> Close
                      </button>
                    )}
                    </div>
                  </>
                )}
              </div>
            </div>

          {isAskPanelOpen && activeSection && (
            <aside className={isNotebookFullscreen
              ? 'fixed right-0 top-0 bottom-0 z-[85] w-[min(360px,90vw)] shrink-0 border-l border-white/[0.08] bg-[#151515] flex flex-col min-h-0'
              : 'absolute right-0 top-0 bottom-0 z-20 w-[min(360px,90vw)] shrink-0 border-l border-white/[0.08] bg-[#151515] flex flex-col min-h-0 sm:static sm:z-auto sm:w-[360px]'}>
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><MessageCircle className="h-4 w-4 text-emerald-400" /> Ask about this section</h2>
                  <p className="mt-1 truncate text-[10px] text-slate-500">{activeSection.name} · clarifications expire after 7 days</p>
                </div>
                <button type="button" aria-label="Close Ask panel" onClick={() => closeAskPanel(activeSection.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4">
                {clarifications.length === 0 ? (
                  <p className="text-xs leading-6 text-slate-500">Select text in a note and choose <span className="text-emerald-300">Ask</span> to start a private clarification thread for this section.</p>
                ) : clarifications.map((clarification) => (
                  <article key={clarification.id} className="space-y-2 border-b border-white/[0.07] pb-4">
                    <blockquote className="rounded-r-lg border-l-2 border-emerald-500/50 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">{clarification.selected_text}</blockquote>
                    <p className="text-xs font-medium leading-5 text-slate-200">{clarification.question}</p>
                    <FormattedMarkdown content={clarification.answer} className="!mt-1 !text-xs !leading-6" />
                    <time className="block text-[10px] text-slate-600">{new Date(clarification.created_at).toLocaleString()}</time>
                  </article>
                ))}
                <div ref={clarificationEndRef} />
              </div>
              <form onSubmit={(event) => void submitClarification(event)} className="border-t border-white/[0.08] p-3">
                {selectedText && <p className="mb-2 line-clamp-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-[10px] text-slate-400">Selected: “{selectedText}”</p>}
                <textarea
                  value={clarificationQuestion}
                  onChange={(event) => setClarificationQuestion(event.target.value)}
                  placeholder={selectedText ? 'Ask a question about this passage…' : 'Select text and choose Ask first…'}
                  disabled={!selectedText || isAsking}
                  maxLength={4000}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#1c1c1c] p-3 text-xs leading-5 text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 disabled:opacity-50"
                />
                <button type="submit" disabled={!selectedText || !clarificationQuestion.trim() || isAsking} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                  {isAsking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {isAsking ? 'Thinking…' : 'Ask'}
                </button>
              </form>
            </aside>
          )}
          {isSaving && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#101010]/85 px-5 backdrop-blur-sm" role="status" aria-live="polite">
              <div className="w-full max-w-sm text-center">
                <div className="relative mx-auto flex h-24 w-32 items-center justify-center">
                  <div className="absolute left-4 top-4 h-16 w-12 -rotate-12 rounded-md border border-emerald-300/30 bg-[#17251d] shadow-lg animate-pulse" />
                  <div className="absolute right-4 top-4 h-16 w-12 rotate-12 rounded-md border border-emerald-300/40 bg-[#1d3024] shadow-lg animate-pulse [animation-delay:180ms]" />
                  <div className="relative z-10 flex h-20 w-16 items-center justify-center rounded-md border border-emerald-300/50 bg-[#20392a] shadow-[0_0_35px_rgba(52,211,153,0.18)]">
                    <BookOpen className="h-8 w-8 text-emerald-300 animate-pulse" />
                  </div>
                  <Loader2 className="absolute -right-1 top-0 h-5 w-5 animate-spin text-emerald-300" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-white">Preparing your study notes</h2>
                <p className="mt-2 min-h-5 text-sm text-emerald-200 transition-all">{loadingSteps[analysisStep]}</p>
                <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 rounded-full bg-emerald-400 animate-[learn-progress_1.6s_ease-in-out_infinite_alternate]" />
                </div>
                <style>{`@keyframes learn-progress { from { transform: translateX(-55%); } to { transform: translateX(155%); } } @media (prefers-reduced-motion: reduce) { .animate-\\[learn-progress_1\\.6s_ease-in-out_infinite_alternate\\] { animation: none; } }`}</style>
                <p className="mt-3 text-[11px] text-slate-500">Reviewing the slides, selecting key ideas, and shaping a clear summary.</p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.08] bg-[#141414] px-3 sm:px-6 pt-3 pb-4">
          <div className={`w-full ${isAskPanelOpen ? 'sm:w-[calc(100%-360px)]' : ''}`}>
            <div className="max-w-3xl mx-auto">
            {composerCollapsed ? (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[11px] text-slate-500">
                  {attachedFiles.length > 0 ? `${attachedFiles.length} attachment${attachedFiles.length === 1 ? '' : 's'} ready` : 'Prompt area minimized'}
                </span>
                <button
                  type="button"
                  onClick={() => setComposerCollapsed(false)}
                  aria-label="Expand prompt area"
                  title="Expand prompt area"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.08] cursor-pointer"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Expand
                </button>
              </div>
            ) : (
              <>
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setComposerCollapsed(true)}
                aria-label="Minimize prompt area"
                title="Minimize prompt area"
                disabled={isSaving}
                className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300">
                    <Paperclip className="h-3 w-3 text-emerald-300" />{file.name}
                    <button type="button" onClick={() => setAttachedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`} className="ml-1 text-slate-500 hover:text-red-300 cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-2xl border border-white/[0.12] bg-[#1c1c1c] focus-within:border-white/25 shadow-lg">
              <textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (!isSaving) void saveNote();
                  }
                }}
                placeholder={activeSection ? `Add a note to ${activeSection.name}…` : 'Create a subject and section before adding notes'}
                disabled={!activeSection || isSaving}
                rows={2}
                className="w-full resize-y bg-transparent px-4 pt-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.java,.ts,.tsx,.js,.py,.html,.css,.json" className="hidden" onChange={(event) => { void handleFileSelection(event.target.files); event.currentTarget.value = ''; }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!activeSection || isSaving} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40 cursor-pointer">
                    <FilePlus2 className="h-4 w-4" /> Attach
                  </button>
                  <span className="hidden sm:inline text-[10px] text-slate-600">PDF, notes and code · original files are discarded</span>
                </div>
                <button type="button" onClick={() => void saveNote()} disabled={!activeSection || isSaving || (!composerText.trim() && attachedFiles.length === 0)} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-black hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{isSaving ? 'Reviewing…' : 'Save note'}</span>
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <label htmlFor="learn-summary-mode" className="text-[11px] font-medium text-slate-500">Note detail</label>
              <select
                id="learn-summary-mode"
                value={summaryMode}
                onChange={(event) => setSummaryMode(event.target.value as SummaryModeId)}
                disabled={isSaving}
                className="w-full sm:w-auto min-w-0 rounded-lg border border-white/10 bg-[#1c1c1c] px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-emerald-400/40 disabled:opacity-50"
              >
                {SUMMARY_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
              </select>
              <span className="text-[10px] text-slate-600">~{SUMMARY_MODES.find((mode) => mode.id === summaryMode)?.maxCharacters.toLocaleString()} character target</span>
              <button
                type="button"
                aria-pressed={visualHintsEnabled}
                onClick={() => {
                  const nextValue = !visualHintsEnabled;
                  setVisualHintsEnabled(nextValue);
                  try {
                    localStorage.setItem(`revise_learn_visual_hints_${user.id}`, String(nextValue));
                  } catch (error) {
                    console.warn('Could not save visual hint preference.', error);
                  }
                }}
                className={`sm:ml-auto inline-flex items-center gap-1.5 self-start rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${visualHintsEnabled ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
              >
                {visualHintsEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Visual hints: {visualHintsEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {status && <p className={`mt-2 text-[11px] ${status.startsWith('Could not') || status.startsWith('Not saved') || status.startsWith('Add your') ? 'text-amber-300' : 'text-slate-500'}`}>{status}</p>}
              </>
            )}
            </div>
          </div>
        </div>
      </section>

      {selectionMenu && selectedText && activeSection && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={activateAskPanel}
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          className="fixed z-[110] inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-[#102019] px-3 py-2 text-xs font-semibold text-emerald-200 shadow-2xl hover:bg-[#163022] cursor-pointer"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Ask
        </button>
      )}

      {noteToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingNote) setNoteToDelete(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-note-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1b1b1b] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-500/10 p-2 text-red-300"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h2 id="delete-note-title" className="text-sm font-semibold text-white">Delete this note?</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400"><span className="text-slate-200">{noteToDelete.title}</span> will be permanently removed from this section.</p>
              </div>
            </div>
            {deleteNoteError && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{deleteNoteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={isDeletingNote} onClick={() => setNoteToDelete(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isDeletingNote} onClick={() => void deleteNote()} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50">
                {isDeletingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

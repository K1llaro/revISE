import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Eye, EyeOff, FilePlus2, FolderPlus, Loader2, MessageCircle, Paperclip, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttachedFile, UserSession } from '../../types/ise';
import { callGemini, readFileForGemini } from '../../lib/gemini';

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
  { id: 'expanded', label: 'Expanded Summary (Recommended)', maxCharacters: 7000, guidance: 'Explain the important ideas, definitions, relationships, mechanisms, steps, formulas, and representative examples from every section and slide in clear structured notes.' },
  { id: 'detailed', label: 'Detailed Summary', maxCharacters: 12000, guidance: 'Follow the source closely: cover every slide and section in order, preserving meaningful facts, definitions, mechanisms, steps, formulas, examples, and qualifications. Remove repetition, filler, and irrelevant information.' },
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

const renderInlineText = (text: string, terms: NoteTerm[], onTermHover?: (term: NoteTerm, x: number, y: number) => void, onTermLeave?: () => void) => {
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
      return <span key={`${part}-${index}`} className="text-emerald-400 underline decoration-emerald-500/40 decoration-dotted underline-offset-4 cursor-help" title={`${term.explanation}${term.example ? ` Example: ${term.example}` : ''}`} onMouseEnter={(event) => onTermHover?.(term, event.clientX, event.clientY)} onMouseMove={(event) => onTermHover?.(term, event.clientX, event.clientY)} onMouseLeave={onTermLeave}>{part}</span>;
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${part}-${index}`} className="font-semibold text-slate-100">{renderInlineText(part.slice(2, -2), terms, onTermHover, onTermLeave)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={`${part}-${index}`}>{renderInlineText(part.slice(1, -1), terms, onTermHover, onTermLeave)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`} className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.9em] text-emerald-200">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const FormattedMarkdown: React.FC<{
  content: string;
  terms?: NoteTerm[];
  className?: string;
  onTermHover?: (term: NoteTerm, x: number, y: number) => void;
  onTermLeave?: () => void;
}> = ({ content, terms = [], className = '', onTermHover, onTermLeave }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(<pre key={`code-${index}`} className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-6 text-emerald-200"><code>{codeLines.join('\n')}</code></pre>);
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
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const headingClass = level <= 2 ? 'text-lg font-bold text-white' : level === 3 ? 'text-base font-semibold text-slate-100' : 'text-sm font-semibold text-slate-200';
      blocks.push(<h3 key={`heading-${index}`} className={`${headingClass} pt-2`}>{renderInlineText(heading[2], terms, onTermHover, onTermLeave)}</h3>);
      return;
    }

    const unordered = line.match(/^\s*[*+-]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      blocks.push(
        <div key={`list-${index}`} className="flex gap-2 pl-2">
          <span className="shrink-0 text-emerald-500">{unordered ? '•' : `${line.match(/^\s*(\d+)[.)]/)?.[1]}.`}</span>
          <span className="min-w-0">{renderInlineText((unordered || ordered)![1], terms, onTermHover, onTermLeave)}</span>
        </div>
      );
      return;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    blocks.push(
      quote
        ? <blockquote key={`quote-${index}`} className="border-l-2 border-emerald-500/50 pl-3 text-slate-400">{renderInlineText(quote[1], terms, onTermHover, onTermLeave)}</blockquote>
        : <p key={`paragraph-${index}`} className="min-h-[1.5em]">{renderInlineText(line, terms, onTermHover, onTermLeave)}</p>
    );
  });

  if (codeLines.length > 0) {
    blocks.push(<pre key="code-end" className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-6 text-emerald-200"><code>{codeLines.join('\n')}</code></pre>);
  }

  return <div className={`mt-4 space-y-1 whitespace-pre-wrap text-sm leading-7 text-slate-300 ${className}`}>{blocks}</div>;
};

const AnnotatedSummary: React.FC<{ content: string; terms: NoteTerm[]; visualHintsEnabled: boolean }> = ({ content, terms, visualHintsEnabled }) => {
  const [hoveredTerm, setHoveredTerm] = useState<{ term: NoteTerm; x: number; y: number } | null>(null);
  const orderedTerms = visualHintsEnabled
    ? getVisibleTerms(content, terms).filter((term) => term.term.trim() && term.explanation.trim()).sort((a, b) => b.term.length - a.term.length)
    : [];
  const tooltipPosition = hoveredTerm
    ? {
        left: Math.max(12, Math.min(hoveredTerm.x + 12, window.innerWidth - 310)),
        top: Math.max(12, Math.min(hoveredTerm.y + 16, window.innerHeight - 170)),
      }
    : undefined;

  useEffect(() => {
    if (!visualHintsEnabled) setHoveredTerm(null);
  }, [visualHintsEnabled]);

  return (
    <>
      <FormattedMarkdown
        content={content}
        terms={orderedTerms}
        onTermHover={(term, x, y) => setHoveredTerm({ term, x, y })}
        onTermLeave={() => setHoveredTerm(null)}
      />
      {hoveredTerm && tooltipPosition && (
        <div
          role="tooltip"
          style={tooltipPosition}
          className="fixed z-[100] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-emerald-400/30 bg-[#101714] p-3 shadow-2xl pointer-events-none"
        >
          <strong className="block text-xs font-bold text-emerald-300">{hoveredTerm.term.term}</strong>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">{hoveredTerm.term.explanation}</p>
          {hoveredTerm.term.analogy && <p className="mt-2 text-[11px] leading-relaxed text-slate-300"><span className="font-semibold text-slate-200">Think of it as: </span>{hoveredTerm.term.analogy}</p>}
          {hoveredTerm.term.example && <p className="mt-2 text-[11px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Example: </span>{hoveredTerm.term.example}</p>}
          {hoveredTerm.term.whyItMatters && <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Why it matters: </span>{hoveredTerm.term.whyItMatters}</p>}
        </div>
      )}
    </>
  );
};

type SummaryModeId = typeof SUMMARY_MODES[number]['id'];

export const LearnWorkspace: React.FC<{
  user: UserSession;
  currentYear: string;
}> = ({ user, currentYear }) => {
  const [categories, setCategories] = useState<LearnCategory[]>([]);
  const [sections, setSections] = useState<LearnSection[]>([]);
  const [notes, setNotes] = useState<LearnNote[]>([]);
  const [clarifications, setClarifications] = useState<LearnClarification[]>([]);
  const [askEnabledSections, setAskEnabledSections] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<LearnNote | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [deleteNoteError, setDeleteNoteError] = useState<string | null>(null);
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
  const clarificationEndRef = useRef<HTMLDivElement | null>(null);

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
        setNotes((data || []).map((note) => ({ ...note, terms: Array.isArray(note.terms) ? note.terms : [] })) as LearnNote[]);
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
      const noteContext = notes.map((note) => `${note.title}\n${note.content_text}`).join('\n\n').slice(0, 12000);
      const result = await callGemini(key, `Answer a student's question about their private study notes. Use only the supplied note context and selected passage; state clearly if the notes do not provide enough information. Format the answer in concise Markdown. Return JSON only as {"answer":"..."}.\n\nSection: ${activeSection?.name || 'Study notes'}\nSelected passage:\n"""${selectedText}"""\n\nQuestion: ${question}\n\nStudy notes:\n"""${noteContext}"""`, false);
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
      const { data, error } = await supabase.from('curriculum_tags').select('name');
      if (error) throw error;
      existingTags = (data || []).map((tag) => tag.name).filter((tag): tag is string => typeof tag === 'string');
    } catch (error) {
      tagWarning = `Existing tags could not be loaded (${getSupabaseErrorMessage(error)}); moderation and submission will continue without tag matching.`;
      console.warn('Could not load curriculum tags before Learn material moderation.', error);
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
Selected summary mode: ${selectedSummaryMode.label}
Summary guidance: ${selectedSummaryMode.guidance}
Approximate length target: about ${selectedSummaryMode.maxCharacters} characters. Treat this as a guide, not a hard cutoff: completeness and coverage of the final slides are more important than staying under the target. Never end mid-sentence or silently omit later sections to meet the target.
Never invent details. Do not retain the original file or full source transcript.
Write the summary in clean, readable Markdown. Use normal Unicode for powers, subscripts, and symbols (for example, 2²⁰ = 1 MiB); do not output LaTeX delimiters ($), LaTeX commands, or raw markup such as \text{}.
After writing the summary, carefully scan every sentence and heading for technical concepts a student may not know. Include all specialist terms and non-obvious abbreviations/acronyms, including multi-word terms, even when their meaning is only implied by surrounding text. In particular, in digital logic identify terms such as open drain, open collector, totem pole, pull-up resistor, wire-OR/wired-OR, wired-AND, high impedance, floating input, active-low, TTL, and CMOS whenever they appear and are not explicitly explained in plain language. Do not omit a term just because it appears in a heading or inside another highlighted term. Exclude only ordinary words, very common basic abbreviations CPU, GPU, RAM, or terms already clearly defined.
For every term, use the exact spelling/case from the summary. Explain it in everyday language a beginner can picture; avoid unexplained jargon. Keep each field concise and include an analogy, example, and purpose only when useful. Return at most 20 terms, prioritizing the hardest concepts.

Return JSON only:
{"verdict":"approved|flagged|rejected","title":"short note title","tagName":"existing matching tag or concise new tag beginning with # and no more than 25 characters","reason":"brief moderation reason","cleanSummary":"complete summary of all source sections; the selected character count is a target, not a hard limit","terms":[{"term":"exact term from cleanSummary","explanation":"plain-language meaning, max 120 characters","analogy":"short everyday comparison or empty string","example":"short example or empty string","whyItMatters":"purpose in plain language or empty string"}]}`,
    });

    try {
      const result = await callGemini(key, requestParts, false, 6000);
      if (!['approved', 'flagged', 'rejected'].includes(result.verdict)) {
        throw new Error('The AI moderation response did not include a valid verdict.');
      }
      if (result.verdict === 'rejected') {
        setStatus(`Not saved: the material did not pass academic-content moderation. ${result.reason || ''}`);
        return;
      }

      const summary = String(result.cleanSummary || '').trim();
      if (!summary) throw new Error('The AI returned an empty study summary. Please try again.');
      const moderationTitle = String(result.title || sourceNames[0] || 'Learn study material').trim().slice(0, 160);
      const proposedTag = typeof result.tagName === 'string'
        ? `#${result.tagName.trim().replace(/^#+/, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_#-]/g, '').slice(0, 24)}`
        : '';
      const normalizedProposedTag = proposedTag.length > 1 ? proposedTag : '#General';
      const tagName = existingTags.find((tag) => tag.toLocaleLowerCase() === normalizedProposedTag.toLocaleLowerCase()) || normalizedProposedTag;
      const { error: tagError } = await supabase
        .from('curriculum_tags')
        .upsert({ name: tagName }, { onConflict: 'name' });
      if (tagError) {
        tagWarning = `${tagWarning ? `${tagWarning} ` : ''}The tag could not be added to curriculum_tags (${tagError.message}); the material itself will still be submitted.`;
        console.warn('Could not register the curriculum tag for Learn material.', tagError);
      }

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
          .slice(0, 20)
          .map((item: Partial<NoteTerm>) => ({
            term: item.term!.trim().slice(0, 60),
            explanation: item.explanation!.trim().slice(0, 120),
            analogy: typeof item.analogy === 'string' ? item.analogy.trim().slice(0, 100) : undefined,
            example: typeof item.example === 'string' ? item.example.trim().slice(0, 100) : undefined,
            whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters.trim().slice(0, 100) : undefined,
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

  return (
    <div className="flex h-full min-h-0 w-full bg-[#111111] text-slate-100">
      <aside className="w-64 sm:w-72 shrink-0 border-r border-white/10 bg-[#171717] flex flex-col min-h-0">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="h-4 w-4 text-emerald-400" /> My learning
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Subjects and lecture sections</p>
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
        <div className="border-t border-white/10 p-3 text-[10px] leading-relaxed text-slate-500">
          Private to your account. Only moderated text summaries are stored.
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#111111]">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-7 border-b border-white/[0.07]">
          <div className="min-w-0 text-xs text-slate-500 truncate">
            {activeCategory?.name || 'Choose a subject'}{activeSection ? <><span className="mx-2 text-slate-700">/</span><span className="text-slate-200">{activeSection.name}</span></> : null}
          </div>
          <span className="text-[10px] text-slate-600 shrink-0">Private notebook</span>
        </div>
        <div className="relative flex flex-1 min-h-0">
          <div ref={summaryContainerRef} onMouseUp={openAskForSelection} className="flex-1 min-w-0 min-h-0 overflow-y-auto px-4 sm:px-8 py-5">
            <div className="max-w-3xl mx-auto space-y-5">
              {!activeSection ? (
                <div className="min-h-[40vh] flex flex-col items-center justify-center text-center">
                  <BookOpen className="h-9 w-9 text-slate-700 mb-4" />
                  <h1 className="text-lg font-medium text-slate-200">Your learning journal</h1>
                  <p className="max-w-sm mt-2 text-sm text-slate-500">Create a subject and a section such as “Computer Organisation → Week 1.1” to start collecting your notes.</p>
                </div>
              ) : notes.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-500">This section is empty. Add notes or attach lecture material below.</div>
              ) : notes.map((note) => (
                <article key={note.id} className="rounded-xl border border-white/[0.08] bg-[#191919] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-100">{note.title}</h2>
                      <time className="mt-1 block text-[10px] text-slate-600">{new Date(note.created_at).toLocaleString()}</time>
                    </div>
                    <button type="button" onClick={() => { setDeleteNoteError(null); setNoteToDelete(note); }} aria-label={`Delete note ${note.title}`} title="Delete note" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {note.source_name && <p className="mt-1 text-[10px] text-slate-500">Source: {note.source_name}</p>}
                  <AnnotatedSummary content={note.content_text} terms={note.terms || []} visualHintsEnabled={visualHintsEnabled} />
                </article>
              ))}
            </div>
          </div>

          {isAskPanelOpen && activeSection && (
            <aside className="absolute right-0 top-0 bottom-0 z-20 w-[min(360px,90vw)] shrink-0 border-l border-white/[0.08] bg-[#151515] flex flex-col min-h-0 sm:static sm:z-auto sm:w-[360px]">
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
        </div>

        <div className="shrink-0 border-t border-white/[0.08] bg-[#141414] px-3 sm:px-6 pt-3 pb-4">
          <div className={`w-full ${isAskPanelOpen ? 'sm:w-[calc(100%-360px)]' : ''}`}>
            <div className="max-w-3xl mx-auto">
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
              <label htmlFor="learn-summary-mode" className="text-[11px] font-medium text-slate-500">Summary length</label>
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

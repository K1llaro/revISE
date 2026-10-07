import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, FilePlus2, FolderPlus, Loader2, Paperclip, Plus, Send, Trash2 } from 'lucide-react';
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
}

export const LearnWorkspace: React.FC<{
  user: UserSession;
  currentYear: string;
}> = ({ user, currentYear }) => {
  const [categories, setCategories] = useState<LearnCategory[]>([]);
  const [sections, setSections] = useState<LearnSection[]>([]);
  const [notes, setNotes] = useState<LearnNote[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        .select('id, title, content_text, source_name, created_at')
        .eq('user_id', user.id)
        .eq('section_id', selectedSectionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!cancelled) setNotes((data || []) as LearnNote[]);
    };
    loadNotes().catch((error: Error) => setLoadError(error.message));
    return () => { cancelled = true; };
  }, [selectedSectionId, user.id]);

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
    const sourceNames = attachedFiles.map((file) => file.name);
    const textualFiles = attachedFiles
      .filter((file) => !file.isPdf)
      .map((file) => `[File: ${file.name}]\n${(file.textContent || file.content).slice(0, 8000)}`);
    const requestParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = attachedFiles
      .filter((file) => file.isPdf && file.base64Data)
      .map((file) => ({ inlineData: { mimeType: 'application/pdf', data: file.base64Data || '' } }));
    requestParts.push({
      text: `You are the same strict academic content moderator used for revISE quiz uploads.
Student year: ${currentYear}
Source filenames: ${sourceNames.join(', ') || 'Pasted study notes'}
Pasted notes and readable file contents:
"""
${[sourceText, ...textualFiles].filter(Boolean).join('\n\n').slice(0, 10000)}
"""

Inspect PDF pages directly when attached. Approve only genuine Computer Science or Software Engineering study material. Reject vendor installers/software, personal/system logs, memes, jokes, and non-educational content. Mark niche or uncertain material as flagged.
If approved, produce a faithful, useful study-note summary preserving exact slide/section headings and key definitions. Never invent details. Keep cleanSummary at or below 5,500 characters. Do not retain the original file or full source transcript.

Return JSON only:
{"verdict":"approved|flagged|rejected","title":"short note title","reason":"brief moderation reason","cleanSummary":"compact study notes, max 5500 characters"}`,
    });

    try {
      const result = await callGemini(key, requestParts, false);
      if (result.verdict !== 'approved') {
        setStatus(result.verdict === 'flagged'
          ? `Not saved: this material needs review. ${result.reason || ''}`
          : `Not saved: the material did not pass academic-content moderation. ${result.reason || ''}`);
        return;
      }

      const summary = String(result.cleanSummary || '').trim().slice(0, 5500);
      if (!summary) throw new Error('The AI returned an empty study summary. Please try again.');
      const { data, error } = await supabase
        .from('learn_notes')
        .insert({
          user_id: user.id,
          section_id: selectedSectionId,
          title: String(result.title || sourceNames[0] || 'Study note').slice(0, 160),
          content_text: summary,
          source_name: sourceNames.join(', ').slice(0, 500) || null,
        })
        .select('id, title, content_text, source_name, created_at')
        .single();
      if (error) throw error;

      setNotes((current) => [...current, data as LearnNote]);
      setComposerText('');
      setAttachedFiles([]);
      setStatus('Approved and saved privately to this section. The original files were not stored.');
    } catch (error) {
      setStatus(`Could not save study note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCategory = categories.find((category) => category.id === selectedCategoryId);
  const activeSection = sections.find((section) => section.id === selectedSectionId);

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
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className="flex-1 min-w-0 px-3 py-2 text-left text-xs font-medium text-slate-200 truncate cursor-pointer"
                  >
                    <ChevronDown className={`inline h-3 w-3 mr-2 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                    {category.name}
                  </button>
                  <button type="button" aria-label={`Delete ${category.name}`} onClick={() => deleteCategory(category)} className="p-2 text-slate-500 hover:text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {expanded && (
                  <div className="ml-4 mt-1 pl-3 border-l border-white/10 space-y-1">
                    {categorySections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`block w-full text-left rounded-md px-2.5 py-2 text-xs truncate cursor-pointer ${selectedSectionId === section.id ? 'bg-emerald-400/10 text-emerald-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}
                      >
                        {section.name}
                      </button>
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
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-5">
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
                  <h2 className="text-sm font-semibold text-slate-100">{note.title}</h2>
                  <time className="shrink-0 text-[10px] text-slate-600">{new Date(note.created_at).toLocaleString()}</time>
                </div>
                {note.source_name && <p className="mt-1 text-[10px] text-slate-500">Source: {note.source_name}</p>}
                <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{note.content_text}</div>
              </article>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.08] bg-[#141414] px-3 sm:px-6 pt-3 pb-4">
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
            {status && <p className={`mt-2 text-[11px] ${status.startsWith('Could not') || status.startsWith('Not saved') || status.startsWith('Add your') ? 'text-amber-300' : 'text-slate-500'}`}>{status}</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

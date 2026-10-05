import React, { useState, useEffect } from 'react';
import { Brain, Code2, Bug, Upload, Settings, History, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { UserSession, StudyYear, ActiveModal, AppView, TestHistoryItem, FlaggedMaterial, AttachedFile, QuizQuestion, ProgrammingChallenge, CodeAnalysisDrill, QuestionReviewDetail } from '../../types/ise';
import { DEFAULT_YEAR_PROMPTS } from '../../lib/constants';
import { callGemini } from '../../lib/gemini';
import { ActiveQuizView, QuizResultsView, ActiveProgView, ProgResultsView, ActiveAnalysisView, AnalysisResultsView } from './ActiveViews';
import { QuizModal, ProgrammingModal, AnalysisModal, UploadModal, AdminModal, HistoryModal, SettingsModal } from './WorkspaceModals';

export const AuthenticatedWorkspace: React.FC<{
  user: UserSession;
  onSignOut: () => void;
  onApiKeyUpdated: (k: string) => void;
}> = ({ user, onSignOut, onApiKeyUpdated }) => {
  const [currentView, setCurrentView] = useState<AppView>('station');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  const [currentYear, setCurrentYear] = useState<StudyYear>(user.studyYear || 'year1');
  const [yearPrompts, setYearPrompts] = useState<Record<StudyYear, string>>(DEFAULT_YEAR_PROMPTS);

  // Custom Titles
  const [quizCustomTitle, setQuizCustomTitle] = useState('');
  const [progCustomTitle, setProgCustomTitle] = useState('');
  const [analysisCustomTitle, setAnalysisCustomTitle] = useState('');

  // Tags & Materials
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');

  const [historyList, setHistoryList] = useState<TestHistoryItem[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedMaterial[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Quiz State
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);
  const [quizCustomCount, setQuizCustomCount] = useState('');
  const [quizTimerMinutes, setQuizTimerMinutes] = useState(10);
  const [quizCustomTimer, setQuizCustomTimer] = useState('');
  const [quizThinkingMode, setQuizThinkingMode] = useState(true);
  const [quizPrompt, setQuizPrompt] = useState('');
  const [quizScoringMode, setQuizScoringMode] = useState<'partial' | 'strict'>('partial');
  const [quizTypes, setQuizTypes] = useState({ mcq: true, text: false, single: true });
  const [quizAttachedFiles, setQuizAttachedFiles] = useState<AttachedFile[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questions: QuizQuestion[]; timeLimit: number } | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string[]>>({});
  const [quizTimeLeft, setQuizTimeLeft] = useState(0);
  const [quizResults, setQuizResults] = useState<{ score: number; details: any[] } | null>(null);

  // Programming State
  const [progDifficulty, setProgDifficulty] = useState('Standard');
  const [progThinkingMode, setProgThinkingMode] = useState(true);
  const [progPrompt, setProgPrompt] = useState('');
  const [progAttachedFiles, setProgAttachedFiles] = useState<AttachedFile[]>([]);
  const [activeProg, setActiveProg] = useState<ProgrammingChallenge | null>(null);
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [progResults, setProgResults] = useState<{ score: number; feedback: string } | null>(null);

  // Code Analysis State
  const [analysisDifficulty, setAnalysisDifficulty] = useState('Standard');
  const [analysisThinkingMode, setAnalysisThinkingMode] = useState(true);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [analysisAttachedFiles, setAnalysisAttachedFiles] = useState<AttachedFile[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<CodeAnalysisDrill | null>(null);
  const [predictedOutputInput, setPredictedOutputInput] = useState('');
  const [scratchpadNotes, setScratchpadNotes] = useState('');
  const [analysisResults, setAnalysisResults] = useState<{ score: number; feedback: string } | null>(null);

  // Ingestion Upload State
  const [ingestionFiles, setIngestionFiles] = useState<AttachedFile[]>([]);
  const [uploadText, setUploadText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Settings
  const [apiKeyInput, setApiKeyInput] = useState(user.apiKey || '');
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  const isAdmin = user.email === 'dinosaurkiril@gmail.com';

  const handleAddNewTag = async (tagName: string) => {
    const clean = tagName.startsWith('#') ? tagName : `#${tagName}`;
    await supabase.from('curriculum_tags').upsert({ name: clean }, { onConflict: 'name' });
    setAvailableTags((prev) => Array.from(new Set([clean, ...prev])));
  };

  const loadData = async () => {
    // 1. Tags
    const { data: tags } = await supabase.from('curriculum_tags').select('name');
    if (tags && tags.length > 0) {
      setAvailableTags(tags.map((t) => t.name));
    } else {
      setAvailableTags(['#Java_OOP', '#Java_Arrays_Collections', '#AWS_CDK_Infrastructure', '#GitHub_Actions_CICD', '#Comp_Org_Buses']);
    }

    // 2. History with details and rawDate
    const { data: hist } = await supabase
      .from('test_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (hist) {
      setHistoryList(
        hist.map((h) => {
          let parsedDetails: QuestionReviewDetail[] | undefined = undefined;
          let parsedAdvice: string | undefined = undefined;

          if (h.ai_feedback && h.ai_feedback.startsWith('{')) {
            try {
              const obj = JSON.parse(h.ai_feedback);
              parsedDetails = obj.details;
              parsedAdvice = obj.weakSpotsAdvice;
            } catch (e) {}
          }

          return {
            id: h.id,
            title: h.title,
            type: h.type,
            score: h.score,
            maxScore: h.max_score,
            timeSpent: h.time_spent,
            aiFeedback: parsedAdvice || h.ai_feedback,
            weakSpotsAdvice: parsedAdvice,
            details: parsedDetails,
            date: new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            rawDate: h.created_at,
          };
        })
      );
    }

    // 3. Admin Queue
    if (isAdmin) {
      const { data: flagged } = await supabase
        .from('curriculum_materials')
        .select('*')
        .in('status', ['flagged', 'rejected'])
        .order('created_at', { ascending: false });

      if (flagged) {
        setFlaggedItems(
          flagged.map((f) => ({
            id: f.id,
            title: f.title,
            tagName: f.tag_name,
            submitterId: f.submitted_by,
            submitterEmail: f.submitter_email || 'Unknown',
            submitterNickname: f.submitter_nickname || 'Student',
            contentText: f.content_text,
            status: f.status,
            aiVerdictReason: f.ai_verdict_reason || 'Pending audit',
            createdAt: new Date(f.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))
        );
      }
    }
  };

  useEffect(() => { loadData(); }, [user.id]);

  useEffect(() => {
    if (currentView !== 'active_quiz' || quizTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setQuizTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          handleFinishQuiz();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentView, quizTimeLeft]);

  /* ==========================================================================
     🛡️ СТРОГАЯ ИНДЕКСАЦИЯ С ЦЕНЗОРОМ (0 БАЙТ ПРИ REJECTED)
     ========================================================================== */
  /* ==========================================================================
     🛡️ СТРОГАЯ ИНДЕКСАЦИЯ С ЦЕНЗОРОМ (0 БАЙТ ПРИ REJECTED)
     ========================================================================== */
  const indexSessionMaterial = async (
    files: AttachedFile[],
    customTitle: string,
    aiTitle: string,
    aiDetectedTag: string | undefined,
    aiVerdict: 'approved' | 'flagged' | 'rejected' | undefined,
    categoryType: 'Quiz' | 'Programming' | 'Code Analysis'
  ): Promise<string> => {
    let finalTag = selectedTag;

    // 1. Регистрируем тэг только для разрешенных материалов
    if (aiDetectedTag && aiVerdict === 'approved') {
      const cleanTag = '#' + aiDetectedTag.trim().replace(/^#+/, '').replace(/\s+/g, '_');
      finalTag = cleanTag;
      await supabase.from('curriculum_tags').upsert({ name: cleanTag }, { onConflict: 'name' });
      setAvailableTags((prev) => Array.from(new Set([cleanTag, ...prev])));
      setSelectedTag(cleanTag);
    }

    // 2. Записываем в базу (Approved идет в библиотеку, а Rejected/Flagged идет в админку с ником и ID!)
    if (files && files.length > 0 && aiVerdict) {
      const fileName = files[0].name;
      const title = customTitle.trim() || aiTitle || fileName;

      await supabase.from('curriculum_materials').insert({
        submitted_by: user.id,
        submitter_email: user.email,
        submitter_nickname: user.nickname || 'Student',
        title: title,
        tag_name: finalTag || '#Unverified',
        content_text: `[Source: ${categoryType} · ${fileName}]`,
        status: aiVerdict, // 'approved', 'flagged' или 'rejected'
        ai_verdict_reason: aiVerdict === 'rejected'
          ? 'Automatic Guardrail: Non-academic or third-party vendor file rejected.'
          : aiVerdict === 'flagged'
          ? 'Flagged for admin audit: niche or unverified syllabus relevance.'
          : `AI Approved for ${categoryType}.`,
      });

      console.log(`[Audit Log] Material logged with status: ${aiVerdict}`);
    }

    return finalTag;
  };

  /* ==========================================================================
     QUIZ HANDLER (С ПРОВЕРКОЙ ЦЕНЗОРА)
     ========================================================================== */
  const handleLaunchQuiz = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Please enter your Google AI Studio API Key in Settings first!');

    setIsGenerating(true);
    setGenerationError(null);

    const questionCount = quizCustomCount ? parseInt(quizCustomCount, 10) : quizQuestionCount;
    const minutes = quizCustomTimer ? parseInt(quizCustomTimer, 10) : quizTimerMinutes;

    const allowedFormats: string[] = [];
    if (quizTypes.single) allowedFormats.push('single-choice');
    if (quizTypes.mcq) allowedFormats.push('multiple-choice (multiple correct answers)');
    if (quizTypes.text) allowedFormats.push('fill-in open text');

    const requestParts: any[] = [];
    quizAttachedFiles.forEach((file) => {
      if (file.isPdf && file.base64Data) {
        requestParts.push({ inlineData: { mimeType: 'application/pdf', data: file.base64Data } });
      } else if (file.textContent || file.content) {
        requestParts.push({ text: `[Attached File: ${file.name}]\n${(file.textContent || file.content).slice(0, 8000)}` });
      }
    });

    const promptText = `
You are the lead examiner and academic gatekeeper for ISE at University of Limerick.
Cohort Context: ${yearPrompts[currentYear]}
Target Tag Provided: ${selectedTag || 'None'}
Existing Curriculum Tags in Database: [${availableTags.join(', ')}]
Allowed Formats: ${allowedFormats.join(', ')}
User Custom Prompt: ${quizPrompt || 'Comprehensive module exam'}
User Preferred Title: ${quizCustomTitle || 'None'}

CRITICAL CURRICULUM AUDIT INSTRUCTION:
1. Inspect any attached files above.
   - If it is hardware vendor software/utilities (e.g. Dell SupportAssist, Intel, Nvidia), personal non-academic logs, install scripts, or memes -> contentVerdict = "rejected".
   - If it is genuine Computer Science / Software Engineering teaching material (Java, Architecture, Buses, CDK, DevOps) -> contentVerdict = "approved".
   - If borderline or unusual niche -> contentVerdict = "flagged".
2. If genuine academic slides are attached, YOUR QUIZ MUST BE 100% STRICTLY BASED ON THE ATTACHED MATERIALS!
3. If approved or flagged, reuse an existing tag from the database list whenever applicable, or generate a clean hashtag starting with '#' (e.g. #Comp_Org_Buses, #Java_Arrays).

Task: Generate exactly ${questionCount} questions.
Output strictly as JSON without markdown wrapping:
{
  "title": "string (Academic Test Title)",
  "contentVerdict": "approved" | "flagged" | "rejected",
  "detectedTag": "string (e.g. #Comp_Org_Buses)",
  "questions": [
    {
      "id": 1,
      "question": "string",
      "codeSnippet": "string or empty",
      "type": "single" | "multiple" | "text",
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "correctAnswers": ["exact match string"],
      "explanation": "string"
    }
  ]
}
`;
    requestParts.push({ text: promptText });

    try {
      const data = await callGemini(key, requestParts, quizThinkingMode);

      // 🛡️ Сохраняем в базу ТОЛЬКО если не rejected:
      await indexSessionMaterial(
        quizAttachedFiles,
        quizCustomTitle,
        data.title,
        data.detectedTag,
        data.contentVerdict,
        'Quiz'
      );

      const finalTitle = quizCustomTitle.trim() || data.title || 'Technical Quiz Drill';

      setActiveQuiz({
        title: finalTitle,
        questions: data.questions,
        timeLimit: minutes,
      });

      setUserAnswers({});
      setQuizTimeLeft(minutes * 60);
      setIsGenerating(false);
      setActiveModal('none');
      setCurrentView('active_quiz');
    } catch (e: any) {
      setIsGenerating(false);
      setGenerationError(e.message);
    }
  };

  const handleFinishQuiz = async () => {
    if (!activeQuiz) return;
    let scoreTotal = 0;
    const reviewDetails: QuestionReviewDetail[] = [];

    activeQuiz.questions.forEach((q) => {
      const selected = userAnswers[q.id] || [];
      let pts = 0;
      let isCorrect = false;

      if (q.type === 'text') {
        const userText = (selected[0] || '').trim().toLowerCase();
        if (q.correctAnswers.some((ans) => userText.includes(ans.toLowerCase()))) {
          pts = 1.0;
          isCorrect = true;
        }
      } else {
        const correctCount = selected.filter((a) => q.correctAnswers.includes(a)).length;
        const wrongCount = selected.filter((a) => !q.correctAnswers.includes(a)).length;

        if (correctCount === q.correctAnswers.length && wrongCount === 0) {
          pts = 1.0;
          isCorrect = true;
        } else if (quizScoringMode === 'partial' && correctCount > 0) {
          pts = 0.5;
        }
      }

      scoreTotal += pts;
      reviewDetails.push({
        questionText: q.question,
        codeSnippet: q.codeSnippet,
        userAnswer: selected,
        correctAnswers: q.correctAnswers,
        isCorrect,
        points: pts,
        explanation: q.explanation,
      });
    });

    const finalScore = Math.round((scoreTotal / activeQuiz.questions.length) * 100);

    const wrongQuestions = reviewDetails.filter((r) => !r.isCorrect);
    let weakSpotsAdvice = 'Excellent performance! You mastered all tested concepts.';
    if (wrongQuestions.length > 0) {
      weakSpotsAdvice = `Review topics: ${wrongQuestions.map((w, idx) => `Q${idx + 1} (${w.questionText.slice(0, 50)}...)`).join('; ')}. Re-examine the corresponding lecture slides!`;
    }

    const payloadFeedback = JSON.stringify({
      weakSpotsAdvice,
      details: reviewDetails,
    });

    const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeQuiz.title}`;

    await supabase.from('test_history').insert({
      user_id: user.id,
      title: fullTitle,
      type: 'Quiz',
      score: finalScore,
      max_score: 100,
      time_spent: `${activeQuiz.timeLimit}m`,
      ai_feedback: payloadFeedback,
    });

    loadData();
    setQuizResults({ score: finalScore, details: reviewDetails });
    setCurrentView('quiz_results');
  };

  /* ==========================================================================
     PROGRAMMING HANDLER (С ПРОВЕРКОЙ ЦЕНЗОРА)
     ========================================================================== */
  const handleLaunchProgramming = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Enter Gemini API key in Settings!');

    setIsGenerating(true);
    setGenerationError(null);

    const requestParts: any[] = [];
    progAttachedFiles.forEach((file) => {
      if (file.isPdf && file.base64Data) {
        requestParts.push({ inlineData: { mimeType: 'application/pdf', data: file.base64Data } });
      } else if (file.textContent || file.content) {
        requestParts.push({ text: `[Attached File: ${file.name}]\n${(file.textContent || file.content).slice(0, 8000)}` });
      }
    });

    const promptText = `
You are the software architect and academic auditor for ISE University of Limerick.
Curriculum Context: ${yearPrompts[currentYear]}
Difficulty Level: ${progDifficulty}
Target Tag: ${selectedTag || '#Java_OOP'}
Existing Curriculum Tags in Database: [${availableTags.join(', ')}]
User Custom Title: ${progCustomTitle || 'None'}
User Focus Prompt: ${progPrompt || 'Practical programming challenge'}

AUDIT RULE:
- If attached files are vendor utilities (Dell, Intel), installers, or non-educational memes -> contentVerdict = "rejected".
- If legitimate computer science teaching materials -> contentVerdict = "approved".
- If niche/unverified -> contentVerdict = "flagged".

TASK: Generate a structured Java Lab Exercise matching university lab standards (Objective, Key Requirements, Pattern Rules, Example Output).
Output strictly as JSON without markdown wrapping:
{
  "title": "string (Lab Exercise Title)",
  "contentVerdict": "approved" | "flagged" | "rejected",
  "detectedTag": "string (e.g. #Java_OOP)",
  "language": "Java",
  "objective": "string (In this exercise, you will build...)",
  "requirements": [
    "1. Key requirement item...",
    "2. Another requirement..."
  ],
  "patternRules": [
    "Rule 1...",
    "Rule 2..."
  ],
  "exampleOutput": "string (Expected output)",
  "starterCode": "public class Solution {\\n    public static void main(String[] args) {\\n        // TODO\\n    }\\n}"
}
`;
    requestParts.push({ text: promptText });

    try {
      const data = await callGemini(key, requestParts, progThinkingMode);

      // 🛡️ Сохраняем в базу ТОЛЬКО если не rejected:
      await indexSessionMaterial(
        progAttachedFiles,
        progCustomTitle,
        data.title,
        data.detectedTag,
        data.contentVerdict,
        'Programming'
      );

      if (progCustomTitle.trim()) data.title = progCustomTitle.trim();

      setActiveProg(data);
      setStudentCodeInput(data.starterCode || '// Write Java implementation here\n');
      setIsGenerating(false);
      setActiveModal('none');
      setCurrentView('active_prog');
    } catch (e: any) {
      setIsGenerating(false);
      setGenerationError(e.message);
    }
  };

  const handleSubmitProgramming = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!activeProg || !key) return;

    setIsGenerating(true);
    const evalPrompt = `
You are the code examiner for ISE UL.
Problem: ${activeProg.title}
Requirements: ${activeProg.requirements?.join(' ')}
Student Code:
\`\`\`${activeProg.language}
${studentCodeInput}
\`\`\`

Strict Grading (0 to 100). Blank/boilerplate = 0. Partial points for logic, loop bounds, and output match.
Output strictly as JSON without markdown:
{
  "score": integer (0 to 100),
  "feedback": "string (Detailed rubric diagnosis)"
}
`;
    try {
      const result = await callGemini(key, evalPrompt, true);
      const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeProg.title}`;

      await supabase.from('test_history').insert({
        user_id: user.id,
        title: fullTitle,
        type: 'Code Challenge',
        score: result.score,
        max_score: 100,
        time_spent: 'Completed',
        ai_feedback: result.feedback,
      });

      loadData();
      setIsGenerating(false);
      setProgResults(result);
      setCurrentView('prog_results');
    } catch (e: any) {
      setIsGenerating(false);
      alert(e.message);
    }
  };

  /* ==========================================================================
     ANALYSIS HANDLER (С ПРОВЕРКОЙ ЦЕНЗОРА)
     ========================================================================== */
  const handleLaunchAnalysis = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Enter Gemini API key in Settings!');

    setIsGenerating(true);
    setGenerationError(null);

    const requestParts: any[] = [];
    analysisAttachedFiles.forEach((file) => {
      if (file.isPdf && file.base64Data) {
        requestParts.push({ inlineData: { mimeType: 'application/pdf', data: file.base64Data } });
      } else if (file.textContent || file.content) {
        requestParts.push({ text: `[Attached File: ${file.name}]\n${(file.textContent || file.content).slice(0, 8000)}` });
      }
    });

    const promptText = `
You are the ISE Code Tracing Examiner and Academic Gatekeeper for University of Limerick.
Curriculum: ${yearPrompts[currentYear]}
Difficulty: ${analysisDifficulty}
Target Tag: ${selectedTag || 'None'}
Existing Curriculum Tags in Database: [${availableTags.join(', ')}]
User Custom Title: ${analysisCustomTitle || 'None'}
Context: ${analysisPrompt || 'Nested loop execution drill based on attached materials'}

AUDIT RULE:
- If attached files are vendor utilities (Dell, Intel), installers, or non-educational memes -> contentVerdict = "rejected".
- If legitimate computer science teaching materials -> contentVerdict = "approved".
- If niche/unverified -> contentVerdict = "flagged".

Task: Generate a brain-twister "Mental Code Tracing" puzzle with nested loops and mutating counters.
Output strictly as JSON without markdown:
{
  "title": "string (Title)",
  "contentVerdict": "approved" | "flagged" | "rejected",
  "detectedTag": "string (e.g. #Comp_Org_Buses)",
  "language": "Java",
  "trickyCode": "string",
  "expectedOutput": "string (exact raw stdout output)",
  "traceExplanation": "string"
}
`;
    requestParts.push({ text: promptText });

    try {
      const data = await callGemini(key, requestParts, analysisThinkingMode);

      // 🛡️ Сохраняем в базу ТОЛЬКО если не rejected:
      await indexSessionMaterial(
        analysisAttachedFiles,
        analysisCustomTitle,
        data.title,
        data.detectedTag,
        data.contentVerdict,
        'Code Analysis'
      );

      if (analysisCustomTitle.trim()) data.title = analysisCustomTitle.trim();

      setActiveAnalysis(data);
      setPredictedOutputInput('');
      setScratchpadNotes('');
      setIsGenerating(false);
      setActiveModal('none');
      setCurrentView('active_analysis');
    } catch (e: any) {
      setIsGenerating(false);
      setGenerationError(e.message);
    }
  };

  const handleSubmitAnalysis = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!activeAnalysis || !key) return;

    setIsGenerating(true);
    const isExactMatch = predictedOutputInput.trim().toLowerCase() === activeAnalysis.expectedOutput.trim().toLowerCase();

    const evalPrompt = `
You are the ISE Code Tracing Examiner.
Code:
\`\`\`${activeAnalysis.language}
${activeAnalysis.trickyCode}
\`\`\`
Exact True Output: "${activeAnalysis.expectedOutput}"
Student's Predicted Output: "${predictedOutputInput}"
Student Scratchpad: "${scratchpadNotes}"

Task:
1. Exact match = 100.
2. If wrong, analyze where their mental model failed. Provide an iteration table.
Output strictly as JSON without markdown:
{
  "score": ${isExactMatch ? 100 : 'integer (0 to 60)'},
  "feedback": "string"
}
`;
    try {
      const result = await callGemini(key, evalPrompt, false);
      const finalScore = isExactMatch ? 100 : result.score;
      const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeAnalysis.title}`;

      await supabase.from('test_history').insert({
        user_id: user.id,
        title: fullTitle,
        type: 'Mental Code Tracing',
        score: finalScore,
        max_score: 100,
        time_spent: 'Completed',
        ai_feedback: result.feedback,
      });

      loadData();
      setIsGenerating(false);
      setAnalysisResults({ score: finalScore, feedback: result.feedback });
      setCurrentView('analysis_results');
    } catch (e: any) {
      setIsGenerating(false);
      alert(e.message);
    }
  };

  /* ==========================================================================
     UPLOAD HANDLER (С БЕЗКОМПРОМИССНЫМ ЦЕНЗОРОМ)
     ========================================================================== */
  const handleUploadWithAiAudit = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Enter Gemini API key in Settings!');

    const combinedContent = [uploadText, ...ingestionFiles.map((f) => `[File: ${f.name}]\n${f.content}`)].join('\n\n').trim();
    if (!combinedContent) return alert('Please attach files or paste notes first!');

    setUploadStatus('Analyzing & Moderating material with Google AI...');

    const promptText = `
You are the Curriculum Director and Strict Gatekeeper for ISE at University of Limerick.
Student Year: ${currentYear}
Existing Curriculum Tags in Database: [${availableTags.join(', ')}]
Content to inspect:
"""
${combinedContent.slice(0, 10000)}
"""

CRITICAL AUDIT INSTRUCTIONS:
1. REJECT IMMEDIATELY (verdict = "rejected"):
   - Any hardware vendor software, installers, setup files, telemetry logs (e.g. Dell SupportAssist, Intel, Nvidia, Windows setup, Apple diagnostics).
   - Any personal files, non-academic system logs, config dumps, or arbitrary executable scripts.
   - Any memes, jokes, or non-educational content.
2. ALLOW (verdict = "approved"):
   - ONLY genuine academic Computer Science / Software Engineering teaching materials (lecture slides, lab exercise descriptions, code algorithms in Java/TS/Rust/Python, database schemas, exam revision notes).
3. If valid but weird/niche -> verdict = "flagged" for admin manual audit.
4. Tag Generation: First inspect "Existing Curriculum Tags in Database". If the content matches an existing tag, YOU MUST REUSE IT. Do not invent slight spelling variations. Otherwise create a concise tag starting with '#' (e.g. #Comp_Org_Buses, #Java_OOP).

Output strictly as JSON without markdown:
{
  "verdict": "approved" | "flagged" | "rejected",
  "tagName": "string (starts with #, max 25 chars)",
  "title": "string",
  "reason": "string (concise reason why approved, flagged, or rejected)",
  "cleanSummary": "string"
}
`;
    try {
      const result = await callGemini(key, promptText, false);

      // ⛔ ЕСЛИ ОТКЛОНЕНО — В БАЗУ НЕ ПИШЕМ РОВНО НИЧЕГО!
      if (result.verdict === 'rejected') {
        setUploadStatus(`❌ Rejected: ${result.reason} (Zero records saved).`);
        return;
      }

      if (result.tagName) {
        await handleAddNewTag(result.tagName);
      }

      // Сохраняем ТОЛЬКО approved или flagged
      const { error } = await supabase.from('curriculum_materials').insert({
        submitted_by: user.id,
        submitter_email: user.email,
        title: result.title || 'Lecture Summary',
        tag_name: result.tagName || '#General',
        content_text: result.cleanSummary || combinedContent.slice(0, 5000),
        status: result.verdict,
        ai_verdict_reason: result.reason,
      });

      if (error) throw error;

      loadData();
      setUploadStatus(result.verdict === 'approved' ? `✅ Approved under ${result.tagName}!` : `⚠️ Flagged: ${result.reason}`);
      setUploadText('');
      setIngestionFiles([]);
    } catch (e: any) {
      setUploadStatus(`Error: ${e.message}`);
    }
  };

  const handleAdminAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve') await supabase.from('curriculum_materials').update({ status: 'approved' }).eq('id', id);
    else await supabase.from('curriculum_materials').delete().eq('id', id);
    loadData();
  };

  /* RENDER ACTIVE RUNNERS */
  if (currentView === 'active_prog' && activeProg) {
    return (
      <ActiveProgView
        activeProg={activeProg}
        progDifficulty={progDifficulty}
        studentCodeInput={studentCodeInput}
        setStudentCodeInput={setStudentCodeInput}
        isGenerating={isGenerating}
        onExit={() => setCurrentView('station')}
        onSubmit={handleSubmitProgramming}
      />
    );
  }

  if (currentView === 'prog_results' && progResults) {
    return <ProgResultsView activeProg={activeProg} progResults={progResults} onBack={() => setCurrentView('station')} />;
  }

  if (currentView === 'active_analysis' && activeAnalysis) {
    return (
      <ActiveAnalysisView
        activeAnalysis={activeAnalysis}
        analysisDifficulty={analysisDifficulty}
        predictedOutputInput={predictedOutputInput}
        setPredictedOutputInput={setPredictedOutputInput}
        scratchpadNotes={scratchpadNotes}
        setScratchpadNotes={setScratchpadNotes}
        isGenerating={isGenerating}
        onAbandon={() => setCurrentView('station')}
        onSubmit={handleSubmitAnalysis}
      />
    );
  }

  if (currentView === 'analysis_results' && analysisResults) {
    return <AnalysisResultsView activeAnalysis={activeAnalysis} analysisResults={analysisResults} predictedOutputInput={predictedOutputInput} onBack={() => setCurrentView('station')} />;
  }

  if (currentView === 'active_quiz' && activeQuiz) {
    return (
      <ActiveQuizView
        activeQuiz={activeQuiz}
        quizTimeLeft={quizTimeLeft}
        userAnswers={userAnswers}
        setUserAnswers={setUserAnswers}
        selectedTag={selectedTag}
        quizScoringMode={quizScoringMode}
        onAbandon={() => setCurrentView('station')}
        onSubmit={handleFinishQuiz}
      />
    );
  }

  if (currentView === 'quiz_results' && quizResults) {
    return <QuizResultsView activeQuiz={activeQuiz} quizResults={quizResults} onBack={() => setCurrentView('station')} />;
  }

  /* RENDER DASHBOARD */
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="revISE Logo" className="h-6 w-6 shrink-0 object-contain" />
            <h1 className="text-2xl font-black text-white leading-none flex items-center">
              <span>rev</span><span className="text-[#3ccb57]">ISE</span>&nbsp;<span>Learning Station</span>
            </h1>
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-[#3ccb57]/10 text-[10px] font-mono text-[#3ccb57] uppercase font-bold border border-[#3ccb57]/30 leading-none">
              {currentYear.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Student: <strong className="text-white">{user.nickname || user.email}</strong> ·{' '}
            {user.apiKey ? <span className="text-[#3ccb57]">AI Studio Active</span> : <span className="text-amber-400">No Key in Settings</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setActiveModal('admin')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/40 rounded-xl cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin ({flaggedItems.length})</span>
            </button>
          )}

          <button
            onClick={() => { loadData(); setActiveModal('history'); }}
            className="px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <History className="h-3.5 w-3.5 text-[#3ccb57]" />
            <span>History</span>
          </button>

          <button
            onClick={() => setActiveModal('settings')}
            className="px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          <button onClick={onSignOut} className="px-3.5 py-2 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl cursor-pointer">
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: Quiz Test */}
        <div onClick={() => setActiveModal('quiz')} className="group relative rounded-2xl border border-white/10 bg-[#060c20]/80 hover:border-sky-400/50 p-7 flex flex-col justify-between aspect-square cursor-pointer backdrop-blur-xl transition-all">
          <div className="absolute top-5 right-5 flex items-center">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          </div>

          <div>
            <div className="h-12 w-12 rounded-xl bg-sky-400/10 text-sky-400 flex items-center justify-center mb-4"><Brain className="h-6 w-6" /></div>
            <h2 className="text-xl font-bold text-white">Quiz Test</h2>
            <p className="text-xs text-slate-400 mt-2">Dynamic timed tests with single/multiple choice options and strict or partial credit.</p>
          </div>
          <span className="text-xs text-sky-400 font-semibold group-hover:underline">Launch Quiz →</span>
        </div>

        {/* CARD 2: Programming Exercises */}
        <div onClick={() => setActiveModal('programming')} className="group relative rounded-2xl border border-white/10 bg-[#060c20]/80 hover:border-[#3ccb57]/50 p-7 flex flex-col justify-between aspect-square cursor-pointer backdrop-blur-xl transition-all">
          <div className="absolute top-5 right-5 flex items-center">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3ccb57] shadow-[0_0_10px_#3ccb57]" />
          </div>

          <div>
            <div className="h-12 w-12 rounded-xl bg-[#3ccb57]/10 text-[#3ccb57] flex items-center justify-center mb-4"><Code2 className="h-6 w-6" /></div>
            <h2 className="text-xl font-bold text-white">Programming Exercises</h2>
            <p className="text-xs text-slate-400 mt-2">Structured Java lab exercises with objectives, requirements, and example outputs.</p>
          </div>
          <span className="text-xs text-[#3ccb57] font-semibold group-hover:underline">Write Code →</span>
        </div>

        {/* CARD 3: Code Analysis */}
        <div onClick={() => setActiveModal('analysis')} className="group relative rounded-2xl border border-white/10 bg-[#060c20]/80 hover:border-orange-400/50 p-7 flex flex-col justify-between aspect-square cursor-pointer backdrop-blur-xl transition-all">
          <div className="absolute top-5 right-5 flex items-center">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_#fb923c]" />
          </div>

          <div>
            <div className="h-12 w-12 rounded-xl bg-orange-400/10 text-orange-400 flex items-center justify-center mb-4"><Bug className="h-6 w-6" /></div>
            <h2 className="text-xl font-bold text-white">Code Analysis</h2>
            <p className="text-xs text-slate-400 mt-2">Mental execution drills! Convoluted nested loops and tracing without a compiler.</p>
          </div>
          <span className="text-xs text-orange-400 font-semibold group-hover:underline">Analyze Code →</span>
        </div>
      </div>

      <button onClick={() => setActiveModal('upload')} className="w-full p-5 rounded-2xl border border-white/10 bg-[#060c20]/80 hover:border-[#3ccb57]/50 flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white/5 text-[#3ccb57] flex items-center justify-center"><Upload className="h-5 w-5" /></div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Smart Ingestion & Tag Categorization</span>
              <span className="text-[10px] font-mono text-[#3ccb57] bg-[#3ccb57]/10 px-2 py-0.5 rounded-full">AI Moderated</span>
            </h3>
            <p className="text-xs text-slate-400">Submit lecture slides or notes. AI audits quality, creates/links hashtags, and indexes into cloud.</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-4 py-2 bg-[#3ccb57] text-black rounded-xl">Add Knowledge</span>
      </button>

      {/* MODALS */}
      <QuizModal
        isOpen={activeModal === 'quiz'}
        onClose={() => setActiveModal('none')}
        quizCustomTitle={quizCustomTitle}
        setQuizCustomTitle={setQuizCustomTitle}
        quizQuestionCount={quizQuestionCount}
        setQuizQuestionCount={setQuizQuestionCount}
        quizCustomCount={quizCustomCount}
        setQuizCustomCount={setQuizCustomCount}
        quizTimerMinutes={quizTimerMinutes}
        setQuizTimerMinutes={setQuizTimerMinutes}
        quizCustomTimer={quizCustomTimer}
        setQuizCustomTimer={setQuizCustomTimer}
        quizScoringMode={quizScoringMode}
        setQuizScoringMode={setQuizScoringMode}
        quizTypes={quizTypes}
        setQuizTypes={setQuizTypes}
        quizThinkingMode={quizThinkingMode}
        setQuizThinkingMode={setQuizThinkingMode}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        availableTags={availableTags}
        onAddNewTag={handleAddNewTag}
        quizAttachedFiles={quizAttachedFiles}
        setQuizAttachedFiles={setQuizAttachedFiles}
        quizPrompt={quizPrompt}
        setQuizPrompt={setQuizPrompt}
        isGenerating={isGenerating}
        generationError={generationError}
        onLaunch={handleLaunchQuiz}
      />

      <ProgrammingModal
        isOpen={activeModal === 'programming'}
        onClose={() => setActiveModal('none')}
        progCustomTitle={progCustomTitle}
        setProgCustomTitle={setProgCustomTitle}
        progDifficulty={progDifficulty}
        setProgDifficulty={setProgDifficulty}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        availableTags={availableTags}
        onAddNewTag={handleAddNewTag}
        progAttachedFiles={progAttachedFiles}
        setProgAttachedFiles={setProgAttachedFiles}
        progPrompt={progPrompt}
        setProgPrompt={setProgPrompt}
        isGenerating={isGenerating}
        onLaunch={handleLaunchProgramming}
      />

      <AnalysisModal
        isOpen={activeModal === 'analysis'}
        onClose={() => setActiveModal('none')}
        analysisCustomTitle={analysisCustomTitle}
        setAnalysisCustomTitle={setAnalysisCustomTitle}
        analysisDifficulty={analysisDifficulty}
        setAnalysisDifficulty={setAnalysisDifficulty}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        availableTags={availableTags}
        onAddNewTag={handleAddNewTag}
        analysisAttachedFiles={analysisAttachedFiles}
        setAnalysisAttachedFiles={setAnalysisAttachedFiles}
        analysisPrompt={analysisPrompt}
        setAnalysisPrompt={setAnalysisPrompt}
        isGenerating={isGenerating}
        onLaunch={handleLaunchAnalysis}
      />

      <UploadModal
        isOpen={activeModal === 'upload'}
        onClose={() => setActiveModal('none')}
        uploadStatus={uploadStatus}
        ingestionFiles={ingestionFiles}
        setIngestionFiles={setIngestionFiles}
        uploadText={uploadText}
        setUploadText={setUploadText}
        onUpload={handleUploadWithAiAudit}
      />

      <AdminModal
        isOpen={activeModal === 'admin'}
        onClose={() => setActiveModal('none')}
        flaggedItems={flaggedItems}
        onAction={handleAdminAction}
      />

      <HistoryModal
        isOpen={activeModal === 'history'}
        onClose={() => setActiveModal('none')}
        historyList={historyList}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal('none')}
        user={user}
        onNicknameUpdated={(newNick) => {
          user.nickname = newNick;
        }}
        currentYear={currentYear}
        onYearChange={async (yr) => {
          setCurrentYear(yr);
          await supabase.from('profiles').update({ study_year: yr }).eq('id', user.id);
        }}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        onSaveKey={() => {
          const trimmed = apiKeyInput.trim();
          if (trimmed) localStorage.setItem('gemini_api_key', trimmed);
          else localStorage.removeItem('gemini_api_key');
          onApiKeyUpdated(trimmed);
          setSettingsStatus('Saved locally!');
          setTimeout(() => setSettingsStatus(null), 2500);
        }}
        settingsStatus={settingsStatus}
      />
    </div>
  );
};
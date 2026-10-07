import React, { useState, useEffect, useRef } from 'react';
import { Brain, Code2, Bug, Upload, Settings, History, Shield, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { UserSession, StudyYear, ActiveModal, AppView, TestHistoryItem, FlaggedMaterial, AttachedFile, QuizQuestion, ProgrammingChallenge, CodeAnalysisDrill, QuestionReviewDetail, LeaderboardEntry, StudyMaterial } from '../../types/ise';
import { DEFAULT_YEAR_PROMPTS } from '../../lib/constants';
import { callGemini } from '../../lib/gemini';
import { ActiveQuizView, QuizResultsView, ActiveProgView, ProgResultsView, ActiveAnalysisView, AnalysisResultsView } from './ActiveViews';
import { QuizModal, ProgrammingModal, AnalysisModal, UploadModal, AdminModal, HistoryModal, SettingsModal, LeaderboardModal } from './WorkspaceModals';

export const AuthenticatedWorkspace: React.FC<{
  user: UserSession;
  onSignOut: () => void;
  onApiKeyUpdated: (k: string) => void;
}> = ({ user, onSignOut, onApiKeyUpdated }) => {
  const [currentView, setCurrentView] = useState<AppView>('station');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  const [currentYear, setCurrentYear] = useState<StudyYear>(user.studyYear || 'year1');
  const [yearPrompts, setYearPrompts] = useState<Record<StudyYear, string>>(DEFAULT_YEAR_PROMPTS);

  // Dynamic Subtitle Roll
  const DYNAMIC_SUBTITLES = [
    'Mission Control', 'Compiler Chamber', 'Mental Execution Rig', 'Bug Hunting Ground',
    'Studio LM173 Terminal', 'Residency Prep', 'Zero-Day Sandbox', 'Syntax Foundry',
    'Runtime Intelligence', 'Off-by-One Detector', 'Git Rebase Zone', 'Learning Station',
  ];
  const [subtitle, setSubtitle] = useState('Learning Station');

  useEffect(() => {
    setSubtitle(DYNAMIC_SUBTITLES[Math.floor(Math.random() * DYNAMIC_SUBTITLES.length)]);
  }, []);

  const handleShuffleSubtitle = () => {
    setSubtitle(DYNAMIC_SUBTITLES[Math.floor(Math.random() * DYNAMIC_SUBTITLES.length)]);
  };

  // Custom Titles
  const [quizCustomTitle, setQuizCustomTitle] = useState('');
  const [progCustomTitle, setProgCustomTitle] = useState('');
  const [analysisCustomTitle, setAnalysisCustomTitle] = useState('');

  // Tags & Materials
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');

  const [historyList, setHistoryList] = useState<TestHistoryItem[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedMaterial[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [studyMaterialsError, setStudyMaterialsError] = useState<string | null>(null);

  // Leaderboard Data
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

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
  const quizStartedAtRef = useRef<number | null>(null);
  const questionResponseTimesRef = useRef<Record<number, number>>({});
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

  // Расчет очков с множителем сложности
  const calculatePoints = (scorePercent: number, difficulty = 'Standard') => {
    let base = 0;
    if (scorePercent >= 80) base = 100;
    else if (scorePercent >= 65) base = 50;
    else if (scorePercent >= 40) base = 20;

    const multipliers: Record<string, number> = {
      'Very Easy': 0.5,
      'Easy': 0.8,
      'Standard': 1.0,
      'Hard': 1.5,
      'Challenge': 2.5,
    };
    const mult = multipliers[difficulty] || 1.0;
    return Math.round(base * mult);
  };

  const handleAddNewTag = async (tagName: string) => {
    const clean = tagName.startsWith('#') ? tagName : `#${tagName}`;
    await supabase.from('curriculum_tags').upsert({ name: clean }, { onConflict: 'name' });
    setAvailableTags((prev) => Array.from(new Set([clean, ...prev])));
  };

  // 🏆 Загрузка и расчет позиций лидерборда
  const fetchLeaderboardData = async () => {
    setIsLoadingLeaderboard(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Получаем профили студентов
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, real_name, study_year, hide_from_leaderboard, leaderboard_accepted')
      .eq('hide_from_leaderboard', false);

    // 2. Получаем историю за 30 дней
    const { data: allHistory } = await supabase
      .from('test_history')
      .select('user_id, score, max_score, points_earned, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (profiles) {
      const entries: LeaderboardEntry[] = profiles.map((prof) => {
        const userTests = (allHistory || []).filter((h) => h.user_id === prof.id);

        const totalPoints = userTests.reduce((acc, t) => acc + (t.points_earned || 0), 0);
        const avgAccuracy = userTests.length > 0
          ? Math.round(userTests.reduce((acc, t) => acc + (t.score / t.max_score) * 100, 0) / userTests.length)
          : 0;

        // 🌟 БЕЗГРАНИЧНЫЙ TOTAL RATING: Points × (Accuracy / 100)
        const totalIndex = totalPoints * (avgAccuracy / 100);

        return {
          userId: prof.id,
          rank: 0,
          nickname: prof.nickname || 'Student',
          realName: prof.real_name || undefined,
          studyYear: (prof.study_year as StudyYear) || 'year1',
          monthlyAccuracy: avgAccuracy,
          isePoints: totalPoints,
          totalScore: totalIndex,
          isCurrentUser: prof.id === user.id,
        };
      });

      // Сортировка по Total Score
      // 🏆 Сортировка с многоуровневыми тай-брейкерами:
      entries.sort((a, b) => {
        // 1. Главный показатель — Total Rating
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        // 2. Тай-брейкер 1: При равном Total побеждает более высокая точность (9% > 0%)
        if (b.monthlyAccuracy !== a.monthlyAccuracy) {
          return b.monthlyAccuracy - a.monthlyAccuracy;
        }
        // 3. Тай-брейкер 2: При равной точности побеждает большее количество XP
        if (b.isePoints !== a.isePoints) {
          return b.isePoints - a.isePoints;
        }
        // 4. По алфавиту
        return a.nickname.localeCompare(b.nickname);
      });

      entries.forEach((e, idx) => {
        e.rank = idx + 1;
      });

      setLeaderboardEntries(entries);
    }
    setIsLoadingLeaderboard(false);
  };

  const fetchStudyMaterials = async (tagName?: string) => {
    let query = supabase
      .from('curriculum_materials')
      .select('title, tag_name, content_text')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(40);

    if (tagName) query = query.eq('tag_name', tagName);

    const { data, error } = await query;
    if (error) {
      setStudyMaterialsError(error.message);
      throw error;
    }

    const materials = (data || []).map((item) => ({
      title: item.title || 'Untitled material',
      tagName: item.tag_name || '#General',
      summary: item.content_text || '',
    }));
    setStudyMaterials(materials);
    setStudyMaterialsError(null);
    return materials;
  };

  const loadData = async () => {
    const { data: tags } = await supabase.from('curriculum_tags').select('name');
    if (tags && tags.length > 0) {
      setAvailableTags(tags.map((t) => t.name));
    } else {
      setAvailableTags(['#Java_OOP', '#Java_Arrays_Collections', '#AWS_CDK_Infrastructure', '#GitHub_Actions_CICD', '#Comp_Org_Buses']);
    }

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
            pointsEarned: h.points_earned || 0,
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
            submitterEmail: f.submitter_email || 'Unknown',
            contentText: f.content_text,
            aiVerdictReason: f.ai_verdict_reason || 'Pending admin audit',
            createdAt: new Date(f.created_at).toLocaleDateString(),
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

  /* 🛡️ ИНДЕКСАЦИЯ С ЦЕНЗОРОМ */
  const indexSessionMaterial = async (
    files: AttachedFile[],
    customTitle: string,
    aiTitle: string,
    aiDetectedTag: string | undefined,
    aiVerdict: 'approved' | 'flagged' | 'rejected' | undefined,
    categoryType: 'Quiz' | 'Programming' | 'Code Analysis'
  ): Promise<string> => {
    let finalTag = selectedTag;

    if (aiVerdict === 'rejected') {
      console.warn(`[AI Guardrail] Material rejected by AI (${aiTitle}). Zero bytes saved to Supabase.`);
      return finalTag;
    }

    if (aiDetectedTag) {
      const cleanTag = '#' + aiDetectedTag.trim().replace(/^#+/, '').replace(/\s+/g, '_');
      finalTag = cleanTag;
      await supabase.from('curriculum_tags').upsert({ name: cleanTag }, { onConflict: 'name' });
      setAvailableTags((prev) => Array.from(new Set([cleanTag, ...prev])));
      setSelectedTag(cleanTag);
    }

    if (files && files.length > 0 && aiVerdict) {
      const fileName = files[0].name;
      const title = customTitle.trim() || aiTitle || fileName;

      await supabase.from('curriculum_materials').insert({
        submitted_by: user.id,
        submitter_email: user.email,
        title: title,
        tag_name: finalTag || '#General',
        content_text: `[Source: ${categoryType} · ${fileName}]\nVerified by AI Guardrail.`,
        status: aiVerdict,
        ai_verdict_reason: aiVerdict === 'flagged'
          ? 'Flagged for admin audit: niche, third-party software, or unverified curriculum relevance.'
          : `AI Guardrail Approved for ${categoryType}.`,
      });
    }

    return finalTag;
  };

  /* QUIZ HANDLER */
  const handleLaunchQuiz = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Please enter your Google AI Studio API Key in Settings first!');

    setIsGenerating(true);
    setGenerationError(null);

    const questionCount = quizCustomCount ? parseInt(quizCustomCount, 10) : quizQuestionCount;
    const minutes = quizCustomTimer ? parseInt(quizCustomTimer, 10) : quizTimerMinutes;
    let linkedMaterials: StudyMaterial[];
    try {
      linkedMaterials = await fetchStudyMaterials(selectedTag || undefined);
    } catch (error) {
      setIsGenerating(false);
      setGenerationError(error instanceof Error ? error.message : 'Could not load approved study materials.');
      return;
    }

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
Approved Supabase study materials for this topic:
${linkedMaterials.map((material) => `- Title: ${material.title}\n  Tag: ${material.tagName}\n  Summary: ${material.summary.slice(0, 900)}`).join('\n').slice(0, 7000) || 'No approved material found for this tag.'}

CRITICAL AUDIT INSTRUCTIONS:
1. Inspect attached files: If vendor software (Dell, Intel), installers, or memes -> contentVerdict = "rejected". If legitimate CS learning material -> contentVerdict = "approved". If niche -> contentVerdict = "flagged".
2. When approved Supabase study materials are listed, base questions on them and use the exact slide/section heading from a material summary as slideTitle. If no heading is listed, use the exact material title; leave slideTitle empty only when no listed material supports the question.
3. If genuine slides are attached, the quiz must also be strictly based on the attached materials.
4. If approved/flagged, reuse an existing tag from the database or create a new hashtag starting with '#' (e.g. #Comp_Org_Buses).
5. Give every question a concise topic suitable for a learning-mastery report.

Task: Generate exactly ${questionCount} questions.
Output strictly as JSON without markdown:
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
      "explanation": "string",
      "topic": "short concept name",
      "slideTitle": "exact slide/section heading or material title from listed Supabase materials, or empty string"
    }
  ]
}
`;
    requestParts.push({ text: promptText });

    try {
      const data = await callGemini(key, requestParts, quizThinkingMode);

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
        questions: data.questions.map((question: QuizQuestion) => {
          const slideTitle = (question.slideTitle || '').trim();
          const matchedMaterial = linkedMaterials.find(
            (material) => {
              const normalizedSlideTitle = slideTitle.toLowerCase();
              return normalizedSlideTitle === material.title.toLowerCase()
                || (normalizedSlideTitle.length > 0 && material.summary.toLowerCase().includes(normalizedSlideTitle));
            }
          );
          return {
            ...question,
            topic: question.topic?.trim() || undefined,
            slideTitle: matchedMaterial ? slideTitle || matchedMaterial.title : undefined,
          };
        }),
        timeLimit: minutes,
      });

      setUserAnswers({});
      questionResponseTimesRef.current = {};
      setQuizTimeLeft(minutes * 60);
      quizStartedAtRef.current = Date.now();
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
        topic: q.topic,
        slideTitle: q.slideTitle,
        questionType: q.type,
        responseTimeSeconds: questionResponseTimesRef.current[q.id],
      });
    });

    const finalScore = Math.round((scoreTotal / activeQuiz.questions.length) * 100);
    const earnedPoints = calculatePoints(finalScore, 'Standard');
    const elapsedSeconds = quizStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - quizStartedAtRef.current) / 1000))
      : activeQuiz.timeLimit * 60;

    const wrongQuestions = reviewDetails.filter((r) => !r.isCorrect);
    let weakSpotsAdvice = 'Excellent performance! You mastered all tested concepts.';
    if (wrongQuestions.length > 0) {
      weakSpotsAdvice = `Review topics: ${wrongQuestions.map((w, idx) => `Q${idx + 1} (${w.questionText.slice(0, 50)}...)`).join('; ')}. Re-examine corresponding lecture slides!`;
    }

    const payloadFeedback = JSON.stringify({
      weakSpotsAdvice,
      details: reviewDetails,
      durationSeconds: elapsedSeconds,
    });

    const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeQuiz.title}`;

    const { error } = await supabase.from('test_history').insert({
      user_id: user.id,
      title: fullTitle,
      type: 'Quiz',
      score: finalScore,
      max_score: 100,
      points_earned: earnedPoints,
      time_spent: `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
      ai_feedback: payloadFeedback,
    });

    if (error) {
      alert(`Could not save quiz results: ${error.message}`);
      return;
    }

    quizStartedAtRef.current = null;
    loadData();
    setQuizResults({ score: finalScore, details: reviewDetails });
    setCurrentView('quiz_results');
  };

  /* PROGRAMMING HANDLER */
  /* ==========================================================================
     PROGRAMMING HANDLER (ЧЕТКИЕ ИНСТРУКЦИИ И СПЕЦИФИКАЦИИ)
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
You are the Software Construction Professor for ISE (Immersive Software Engineering) at University of Limerick.
Curriculum Context: ${yearPrompts[currentYear]}
Difficulty Level: ${progDifficulty}
Target Tag: ${selectedTag || '#Java_Core'}
User Custom Title: ${progCustomTitle || 'None'}
User Focus Prompt: ${progPrompt || 'Practical Java programming challenge'}

TASK: Generate an unambiguous, structured Java Lab Exercise with crystal-clear specifications.

REQUIREMENTS FOR TASK GENERATION:
1. Title: Clear academic title.
2. Objective: 2-3 concise sentences stating exactly what the student must build.
3. Requirements: A numbered list of EXACT implementation steps (e.g. 1. User Input, 2. Outer Loop, 3. Inner Loop, 4. Output Formatting).
4. Pattern Rules: Explicit rules for edge cases and layout (e.g. leading spaces, star counts).
5. Example Output: Realistic, exact stdout terminal output.
6. Starter Code: Working boilerplate with imports and \`public class Solution\`.

Output strictly as JSON without markdown:
{
  "title": "string",
  "contentVerdict": "approved" | "flagged" | "rejected",
  "detectedTag": "string (e.g. #Java_Nested_Loops)",
  "language": "Java",
  "objective": "string",
  "requirements": [
    "1. Requirement...",
    "2. Requirement..."
  ],
  "patternRules": [
    "Task A: ...",
    "Task B: ..."
  ],
  "exampleOutput": "string",
  "starterCode": "import java.util.Scanner;\\n\\npublic class Solution {\\n    public static void main(String[] args) {\\n        Scanner scanner = new Scanner(System.in);\\n        // TODO\\n    }\\n}"
}
`;
    requestParts.push({ text: promptText });

    try {
      const data = await callGemini(key, requestParts, progThinkingMode);

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

  /* ==========================================================================
     СПРАВЕДЛИВАЯ ОЦЕНКА КОДА ПО 4-УРОВНЕВОМУ РУБРИКАТОРУ
     ========================================================================== */
  const handleSubmitProgramming = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!activeProg || !key) return;

    setIsGenerating(true);

    const evalPrompt = `
You are the Senior Code Evaluator for ISE (Immersive Software Engineering) at University of Limerick.

PROBLEM CONTEXT:
Title: ${activeProg.title}
Objective: ${activeProg.objective}
Requirements: ${activeProg.requirements?.join(' | ')}
Pattern Rules: ${activeProg.patternRules?.join(' | ')}
Expected Output Sample:
${activeProg.exampleOutput}

STUDENT SUBMITTED CODE:
\`\`\`${activeProg.language}
${studentCodeInput}
\`\`\`

GRADING RUBRIC (Total 100 Points):
1. Core Logic & Algorithm (40 pts): Did the student build the correct loop structure, conditional logic, and algorithmic flow?
2. Output Fidelity (30 pts): Does the logic produce the intended pattern/results?
3. Syntax & Variable Handling (20 pts): Valid Java syntax, types, initialization (e.g. \`int x = 0\`), scanner usage.
4. Clean Code & Style (10 pts): Readable formatting, naming conventions.

CRITICAL FAIRNESS RULES:
- DO NOT fail the entire submission or assign 0-20 points for minor syntax slips (e.g. declaring \`int x;\` without immediate initialization or minor off-by-one bounds). Minor syntax slips only deduct 5-10 points in the Syntax section!
- Award full or high points for Logic (40 pts) if the nested loop mechanism or algorithm is conceptually sound.
- If code is completely blank or only unmodified starter boilerplate -> Score = 0.
- Provide constructive, encouraging feedback with an explicit breakdown of points earned per section.
- Make sure to provide a highly detailed output explaining where the student has made an error, how to fix it, what are the consequences and what better approaches he may take next time to optimize the code and get a higher mark.

Output strictly as JSON without markdown:
{
  "score": integer (0 to 100),
  "feedback": "string (Structured feedback: Logic: X/40, Output: Y/30, Syntax: Z/20, Style: W/10. Specific line-by-line advice and corrections)"
}
`;

    try {
      const result = await callGemini(key, evalPrompt, true);
      const earnedPoints = calculatePoints(result.score, progDifficulty);
      const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeProg.title}`;

      await supabase.from('test_history').insert({
        user_id: user.id,
        title: fullTitle,
        type: 'Code Challenge',
        score: result.score,
        max_score: 100,
        points_earned: earnedPoints,
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

  /* ANALYSIS HANDLER */
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
- If niche -> contentVerdict = "flagged".

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
      const earnedPoints = calculatePoints(finalScore, analysisDifficulty);
      const fullTitle = `${selectedTag ? selectedTag + ' · ' : ''}${activeAnalysis.title}`;

      await supabase.from('test_history').insert({
        user_id: user.id,
        title: fullTitle,
        type: 'Mental Code Tracing',
        score: finalScore,
        max_score: 100,
        points_earned: earnedPoints,
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

  /* UPLOAD HANDLER */
  const handleUploadWithAiAudit = async () => {
    const key = user.apiKey || localStorage.getItem('gemini_api_key');
    if (!key) return alert('Enter Gemini API key in Settings!');

    const combinedContent = [
      uploadText,
      ...ingestionFiles.filter((file) => !file.isPdf).map((file) => `[File: ${file.name}]\n${file.textContent || file.content}`),
    ].join('\n\n').trim();
    if (!combinedContent && ingestionFiles.length === 0) return alert('Please attach files or paste notes first!');

    setUploadStatus('Analyzing & Moderating material with Google AI...');

    const promptText = `
You are the Curriculum Director and Strict Gatekeeper for ISE at University of Limerick.
Student Year: ${currentYear}
Existing Curriculum Tags in Database: [${availableTags.join(', ')}]
Attached filenames: ${ingestionFiles.map((file) => file.name).join(', ') || 'Pasted notes'}
Text content to inspect:
"""
${combinedContent.slice(0, 10000)}
"""

CRITICAL AUDIT INSTRUCTIONS:
1. REJECT IMMEDIATELY (verdict = "rejected"):
   - Any hardware vendor software, installers, setup files, telemetry logs (e.g. Dell SupportAssist, Intel, Nvidia, Windows setup, Apple diagnostics).
   - Any personal files, non-academic system logs, config dumps, or arbitrary executable scripts.
   - Any memes, jokes, or non-educational content.
2. ALLOW (verdict = "approved"):
   - ONLY genuine academic Computer Science / Software Engineering teaching materials.
3. If valid but weird/niche -> verdict = "flagged" for admin manual audit.
4. Tag Generation: First inspect "Existing Curriculum Tags in Database". If content matches an existing tag, REUSE IT. Do not invent slight spelling variations. Otherwise create a concise tag starting with '#' (e.g. #Comp_Org_Buses, #Java_OOP).
5. For PDFs, inspect the attached pages directly. Keep cleanSummary under 1,600 characters, preserve exact slide/section titles and concise key concepts so future quizzes can cite the correct material. Do not copy full slide text.

Output strictly as JSON without markdown:
{
  "verdict": "approved" | "flagged" | "rejected",
  "tagName": "string (starts with #, max 25 chars)",
  "title": "string",
  "reason": "string",
  "cleanSummary": "string (compact, max 1600 characters; retain exact slide/section titles)"
}
`;
    try {
      const requestParts: any[] = ingestionFiles
        .filter((file) => file.isPdf && file.base64Data)
        .map((file) => ({ inlineData: { mimeType: 'application/pdf', data: file.base64Data } }));
      requestParts.push({ text: promptText });
      const result = await callGemini(key, requestParts, false);

      if (result.verdict === 'rejected') {
        setUploadStatus(`❌ Rejected: ${result.reason} (Zero records saved).`);
        return;
      }

      if (result.tagName) {
        await handleAddNewTag(result.tagName);
      }

      const { error } = await supabase.from('curriculum_materials').insert({
        submitted_by: user.id,
        submitter_email: user.email,
        title: result.title || 'Lecture Summary',
        tag_name: result.tagName || '#General',
        content_text: (result.cleanSummary || combinedContent).slice(0, 1600),
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

  const handleStartWeakQuiz = (topics: Array<{ topic: string; tagName: string }>) => {
    const topicList = topics.map((item) => item.topic);
    const primaryTag = topics[0]?.tagName;
    setSelectedTag(primaryTag || '');
    setQuizCustomTitle('Weak Areas Review');
    setQuizQuestionCount(10);
    setQuizCustomCount('');
    setQuizTimerMinutes(15);
    setQuizCustomTimer('');
    setQuizTypes({ mcq: true, text: false, single: true });
    setQuizPrompt(
      `Create a focused review quiz only for these weak topics: ${topicList.join(', ')}. Prioritize concepts with the lowest mastery. Use the approved Supabase study materials for the selected tag and do not introduce unrelated topics.`
    );
    setQuizAttachedFiles([]);
    setGenerationError(null);
    setActiveModal('quiz');
  };

  const handleConsentAccepted = async (realName?: string) => {
    await supabase.from('profiles').update({
      leaderboard_accepted: true,
      real_name: realName || null,
    }).eq('id', user.id);
    user.leaderboardAccepted = true;
    if (realName) user.realName = realName;
    fetchLeaderboardData();
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
        onAnswerStarted={(questionId) => {
          const question = activeQuiz.questions.find((item) => item.id === questionId);
          if (!question || question.type === 'text' || questionResponseTimesRef.current[questionId] !== undefined) return;
          if (quizStartedAtRef.current) {
            questionResponseTimesRef.current[questionId] = Math.max(
              1,
              Math.round((Date.now() - quizStartedAtRef.current) / 1000)
            );
          }
        }}
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
    <div className="w-full max-w-6xl mx-auto space-y-5 sm:space-y-8 animate-fade-in text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/10 pb-4 sm:pb-5">
        <div className="w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <img src="/favicon.svg" alt="revISE Logo" className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 object-contain" />
            <h1 className="text-xl sm:text-2xl font-black text-white leading-none flex flex-wrap items-center">
              <span>rev</span><span className="text-[#3ccb57]">ISE</span>
              <span className="text-slate-500 font-normal mx-1.5 sm:mx-2 text-base sm:text-lg">·</span>
              <span
                onClick={handleShuffleSubtitle}
                title="Click to roll another tagline!"
                className="text-slate-200 font-semibold cursor-pointer hover:text-[#3ccb57] transition-colors select-none text-sm sm:text-base"
              >
                {subtitle}
              </span>
            </h1>
            <span className="inline-flex items-center justify-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#3ccb57]/10 text-[9px] sm:text-[10px] font-mono text-[#3ccb57] uppercase font-bold border border-[#3ccb57]/30 leading-none">
              {currentYear.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            Student: <strong className="text-white truncate inline-block max-w-[180px] sm:max-w-none align-bottom">{user.nickname || user.email}</strong> ·{' '}
            {user.apiKey ? <span className="text-[#3ccb57]">AI Studio Active</span> : <span className="text-amber-400">No Key in Settings</span>}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
          {isAdmin && (
            <button
              onClick={() => {
                loadData();
                setActiveModal('admin');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/40 rounded-xl cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin ({flaggedItems.length})</span>
            </button>
          )}

          {/* 🏆 КНОПКА ЛИДЕРБОРДА */}
          <button
            onClick={() => {
              fetchLeaderboardData();
              setActiveModal('leaderboard');
            }}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-[#3ccb57]/40 text-slate-200 hover:text-white"
          >
            <Trophy className="h-3.5 w-3.5 text-[#3ccb57]" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={() => {
              loadData();
              fetchStudyMaterials().catch(() => undefined);
              setActiveModal('history');
            }}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <History className="h-3.5 w-3.5 text-[#3ccb57]" />
            <span>History &amp; Statistics</span>
          </button>

          <button
            onClick={() => setActiveModal('settings')}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          <button onClick={onSignOut} className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl cursor-pointer">
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* CARD 1: Quiz Test */}
        <div onClick={() => setActiveModal('quiz')} className="group relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#060c20]/85 hover:border-sky-400/50 p-5 sm:p-7 lg:p-9 flex flex-col justify-between min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] cursor-pointer backdrop-blur-xl transition-all duration-300 shadow-2xl hover:shadow-[0_0_40px_rgba(56,189,248,0.2)] hover:-translate-y-1.5">
          <div className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center">
            <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-sky-400 shadow-[0_0_15px_#38bdf8]" />
          </div>

          <div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-xl sm:rounded-2xl bg-sky-400/10 text-sky-400 flex items-center justify-center mb-4 sm:mb-6 border border-sky-400/20 group-hover:scale-110 transition-transform">
              <Brain className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">Quiz Test</h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-300 mt-2 sm:mt-3 leading-relaxed font-normal">
              Dynamic timed tests with single/multiple choice options, deep reasoning, and strict or partial credit.
            </p>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs sm:text-sm lg:text-base text-sky-400 font-bold group-hover:underline">Launch Quiz →</span>
          </div>
        </div>

        {/* CARD 2: Programming Exercises */}
        <div onClick={() => setActiveModal('programming')} className="group relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#060c20]/85 hover:border-[#3ccb57]/50 p-5 sm:p-7 lg:p-9 flex flex-col justify-between min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] cursor-pointer backdrop-blur-xl transition-all duration-300 shadow-2xl hover:shadow-[0_0_40px_rgba(60,203,87,0.2)] hover:-translate-y-1.5">
          <div className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center">
            <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-[#3ccb57] shadow-[0_0_15px_#3ccb57]" />
          </div>

          <div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-xl sm:rounded-2xl bg-[#3ccb57]/10 text-[#3ccb57] flex items-center justify-center mb-4 sm:mb-6 border border-[#3ccb57]/20 group-hover:scale-110 transition-transform">
              <Code2 className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">Programming Exercises</h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-300 mt-2 sm:mt-3 leading-relaxed font-normal">
              Structured Java lab exercises with objectives, requirements, pattern rules, and example outputs.
            </p>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs sm:text-sm lg:text-base text-[#3ccb57] font-bold group-hover:underline">Write Code →</span>
          </div>
        </div>

        {/* CARD 3: Code Analysis */}
        <div onClick={() => setActiveModal('analysis')} className="group relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#060c20]/85 hover:border-orange-400/50 p-5 sm:p-7 lg:p-9 flex flex-col justify-between min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] cursor-pointer backdrop-blur-xl transition-all duration-300 shadow-2xl hover:shadow-[0_0_40px_rgba(251,146,60,0.2)] hover:-translate-y-1.5">
          <div className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center">
            <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-orange-400 shadow-[0_0_15px_#fb923c]" />
          </div>

          <div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-xl sm:rounded-2xl bg-orange-400/10 text-orange-400 flex items-center justify-center mb-4 sm:mb-6 border border-orange-400/20 group-hover:scale-110 transition-transform">
              <Bug className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">Code Analysis</h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-300 mt-2 sm:mt-3 leading-relaxed font-normal">
              Mental execution drills! Convoluted nested loops, variable mutations, and tracing without a compiler.
            </p>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs sm:text-sm lg:text-base text-orange-400 font-bold group-hover:underline">Analyze Code →</span>
          </div>
        </div>
      </div>

      <button onClick={() => setActiveModal('upload')} className="w-full p-4 sm:p-5 rounded-2xl border border-white/10 bg-[#060c20]/80 hover:border-[#3ccb57]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer text-left transition-all">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 text-[#3ccb57] flex items-center justify-center mt-0.5 sm:mt-0"><Upload className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
              <span>Smart Ingestion & Tag Categorization</span>
              <span className="text-[10px] font-mono text-[#3ccb57] bg-[#3ccb57]/10 px-2 py-0.5 rounded-full">AI Moderated</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Submit lecture slides or notes. AI audits quality, creates/links hashtags, and indexes into cloud.</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-4 py-2 bg-[#3ccb57] text-black rounded-xl shrink-0 self-start sm:self-auto text-center w-full sm:w-auto">Add Knowledge</span>
      </button>

      {/* MODALS */}
      <LeaderboardModal
        isOpen={activeModal === 'leaderboard'}
        onClose={() => setActiveModal('none')}
        user={user}
        leaderboardEntries={leaderboardEntries}
        onConsentAccepted={handleConsentAccepted}
        isLoading={isLoadingLeaderboard}
      />

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
        studyMaterials={studyMaterials}
        studyMaterialsError={studyMaterialsError}
        onStartWeakQuiz={handleStartWeakQuiz}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal('none')}
        user={user}
        onProfileUpdated={(updates) => {
          if (updates.nickname) user.nickname = updates.nickname;
          if (updates.realName !== undefined) user.realName = updates.realName;
          if (updates.hideFromLeaderboard !== undefined) user.hideFromLeaderboard = updates.hideFromLeaderboard;
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
import React from 'react';
import { Clock, Loader2, Brain, CheckCircle2, ChevronRight, FileCode, CheckSquare, XCircle } from 'lucide-react';
import type { QuizQuestion, ProgrammingChallenge, CodeAnalysisDrill, QuestionReviewDetail } from '../../types/ise';

/* ==========================================================================
   ACTIVE QUIZ RUNNER
   ========================================================================== */
export const ActiveQuizView: React.FC<{
  activeQuiz: { title: string; questions: QuizQuestion[]; timeLimit: number };
  quizTimeLeft: number;
  userAnswers: Record<number, string[]>;
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  selectedTag: string;
  quizScoringMode: 'partial' | 'strict';
  onAbandon: () => void;
  onSubmit: () => void;
}> = ({ activeQuiz, quizTimeLeft, userAnswers, setUserAnswers, selectedTag, quizScoringMode, onAbandon, onSubmit }) => {
  const minutesLeft = Math.floor(quizTimeLeft / 60);
  const secondsLeft = quizTimeLeft % 60;

  return (
    <div className="w-full max-w-4xl mx-auto h-[82vh] flex flex-col justify-between space-y-3 text-left animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#060c20]/95 border border-white/10 shrink-0 backdrop-blur-xl shadow-lg">
        <div>
          <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase">{selectedTag || '#General'} · {quizScoringMode.toUpperCase()}</span>
          <h2 className="text-lg font-bold text-white tracking-tight">{activeQuiz.title}</h2>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black border border-white/10 font-mono text-sm text-[#3ccb57] shrink-0">
          <Clock className="h-4 w-4" />
          <span>{minutesLeft}:{secondsLeft < 10 ? '0' : ''}{secondsLeft}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
        {activeQuiz.questions.map((q, idx) => {
          const selected = userAnswers[q.id] || [];
          return (
            <div key={q.id} className="p-6 rounded-2xl border border-white/10 bg-[#060c20]/90 space-y-3 shadow-md">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Question {idx + 1} of {activeQuiz.questions.length}</span>
                <span className="text-[#3ccb57] font-semibold">{q.type === 'multiple' ? 'Multiple Choice' : q.type === 'single' ? 'Single Choice' : 'Text Input'}</span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white leading-relaxed">{q.question}</h3>
              {q.codeSnippet && <pre className="p-3.5 rounded-xl bg-black/70 border border-white/10 font-mono text-xs text-[#3ccb57] overflow-x-auto">{q.codeSnippet}</pre>}

              {q.options && q.options.length > 0 && (
                <div className="space-y-2 pt-2">
                  {q.options.map((opt, oIdx) => {
                    const isChecked = selected.includes(opt);
                    return (
                      <div
                        key={oIdx}
                        onClick={() => {
                          const isMulti = q.type === 'multiple';
                          setUserAnswers((prev) => {
                            const cur = prev[q.id] || [];
                            const upd = isMulti ? (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]) : [opt];
                            return { ...prev, [q.id]: upd };
                          });
                        }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm cursor-pointer transition-all ${
                          isChecked ? 'border-[#3ccb57] bg-[#3ccb57]/15 text-white shadow-[0_0_12px_rgba(60,203,87,0.15)]' : 'border-white/10 bg-black/30 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`h-4 w-4 rounded-${q.type === 'multiple' ? 'sm' : 'full'} border flex items-center justify-center text-[10px] ${isChecked ? 'bg-[#3ccb57] text-black font-bold' : 'border-white/20'}`}>✓</span>
                          <span>{opt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === 'text' && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={selected[0] || ''}
                    onChange={(e) => setUserAnswers((prev) => ({ ...prev, [q.id]: [e.target.value] }))}
                    placeholder="Type your answer here..."
                    className="w-full p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center p-3.5 rounded-2xl bg-[#060c20]/95 border border-white/10 shrink-0 shadow-lg">
        <button onClick={onAbandon} className="text-xs text-red-400 hover:text-red-300 px-2 cursor-pointer font-semibold">Abandon Quiz</button>
        <button onClick={onSubmit} className="px-7 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all cursor-pointer shadow-[0_0_15px_rgba(60,203,87,0.3)]">Submit Quiz</button>
      </div>
    </div>
  );
};

/* ==========================================================================
   QUIZ RESULTS VIEW (ИСПРАВЛЕННЫЙ РАЗБОР ВОПРОСОВ БЕЗ БЕЛЫХ/ЧЕРНЫХ ЭКРАНОВ)
   ========================================================================== */
export const QuizResultsView: React.FC<{
  activeQuiz: { title: string } | null;
  quizResults: { score: number; details: QuestionReviewDetail[] };
  onBack: () => void;
}> = ({ activeQuiz, quizResults, onBack }) => (
  <div className="w-full max-w-5xl mx-auto h-[82vh] overflow-y-auto pr-2 space-y-5 text-left animate-fade-in pb-4">
    <div className="p-7 rounded-2xl border border-white/10 bg-[#060c20]/90 flex justify-between items-center shadow-lg">
      <div>
        <span className="text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">
          Quiz Finalized · Recorded to Supabase
        </span>
        <h2 className="text-2xl font-black text-white">{activeQuiz?.title || 'Examination Results'}</h2>
      </div>
      <div className="text-right">
        <span className="text-4xl font-black text-[#3ccb57] font-mono">{quizResults.score}%</span>
        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Final Grade</span>
      </div>
    </div>

    <div className="space-y-4">
      {quizResults.details?.map((item, idx) => (
        <div
          key={idx}
          className={`p-5 rounded-2xl border ${
            item.isCorrect
              ? 'border-[#3ccb57]/40 bg-[#3ccb57]/5'
              : item.points > 0
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-red-500/40 bg-red-950/20'
          } space-y-2.5`}
        >
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-white font-bold flex items-center gap-1.5">
              {item.isCorrect ? (
                <CheckCircle2 className="h-4 w-4 text-[#3ccb57]" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              Question {idx + 1}
            </span>
            <span className={`font-bold px-2.5 py-0.5 rounded-full ${item.points > 0 ? 'bg-[#3ccb57]/20 text-[#3ccb57]' : 'bg-red-500/20 text-red-400'}`}>
              {item.points} / 1.0 pts
            </span>
          </div>

          <p className="text-sm font-medium text-slate-200 leading-relaxed">{item.questionText}</p>

          {item.codeSnippet && (
            <pre className="p-3 rounded-xl bg-black/70 border border-white/10 font-mono text-xs text-[#3ccb57] overflow-x-auto">
              <code>{item.codeSnippet}</code>
            </pre>
          )}

          <div className="text-xs font-mono space-y-1 pt-1">
            <div className="text-slate-400">
              Your Answer:{' '}
              <span className={item.isCorrect ? 'text-[#3ccb57] font-bold' : 'text-red-400 font-bold'}>
                {item.userAnswer && item.userAnswer.length > 0 ? item.userAnswer.join(', ') : 'No answer submitted'}
              </span>
            </div>
            <div className="text-[#3ccb57]">
              Correct Answer: <span className="font-bold">{item.correctAnswers?.join(', ')}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 text-xs text-slate-300 leading-relaxed border border-white/5 mt-2">
            <strong className="text-[#3ccb57]">AI Explanation: </strong>
            {item.explanation}
          </div>
        </div>
      ))}
    </div>

    <div className="text-center pt-2">
      <button
        onClick={onBack}
        className="px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer"
      >
        Return to Learning Station
      </button>
    </div>
  </div>
);

/* ==========================================================================
   PROGRAMMING RUNNER
   ========================================================================== */
export const ActiveProgView: React.FC<{
  activeProg: ProgrammingChallenge;
  progDifficulty: string;
  studentCodeInput: string;
  setStudentCodeInput: (v: string) => void;
  isGenerating: boolean;
  onExit: () => void;
  onSubmit: () => void;
}> = ({ activeProg, progDifficulty, studentCodeInput, setStudentCodeInput, isGenerating, onExit, onSubmit }) => (
  <div className="w-full max-w-6xl mx-auto h-[82vh] overflow-y-auto pr-2 space-y-5 text-left animate-fade-in pb-4">
    <div className="flex justify-between items-center p-4 rounded-2xl bg-[#060c20]/90 border border-white/10">
      <div>
        <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase">{activeProg.language} · {progDifficulty}</span>
        <h2 className="text-xl font-bold text-white">{activeProg.title}</h2>
      </div>
      <button onClick={onExit} className="text-xs text-red-400 hover:underline cursor-pointer font-semibold">Exit Challenge</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <h3 className="text-sm font-bold text-[#3ccb57] uppercase tracking-wider mb-1">Objective</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{activeProg.objective}</p>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Key Requirements</h3>
          <div className="space-y-2 text-xs text-slate-300">
            {activeProg.requirements?.map((req, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 leading-relaxed">
                {req}
              </div>
            ))}
          </div>
        </div>

        {activeProg.patternRules && activeProg.patternRules.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Pattern Rules</h4>
            <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
              {activeProg.patternRules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1.5">Example Output</h3>
          <pre className="p-3.5 rounded-xl bg-black/80 border border-white/10 font-mono text-xs text-[#3ccb57] overflow-x-auto leading-relaxed">
            {activeProg.exampleOutput}
          </pre>
        </div>
      </div>

      <div className="lg:col-span-6 p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase">Write Your Java Solution</span>
            <span className="text-xs text-slate-500 font-mono">{activeProg.language}</span>
          </div>
          <textarea
            rows={18}
            value={studentCodeInput}
            onChange={(e) => setStudentCodeInput(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/80 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-[#3ccb57] leading-relaxed shadow-inner"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(60,203,87,0.3)]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Submit for AI Evaluation</span>}
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ==========================================================================
   PROGRAMMING RESULTS VIEW
   ========================================================================== */
export const ProgResultsView: React.FC<{
  activeProg: ProgrammingChallenge | null;
  progResults: { score: number; feedback: string };
  onBack: () => void;
}> = ({ activeProg, progResults, onBack }) => (
  <div className="w-full max-w-4xl mx-auto h-[82vh] overflow-y-auto pr-2 space-y-5 text-left animate-fade-in pb-4">
    <div className="p-7 rounded-2xl border border-white/10 bg-[#060c20]/90 flex justify-between items-center shadow-lg">
      <div>
        <span className="text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">Evaluation Finalized</span>
        <h2 className="text-2xl font-black text-white">{activeProg?.title}</h2>
      </div>
      <div className="text-right">
        <span className="text-4xl font-black text-[#3ccb57] font-mono">{progResults.score}/100</span>
        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Code Score</span>
      </div>
    </div>
    <div className="p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase">AI Mentor Feedback</h3>
      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{progResults.feedback}</p>
    </div>
    <div className="text-center pt-2">
      <button onClick={onBack} className="px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer">
        Back to Station
      </button>
    </div>
  </div>
);

/* ==========================================================================
   CODE ANALYSIS RUNNER
   ========================================================================== */
export const ActiveAnalysisView: React.FC<{
  activeAnalysis: CodeAnalysisDrill;
  analysisDifficulty: string;
  predictedOutputInput: string;
  setPredictedOutputInput: (v: string) => void;
  scratchpadNotes: string;
  setScratchpadNotes: (v: string) => void;
  isGenerating: boolean;
  onAbandon: () => void;
  onSubmit: () => void;
}> = ({ activeAnalysis, analysisDifficulty, predictedOutputInput, setPredictedOutputInput, scratchpadNotes, setScratchpadNotes, isGenerating, onAbandon, onSubmit }) => (
  <div className="w-full max-w-6xl mx-auto h-[82vh] overflow-y-auto pr-2 space-y-5 text-left animate-fade-in pb-4">
    <div className="flex justify-between items-center p-4 rounded-2xl bg-[#060c20]/90 border border-white/10 backdrop-blur-xl">
      <div>
        <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase tracking-wider block">
          Mental Execution Drill · {analysisDifficulty.toUpperCase()}
        </span>
        <h2 className="text-xl font-bold text-white tracking-tight">{activeAnalysis.title}</h2>
      </div>
      <button onClick={onAbandon} className="text-xs text-red-400 hover:text-red-300 cursor-pointer font-semibold">Abandon Drill</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-[#3ccb57]" /> Trace in your head (No IDE!)
          </span>
          <span className="text-xs font-mono text-[#3ccb57] bg-[#3ccb57]/10 px-2 py-0.5 rounded border border-[#3ccb57]/20">
            {activeAnalysis.language}
          </span>
        </div>
        <pre className="p-4 rounded-xl bg-black/80 border border-white/15 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
          <code>{activeAnalysis.trickyCode}</code>
        </pre>
        <p className="text-[11px] text-slate-400">Step through loops in your head. What exact text will print to stdout?</p>
      </div>

      <div className="lg:col-span-5 p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">
              Predicted Console Output <span className="text-[#3ccb57]">*</span>
            </label>
            <input
              type="text"
              required
              value={predictedOutputInput}
              onChange={(e) => setPredictedOutputInput(e.target.value)}
              placeholder="e.g. 24 or 0 2 6 12"
              className="w-full p-3.5 rounded-xl bg-black/70 border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-[#3ccb57]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Scratchpad / Notes (Optional)</label>
            <textarea
              rows={8}
              value={scratchpadNotes}
              onChange={(e) => setScratchpadNotes(e.target.value)}
              placeholder="Jot down loop variables: i=0 j=1 sum=2..."
              className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-slate-300 focus:outline-none focus:border-[#3ccb57]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isGenerating || !predictedOutputInput.trim()}
          className="w-full py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)]"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <span>Submit Predicted Output</span>}
        </button>
      </div>
    </div>
  </div>
);

/* ==========================================================================
   CODE ANALYSIS RESULTS VIEW
   ========================================================================== */
export const AnalysisResultsView: React.FC<{
  activeAnalysis: CodeAnalysisDrill | null;
  analysisResults: { score: number; feedback: string };
  predictedOutputInput: string;
  onBack: () => void;
}> = ({ activeAnalysis, analysisResults, predictedOutputInput, onBack }) => {
  const isSuccess = analysisResults.score === 100;
  return (
    <div className="w-full max-w-4xl mx-auto h-[82vh] overflow-y-auto pr-2 space-y-5 text-left animate-fade-in pb-4">
      <div className="p-7 rounded-2xl border border-white/10 bg-[#060c20]/90 backdrop-blur-2xl flex justify-between items-center shadow-lg">
        <div>
          <span className="text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">Audit Evaluated</span>
          <h2 className="text-2xl font-black text-white">{activeAnalysis?.title}</h2>
        </div>
        <div className="text-right">
          <span className={`text-4xl font-black font-mono ${isSuccess ? 'text-[#3ccb57]' : 'text-amber-400'}`}>
            {analysisResults.score}/100
          </span>
          <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Execution Score</span>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-white/10 bg-[#060c20]/80 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-black/60 border border-white/10">
            <span className="text-slate-400 block mb-1">Your Mental Prediction:</span>
            <span className={isSuccess ? 'text-[#3ccb57] font-bold text-sm' : 'text-red-400 font-bold text-sm'}>
              {predictedOutputInput || 'No input'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-black/60 border border-[#3ccb57]/30">
            <span className="text-slate-400 block mb-1">Actual Console Output:</span>
            <span className="text-[#3ccb57] font-bold text-sm">{activeAnalysis?.expectedOutput}</span>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
        <h3 className="text-xs font-bold text-[#3ccb57] uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> Step-by-Step Execution Breakdown
        </h3>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{analysisResults.feedback}</p>
      </div>

      <div className="text-center pt-2">
        <button onClick={onBack} className="px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer">
          Return to Station
        </button>
      </div>
    </div>
  );
};
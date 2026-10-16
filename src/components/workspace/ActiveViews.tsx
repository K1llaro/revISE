import React from 'react';
import { Clock, Loader2, Brain, CheckCircle2, ChevronRight, FileCode, CheckSquare, XCircle } from 'lucide-react';
import type { QuizQuestion, ProgrammingChallenge, CodeAnalysisDrill, QuestionReviewDetail, UserSession } from '../../types/ise';
import { UserAvatar } from '../common/UserAvatar';

export type QuizScoringMode = 'partial' | 'strict' | 'negative';

export const scoreQuizQuestion = (question: QuizQuestion, selected: string[], mode: QuizScoringMode) => {
  if (question.type === 'text') {
    const userText = (selected[0] || '').trim().toLowerCase();
    const isCorrect = question.correctAnswers.some((answer) => userText.includes(answer.toLowerCase()));
    return { points: isCorrect ? 1 : 0, isCorrect };
  }

  const correctCount = selected.filter((answer) => question.correctAnswers.includes(answer)).length;
  const wrongCount = selected.filter((answer) => !question.correctAnswers.includes(answer)).length;
  const isCorrect = question.correctAnswers.length > 0
    && correctCount === question.correctAnswers.length
    && wrongCount === 0;
  if (isCorrect) return { points: 1, isCorrect };
  if (mode === 'partial' && correctCount > 0) return { points: 0.5, isCorrect };
  if (mode === 'negative' && question.correctAnswers.length > 0 && selected.length > 0) {
    const options = question.options || [];
    const incorrectDecisions = options.filter((option) =>
      selected.includes(option) !== question.correctAnswers.includes(option)
    ).length;
    return { points: options.length > 0 ? 1 - (2 * incorrectDecisions) / options.length : 0, isCorrect };
  }
  return { points: 0, isCorrect };
};

export const hasMixedQuizAnswer = (type: QuizQuestion['type'] | undefined, selected: string[], correctAnswers: string[]) =>
  type === 'multiple'
  && selected.some((answer) => correctAnswers.includes(answer))
  && selected.some((answer) => !correctAnswers.includes(answer));

/* ==========================================================================
   ACTIVE QUIZ RUNNER
   ========================================================================== */
export const ActiveQuizView: React.FC<{
  activeQuiz: { title: string; questions: QuizQuestion[]; timeLimit: number; immediateFeedback: boolean };
  quizTimeLeft: number;
  userAnswers: Record<number, string[]>;
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  onAnswerStarted: (questionId: number) => void;
  selectedTag: string;
  quizScoringMode: QuizScoringMode;
  submittedQuestionIds: number[];
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  onSubmitAnswer: (questionId: number) => void;
  onAbandon: () => void;
  onSubmit: () => void;
}> = ({ activeQuiz, quizTimeLeft, userAnswers, setUserAnswers, onAnswerStarted, selectedTag, quizScoringMode, submittedQuestionIds, currentQuestionIndex, setCurrentQuestionIndex, onSubmitAnswer, onAbandon, onSubmit }) => {
  const minutesLeft = Math.floor(quizTimeLeft / 60);
  const secondsLeft = quizTimeLeft % 60;
  const currentQuestion = activeQuiz.questions[currentQuestionIndex];
  const isSubmitted = currentQuestion ? submittedQuestionIds.includes(currentQuestion.id) : false;
  const currentAnswer = currentQuestion ? userAnswers[currentQuestion.id] || [] : [];
  const currentScore = currentQuestion ? scoreQuizQuestion(currentQuestion, currentAnswer, quizScoringMode) : null;
  const isLastQuestion = currentQuestionIndex === activeQuiz.questions.length - 1;
  const canFinishImmediate = activeQuiz.immediateFeedback
    && submittedQuestionIds.length === activeQuiz.questions.length;

  return (
    <div className="flex h-full min-h-0 w-full text-left animate-fade-in">
      <nav aria-label="Quiz questions" className="flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/10 bg-[#060c20]/90 py-4 sm:w-20 sm:gap-2.5">
          {activeQuiz.questions.map((question, index) => {
            const selectedAnswer = userAnswers[question.id] || [];
            const answered = activeQuiz.immediateFeedback
              ? submittedQuestionIds.includes(question.id)
              : selectedAnswer.length > 0;
            const score = answered ? scoreQuizQuestion(question, selectedAnswer, quizScoringMode) : null;
            const mixedAnswer = answered && hasMixedQuizAnswer(question.type, selectedAnswer, question.correctAnswers);
            const stateClass = !answered
              ? 'border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/10'
              : mixedAnswer
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
              : (score?.points || 0) > 0
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                : 'border-red-400/40 bg-red-500/20 text-red-300';
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setCurrentQuestionIndex(index)}
                aria-label={`Go to question ${index + 1}${answered ? mixedAnswer ? ', mixed answer' : (score?.points || 0) > 0 ? ', correct' : ', incorrect' : ', unanswered'}`}
                aria-current={currentQuestionIndex === index ? 'step' : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition sm:h-10 sm:w-10 ${stateClass} ${currentQuestionIndex === index ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-[#060c20]' : ''}`}
              >
                {index + 1}
              </button>
            );
          })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#060c20]/95 px-4 py-3 sm:px-7">
          <div className="min-w-0 pr-3">
            <span className="block truncate text-[10px] font-mono font-bold uppercase text-[#3ccb57]">{selectedTag || '#General'} · {quizScoringMode.toUpperCase()}</span>
            <h2 className="truncate text-sm font-bold text-white sm:text-base">{activeQuiz.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black px-3 py-2 font-mono text-sm text-[#3ccb57]">
            <Clock className="h-4 w-4" />
            <span>{minutesLeft}:{secondsLeft < 10 ? '0' : ''}{secondsLeft}</span>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto p-4 sm:p-8">
          {currentQuestion && (
            <article key={currentQuestion.id} className="w-full max-w-4xl space-y-5 rounded-2xl border border-white/10 bg-[#060c20]/90 p-5 shadow-xl sm:space-y-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                <span>Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}</span>
                <span className="text-[#3ccb57] font-semibold">{currentQuestion.type === 'multiple' ? 'Multiple Choice' : currentQuestion.type === 'single' ? 'Single Choice' : 'Text Input'}</span>
              </div>
              <h1 className="text-lg font-semibold leading-relaxed text-white sm:text-2xl">{currentQuestion.question}</h1>
              {currentQuestion.codeSnippet && <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-[#3ccb57] sm:text-sm">{currentQuestion.codeSnippet}</pre>}

              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const selected = currentAnswer.includes(option);
                    const correct = currentQuestion.correctAnswers.includes(option);
                    const revealed = activeQuiz.immediateFeedback && isSubmitted;
                    const revealClass = revealed && correct
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                      : revealed && selected && !correct
                        ? 'border-red-400/60 bg-red-500/15 text-red-100'
                        : selected
                          ? 'border-[#3ccb57] bg-[#3ccb57]/15 text-white'
                          : 'border-white/10 bg-black/30 text-slate-300 hover:bg-white/5';
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => {
                          onAnswerStarted(currentQuestion.id);
                          setUserAnswers((previous) => {
                            const current = previous[currentQuestion.id] || [];
                            const updated = currentQuestion.type === 'multiple'
                              ? current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
                              : [option];
                            return { ...previous, [currentQuestion.id]: updated };
                          });
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition disabled:cursor-default ${revealClass}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-${currentQuestion.type === 'multiple' ? 'sm' : 'full'} border text-[10px] ${selected ? 'border-current' : 'border-white/25'}`}>
                          {revealed && correct ? '✓' : selected ? '✓' : ''}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'text' && (
                <input
                  type="text"
                  value={currentAnswer[0] || ''}
                  disabled={isSubmitted}
                  onChange={(event) => {
                    onAnswerStarted(currentQuestion.id);
                    setUserAnswers((previous) => ({ ...previous, [currentQuestion.id]: [event.target.value] }));
                  }}
                  placeholder="Type your answer here..."
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-4 text-sm text-white focus:border-[#3ccb57] focus:outline-none disabled:opacity-70"
                />
              )}

              {activeQuiz.immediateFeedback && isSubmitted && currentScore && (
                <div className={`rounded-xl border p-4 ${hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'border-amber-400/30 bg-amber-500/[0.08]' : currentScore.points > 0 ? 'border-emerald-400/30 bg-emerald-500/[0.08]' : 'border-red-400/30 bg-red-500/[0.08]'}`}>
                  <p className={`text-sm font-bold ${hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'text-amber-300' : currentScore.points > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'Mixed answers' : currentScore.isCorrect ? 'Correct' : currentScore.points > 0 ? 'Partially correct' : 'Incorrect'}
                  </p>
                  {!currentScore.isCorrect && <p className="mt-2 text-xs leading-5 text-slate-200"><span className="font-semibold">Correct answer:</span> {currentQuestion.correctAnswers.join(', ') || 'See explanation below'}</p>}
                  {currentQuestion.explanation && <p className="mt-2 text-xs leading-6 text-slate-300">{currentQuestion.explanation}</p>}
                  <p className="mt-2 text-[10px] text-slate-500">Score for this question: {currentScore.points.toFixed(2)} / 1</p>
                </div>
              )}
            </article>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#060c20]/95 p-3 sm:px-6 sm:py-4">
          <button type="button" onClick={onAbandon} className="mr-auto px-2 text-xs font-semibold text-red-400 hover:text-red-300">Abandon Quiz</button>
          {currentQuestionIndex > 0 && (
            <button type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]">Back</button>
          )}
          {activeQuiz.immediateFeedback ? (
            isSubmitted ? (
              canFinishImmediate ? (
                <button type="button" onClick={onSubmit} className="rounded-xl bg-[#3ccb57] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67]">Finish Quiz</button>
              ) : (
                <button type="button" onClick={() => setCurrentQuestionIndex((currentQuestionIndex + 1) % activeQuiz.questions.length)} className="rounded-xl bg-[#3ccb57] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67]">
                  {isLastQuestion ? 'Review unanswered' : 'Next Question'}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => currentQuestion && onSubmitAnswer(currentQuestion.id)}
                disabled={!currentQuestion || currentAnswer.length === 0 || submittedQuestionIds.includes(currentQuestion.id)}
                className="rounded-xl bg-[#3ccb57] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit Answer
              </button>
            )
          ) : currentQuestionIndex < activeQuiz.questions.length - 1 ? (
            <button type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} className="rounded-xl bg-[#3ccb57] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67]">Next Question</button>
          ) : (
            <button type="button" onClick={onSubmit} className="rounded-xl bg-[#3ccb57] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67]">Submit Quiz</button>
          )}
        </div>
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
  user?: UserSession;
  onBack: () => void;
}> = ({ activeQuiz, quizResults, user, onBack }) => (
  <div className="w-full max-w-5xl mx-auto max-h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4">
    <div className="p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-white/10 bg-[#060c20]/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
      <div className="flex items-center gap-3.5">
        {user && (
          <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="lg" />
        )}
        <div>
          <span className="text-[10px] sm:text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">
            Quiz Finalized · {user?.nickname ? `${user.nickname}'s Record` : 'Recorded to your account'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{activeQuiz?.title || 'Examination Results'}</h2>
        </div>
      </div>
      <div className="sm:text-right shrink-0">
        <span className="text-3xl sm:text-4xl font-black text-[#3ccb57] font-mono">{quizResults.score}%</span>
        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Final Grade</span>
      </div>
    </div>

    <div className="space-y-3 sm:space-y-4">
      {quizResults.details?.map((item, idx) => (
        <div
          key={idx}
          className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${
            hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers)
              ? 'border-amber-500/40 bg-amber-500/5'
              : item.isCorrect
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
              ) : hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers) ? (
                <XCircle className="h-4 w-4 text-amber-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              Question {idx + 1}
            </span>
            <span className={`font-bold px-2.5 py-0.5 rounded-full ${hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers) ? 'bg-amber-500/20 text-amber-300' : item.points > 0 ? 'bg-[#3ccb57]/20 text-[#3ccb57]' : 'bg-red-500/20 text-red-400'}`}>
              {item.points.toFixed(2)} / 1.0 pts
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">{item.questionText}</p>

          {item.codeSnippet && (
            <pre className="p-3 rounded-xl bg-black/70 border border-white/10 font-mono text-[11px] sm:text-xs text-[#3ccb57] overflow-x-auto">
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
        className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer"
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
  <div className="w-full max-w-6xl mx-auto max-h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4">
    <div className="flex justify-between items-center p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10">
      <div>
        <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase">{activeProg.language} · {progDifficulty}</span>
        <h2 className="text-lg sm:text-xl font-bold text-white">{activeProg.title}</h2>
      </div>
      <button onClick={onExit} className="text-xs text-red-400 hover:underline cursor-pointer font-semibold">Exit Challenge</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      <div className="lg:col-span-6 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-4 lg:max-h-[70vh] lg:overflow-y-auto">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-[#3ccb57] uppercase tracking-wider mb-1">Objective</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{activeProg.objective}</p>
        </div>

        <div>
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider mb-2">Key Requirements</h3>
          <div className="space-y-2 text-xs text-slate-300">
            {activeProg.requirements?.map((req, i) => (
              <div key={i} className="p-2 sm:p-2.5 rounded-xl bg-white/[0.02] border border-white/5 leading-relaxed">
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
          <pre className="p-3 sm:p-3.5 rounded-xl bg-black/80 border border-white/10 font-mono text-xs text-[#3ccb57] overflow-x-auto leading-relaxed">
            {activeProg.exampleOutput}
          </pre>
        </div>
      </div>

      <div className="lg:col-span-6 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase">Write Your Java Solution</span>
            <span className="text-xs text-slate-500 font-mono">{activeProg.language}</span>
          </div>
          <textarea
            rows={12}
            value={studentCodeInput}
            onChange={(e) => setStudentCodeInput(e.target.value)}
            className="w-full p-3 sm:p-4 rounded-xl bg-black/80 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-[#3ccb57] leading-relaxed shadow-inner"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isGenerating}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(60,203,87,0.3)]"
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
  user?: UserSession;
  onBack: () => void;
}> = ({ activeProg, progResults, user, onBack }) => (
  <div className="w-full max-w-4xl mx-auto max-h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4">
    <div className="p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-white/10 bg-[#060c20]/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
      <div className="flex items-center gap-3.5">
        {user && (
          <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="lg" />
        )}
        <div>
          <span className="text-[10px] sm:text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">
            Evaluation Finalized · {user?.nickname ? `${user.nickname}'s Code` : 'ISE Lab'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{activeProg?.title}</h2>
        </div>
      </div>
      <div className="sm:text-right shrink-0">
        <span className="text-3xl sm:text-4xl font-black text-[#3ccb57] font-mono">{progResults.score}/100</span>
        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Code Score</span>
      </div>
    </div>
    <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase">AI Mentor Feedback</h3>
      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{progResults.feedback}</p>
    </div>
    <div className="text-center pt-2">
      <button onClick={onBack} className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer">
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
  <div className="w-full max-w-6xl mx-auto max-h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4">
    <div className="flex justify-between items-center p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 backdrop-blur-xl">
      <div>
        <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase tracking-wider block">
          Mental Execution Drill · {analysisDifficulty.toUpperCase()}
        </span>
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{activeAnalysis.title}</h2>
      </div>
      <button onClick={onAbandon} className="text-xs text-red-400 hover:text-red-300 cursor-pointer font-semibold">Abandon Drill</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      <div className="lg:col-span-7 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-[#3ccb57]" /> Trace in your head (No IDE!)
          </span>
          <span className="text-xs font-mono text-[#3ccb57] bg-[#3ccb57]/10 px-2 py-0.5 rounded border border-[#3ccb57]/20">
            {activeAnalysis.language}
          </span>
        </div>
        <pre className="p-3.5 sm:p-4 rounded-xl bg-black/80 border border-white/15 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
          <code>{activeAnalysis.trickyCode}</code>
        </pre>
        <p className="text-[11px] text-slate-400">Step through loops in your head. What exact text will print to stdout?</p>
      </div>

      <div className="lg:col-span-5 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 flex flex-col justify-between space-y-4">
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
              className="w-full p-3 sm:p-3.5 rounded-xl bg-black/70 border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-[#3ccb57]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Scratchpad / Notes (Optional)</label>
            <textarea
              rows={5}
              value={scratchpadNotes}
              onChange={(e) => setScratchpadNotes(e.target.value)}
              placeholder="Jot down loop variables: i=0 j=1 sum=2..."
              className="w-full p-2.5 sm:p-3 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-slate-300 focus:outline-none focus:border-[#3ccb57]"
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
  user?: UserSession;
  onBack: () => void;
}> = ({ activeAnalysis, analysisResults, predictedOutputInput, user, onBack }) => {
  const isSuccess = analysisResults.score === 100;
  return (
    <div className="w-full max-w-4xl mx-auto max-h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4">
      <div className="p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-white/10 bg-[#060c20]/90 backdrop-blur-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          {user && (
            <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="lg" />
          )}
          <div>
            <span className="text-[10px] sm:text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">
              Audit Evaluated · {user?.nickname ? `${user.nickname}'s Trace` : 'Mental Drill'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">{activeAnalysis?.title}</h2>
          </div>
        </div>
        <div className="sm:text-right shrink-0">
          <span className={`text-3xl sm:text-4xl font-black font-mono ${isSuccess ? 'text-[#3ccb57]' : 'text-amber-400'}`}>
            {analysisResults.score}/100
          </span>
          <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Execution Score</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/10 bg-[#060c20]/80 space-y-3">
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

      <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#060c20]/90 border border-white/10 space-y-3">
        <h3 className="text-xs font-bold text-[#3ccb57] uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> Step-by-Step Execution Breakdown
        </h3>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{analysisResults.feedback}</p>
      </div>

      <div className="text-center pt-2">
        <button onClick={onBack} className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer">
          Return to Station
        </button>
      </div>
    </div>
  );
};
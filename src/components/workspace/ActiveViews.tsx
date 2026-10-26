import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Loader2, Check, CheckCircle2, XCircle, Star, AlertTriangle, Code2, Brain } from 'lucide-react';
import type { QuizQuestion, ProgrammingChallenge, CodeAnalysisDrill, QuestionReviewDetail } from '../../types/ise';

export type QuizScoringMode = 'partial' | 'strict' | 'negative';

export const scoreQuizQuestion = (question: QuizQuestion, selected: string[], mode: QuizScoringMode) => {
  if (question.type === 'text') {
    const userText = (selected[0] || '').trim().toLowerCase();
    const isCorrect = question.correctAnswers.some((answer) => userText.includes(answer.toLowerCase()));
    return { points: isCorrect ? 1 : 0, isCorrect };
  }

  const correctCount = selected.filter((answer) => question.correctAnswers.includes(answer)).length;
  const wrongCount = selected.filter((answer) => !question.correctAnswers.includes(answer)).length;
  const isCorrect = question.correctAnswers.length > 0 && correctCount === question.correctAnswers.length && wrongCount === 0;
  if (isCorrect) return { points: 1, isCorrect };
  if (mode === 'partial' && correctCount > 0) return { points: 0.5, isCorrect };
  if (mode === 'negative' && question.correctAnswers.length > 0 && selected.length > 0) {
    const options = question.options || [];
    const incorrectDecisions = options.filter((opt) => selected.includes(opt) !== question.correctAnswers.includes(opt)).length;
    return { points: options.length > 0 ? 1 - (2 * incorrectDecisions) / options.length : 0, isCorrect };
  }
  return { points: 0, isCorrect };
};

export const hasMixedQuizAnswer = (type: QuizQuestion['type'] | undefined, selected: string[], correctAnswers: string[]) =>
  type === 'multiple' && selected.some((a) => correctAnswers.includes(a)) && selected.some((a) => !correctAnswers.includes(a));

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
  const canFinishImmediate = activeQuiz.immediateFeedback && submittedQuestionIds.length === activeQuiz.questions.length;

  return (
    <div className="flex h-full min-h-0 w-full text-left animate-fade-in bg-[#060c20] relative z-50">
      
      {/* САЙДБАР: ЗЕЛЕНЫЙ ЦВЕТ ДЛЯ ОТВЕЧЕННЫХ */}
      <nav aria-label="Quiz questions" className="flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/10 bg-[#040816] py-4 sm:w-20 sm:gap-2.5">
          {activeQuiz.questions.map((question, index) => {
            const selectedAnswer = userAnswers[question.id] || [];
            const hasAnswered = selectedAnswer.length > 0;
            const isQSubmitted = submittedQuestionIds.includes(question.id);
            
            let stateClass = 'border-white/10 bg-black text-slate-500 hover:bg-white/5'; 
            
            if (activeQuiz.immediateFeedback) {
              if (isQSubmitted) {
                const score = scoreQuizQuestion(question, selectedAnswer, quizScoringMode);
                const mixedAnswer = hasMixedQuizAnswer(question.type, selectedAnswer, question.correctAnswers);
                stateClass = mixedAnswer ? 'border-amber-400/50 bg-amber-500/20 text-amber-200' : score.points > 0 ? 'border-[#3ccb57]/40 bg-[#3ccb57]/20 text-[#3ccb57]' : 'border-red-400/40 bg-red-500/20 text-red-300';
              } else if (hasAnswered) {
                stateClass = 'border-[#3ccb57] bg-[#3ccb57] text-black shadow-[0_0_10px_rgba(60,203,87,0.35)]'; 
              }
            } else {
              if (hasAnswered) {
                stateClass = 'border-[#3ccb57] bg-[#3ccb57] text-black shadow-[0_0_10px_rgba(60,203,87,0.35)]'; 
              }
            }

            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setCurrentQuestionIndex(index)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition sm:h-10 sm:w-10 ${stateClass} ${currentQuestionIndex === index ? 'ring-2 ring-white ring-offset-2 ring-offset-[#040816]' : ''}`}
              >
                {index + 1}
              </button>
            );
          })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col bg-[#060c20]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#040816] px-4 py-3 sm:px-7">
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
            <article key={currentQuestion.id} className="w-full max-w-4xl space-y-5 rounded-3xl border border-white/10 bg-[#040816] p-5 shadow-2xl sm:space-y-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                <span>Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}</span>
                <span className="text-[#3ccb57] font-semibold bg-[#3ccb57]/10 px-2.5 py-1 rounded border border-[#3ccb57]/20">
                  {currentQuestion.type === 'multiple' ? 'Multiple Choice' : currentQuestion.type === 'single' ? 'Single Choice' : 'Text Input'}
                </span>
              </div>
              
              <h1 className="text-lg font-semibold leading-relaxed text-white sm:text-2xl">{currentQuestion.question}</h1>
              {currentQuestion.codeSnippet && <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black p-4 font-mono text-xs text-[#3ccb57] sm:text-sm">{currentQuestion.codeSnippet}</pre>}

              {/* СПИСОК ВАРИАНТОВ С SVG ГАЛОЧКОЙ (БЕЗ ЧЕРНЫХ КВАДРАТОВ) */}
              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const selected = currentAnswer.includes(option);
                    const correct = currentQuestion.correctAnswers.includes(option);
                    const revealed = activeQuiz.immediateFeedback && isSubmitted;
                    
                    const revealClass = revealed && correct
                      ? 'border-[#3ccb57]/60 bg-[#3ccb57]/15 text-[#3ccb57]'
                      : revealed && selected && !correct
                        ? 'border-red-400/60 bg-red-500/15 text-red-300'
                        : selected
                          ? 'border-[#3ccb57] bg-[#3ccb57]/15 text-white shadow-[0_0_10px_rgba(60,203,87,0.2)]'
                          : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/30';

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
                        className={`flex w-full items-center gap-3.5 rounded-xl border p-4 text-left text-sm transition-all disabled:cursor-default ${revealClass}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-${currentQuestion.type === 'multiple' ? 'sm' : 'full'} border transition-all ${
                          selected || (revealed && correct)
                            ? 'border-[#3ccb57] bg-[#3ccb57] text-black shadow-[0_0_8px_rgba(60,203,87,0.4)]'
                            : 'border-white/30 bg-black/40 text-transparent'
                        }`}>
                          <Check className="h-3.5 w-3.5 stroke-[3] text-black" />
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
                  className="w-full rounded-xl border border-white/10 bg-black p-4 text-sm text-white focus:border-[#3ccb57] focus:outline-none disabled:opacity-70"
                />
              )}

              {activeQuiz.immediateFeedback && isSubmitted && currentScore && (
                <div className="pt-4 border-t border-white/10 animate-fade-in space-y-3">
                  <div className={`p-4 rounded-xl border ${hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'border-amber-400/30 bg-amber-500/[0.08]' : currentScore.points > 0 ? 'border-[#3ccb57]/30 bg-[#3ccb57]/[0.08]' : 'border-red-400/30 bg-red-500/[0.08]'}`}>
                    <p className={`text-sm font-bold flex items-center gap-2 ${hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'text-amber-400' : currentScore.points > 0 ? 'text-[#3ccb57]' : 'text-red-400'}`}>
                      {hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? <AlertTriangle className="h-4 w-4"/> : currentScore.points > 0 ? <CheckCircle2 className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}
                      {hasMixedQuizAnswer(currentQuestion.type, currentAnswer, currentQuestion.correctAnswers) ? 'Mixed answers' : currentScore.isCorrect ? 'Correct' : currentScore.points > 0 ? 'Partially correct' : 'Incorrect'}
                      <span className="ml-auto text-xs opacity-70">{currentScore.points.toFixed(2)} / 1 pts</span>
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-black border border-white/5 space-y-2">
                    {currentQuestion.explanation && (
                      <p className="text-xs leading-relaxed text-slate-300">
                        <strong className="text-[#3ccb57] block mb-1">AI Explanation:</strong>
                        {currentQuestion.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#040816] p-4 sm:px-7">
          <button type="button" onClick={onAbandon} className="mr-auto px-2 text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors cursor-pointer">Abandon Quiz</button>
          
          {currentQuestionIndex > 0 && (
            <button type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)} className="rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer">Back</button>
          )}
          
          {activeQuiz.immediateFeedback ? (
            isSubmitted ? (
              canFinishImmediate ? (
                <button type="button" onClick={onSubmit} className="rounded-xl bg-[#3ccb57] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] transition-all shadow-[0_0_15px_rgba(60,203,87,0.3)] cursor-pointer">Finish Quiz</button>
              ) : (
                <button type="button" onClick={() => setCurrentQuestionIndex((currentQuestionIndex + 1) % activeQuiz.questions.length)} className="rounded-xl bg-[#3ccb57] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] transition-all shadow-[0_0_15px_rgba(60,203,87,0.3)] cursor-pointer">
                  {isLastQuestion ? 'Review unanswered' : 'Next Question'}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => currentQuestion && onSubmitAnswer(currentQuestion.id)}
                disabled={!currentQuestion || currentAnswer.length === 0 || submittedQuestionIds.includes(currentQuestion.id)}
                className="rounded-xl bg-[#3ccb57] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] transition-all shadow-[0_0_15px_rgba(60,203,87,0.3)] disabled:opacity-30 disabled:shadow-none cursor-pointer"
              >
                Submit Answer
              </button>
            )
          ) : currentQuestionIndex < activeQuiz.questions.length - 1 ? (
            <button type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} className="rounded-xl bg-[#3ccb57] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] transition-all shadow-[0_0_15px_rgba(60,203,87,0.3)] cursor-pointer">Next Question</button>
          ) : (
            <button type="button" onClick={onSubmit} className="rounded-xl bg-[#3ccb57] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#4ade67] transition-all shadow-[0_0_15px_rgba(60,203,87,0.3)] cursor-pointer">Submit Quiz</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   QUIZ RESULTS VIEW: КАРТОЧКИ ВАРИАНТОВ + ОБЪЯСНЕНИЕ СНИЗУ + RATING PORTAL
   ========================================================================== */
export const QuizResultsView: React.FC<{
  activeQuiz: { title: string } | null;
  quizResults: { score: number; details: any[] };
  onBack: () => void;
}> = ({ activeQuiz, quizResults, onBack }) => {
  const [rating, setRating] = useState<number>(0);
  const [showWarning, setShowWarning] = useState(false);

  const handleRating = (stars: number) => {
    setRating(stars);
    if (stars <= 3) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto min-h-0 flex-1 overflow-y-auto px-2 sm:px-4 text-left animate-fade-in bg-[#060c20] z-50 relative pb-12">
      <div className="p-5 sm:p-7 rounded-3xl border border-white/10 bg-[#040816] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl mt-4">
        <div>
          <span className="text-[10px] sm:text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">
            Quiz Finalized · Recorded to your history
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{activeQuiz?.title || 'Examination Results'}</h2>
        </div>
        <div className="sm:text-right bg-black/40 px-5 py-3 rounded-2xl border border-white/5">
          <span className="text-3xl sm:text-4xl font-black text-[#3ccb57] font-mono">{quizResults.score}%</span>
          <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Final Grade</span>
        </div>
      </div>

      <div className="space-y-5 mt-6">
        {quizResults.details?.map((item, idx) => (
          <div
            key={idx}
            className={`p-5 sm:p-6 rounded-3xl border ${
              hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers)
                ? 'border-amber-500/30 bg-amber-500/5'
                : item.isCorrect
                ? 'border-[#3ccb57]/30 bg-[#3ccb57]/5'
                : item.points > 0
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-red-500/30 bg-red-950/20'
            } space-y-4 shadow-lg`}
          >
            <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-3">
              <span className="text-white font-bold flex items-center gap-2 text-sm">
                {item.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-[#3ccb57]" />
                ) : hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers) ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                Question {idx + 1}
              </span>
              <span className={`font-bold px-3 py-1 rounded-lg ${hasMixedQuizAnswer(item.questionType, item.userAnswer, item.correctAnswers) ? 'bg-amber-500/20 text-amber-300' : item.points > 0 ? 'bg-[#3ccb57]/20 text-[#3ccb57]' : 'bg-red-500/20 text-red-400'}`}>
                {item.points.toFixed(2)} / 1.0 pts
              </span>
            </div>

            <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed">{item.questionText}</p>

            {item.codeSnippet && (
              <pre className="p-4 rounded-xl bg-black border border-white/5 font-mono text-xs text-[#3ccb57] overflow-x-auto">
                <code>{item.codeSnippet}</code>
              </pre>
            )}

            {/* ОТОБРАЖЕНИЕ КАРТОЧЕК ВАРИАНТОВ ОТВЕТА */}
            {item.options && item.options.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {item.options.map((opt: string, optIdx: number) => {
                  const isUserSelected = (item.userAnswer || []).includes(opt);
                  const isCorrect = (item.correctAnswers || []).includes(opt);

                  let cardStyle = 'border-white/10 bg-black/40 text-slate-300';
                  let badgeText = '';
                  let badgeStyle = '';

                  if (isCorrect && isUserSelected) {
                    cardStyle = 'border-[#3ccb57] bg-[#3ccb57]/15 text-white font-medium shadow-[0_0_15px_rgba(60,203,87,0.15)]';
                    badgeText = 'Your correct answer';
                    badgeStyle = 'bg-[#3ccb57] text-black font-bold';
                  } else if (isCorrect && !isUserSelected) {
                    cardStyle = 'border-[#3ccb57]/60 bg-[#3ccb57]/10 text-emerald-200';
                    badgeText = 'Correct answer';
                    badgeStyle = 'border border-[#3ccb57] text-[#3ccb57]';
                  } else if (!isCorrect && isUserSelected) {
                    cardStyle = 'border-red-500/80 bg-red-950/30 text-red-200';
                    badgeText = 'Your wrong answer';
                    badgeStyle = 'bg-red-500 text-white font-bold';
                  }

                  return (
                    <div key={optIdx} className={`flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${cardStyle}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
                          isCorrect ? 'border-[#3ccb57] bg-[#3ccb57] text-black' : isUserSelected ? 'border-red-500 bg-red-500 text-white' : 'border-white/20 text-transparent'
                        }`}>
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                        <span className="leading-relaxed">{opt}</span>
                      </div>
                      {badgeText && (
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ml-3 shrink-0 ${badgeStyle}`}>
                          {badgeText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5 text-xs font-mono">
                <div className="text-slate-400">Your answer: <span className={item.isCorrect ? 'text-[#3ccb57] font-bold' : 'text-red-400 font-bold'}>{item.userAnswer?.join(', ') || 'No answer'}</span></div>
                <div className="text-slate-400">Correct: <span className="text-[#3ccb57] font-bold">{item.correctAnswers?.join(', ')}</span></div>
              </div>
            )}

            {/* ОБЪЯСНЕНИЕ СНИЗУ ПОД ВАРИАНТАМИ */}
            <div className="p-4 rounded-xl bg-[#030714] text-xs text-slate-300 leading-relaxed border border-white/5 shadow-inner mt-4">
              <strong className="text-[#3ccb57] block mb-1 font-mono uppercase tracking-wider text-[11px]">AI Explanation: </strong>
              {item.explanation}
            </div>
          </div>
        ))}
      </div>

      {/* ОЦЕНКА И КНОПКА RETURN */}
      <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center justify-center space-y-5">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-slate-300">Rate the quality of this quiz</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
              >
                <Star className={`h-7 w-7 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onBack}
          className="px-10 py-3.5 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer"
        >
          Return
        </button>
      </div>

      {/* ПОЛНОЭКРАННОЕ ОКНО ПРЕДУПРЕЖДЕНИЯ (PORTAL) */}
      {showWarning && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in text-left">
          <div className="w-full max-w-md bg-[#060c20] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Help Us Improve</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please keep in mind that you should not rate based on emotions or a bad grade. Only evaluate the <strong className="text-white">quality of the test itself</strong> (accuracy, logic, relevance), as this helps the developer improve AI instructions in the future.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full py-3.5 mt-2 rounded-xl font-bold text-xs bg-amber-500 text-black hover:bg-amber-400 transition-all cursor-pointer"
            >
              Ok, I understand
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

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
  <div className="w-full max-w-6xl mx-auto h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4 relative z-50 bg-[#060c20]">
    <div className="flex justify-between items-center p-4 sm:p-5 rounded-3xl bg-[#040816] border border-white/10 shadow-lg">
      <div>
        <span className="text-[10px] font-mono text-[#3ccb57] font-bold uppercase">{activeProg.language} · {progDifficulty}</span>
        <h2 className="text-lg sm:text-xl font-bold text-white">{activeProg.title}</h2>
      </div>
      <button onClick={onExit} className="text-xs text-slate-500 hover:text-red-400 cursor-pointer font-semibold transition-colors">Exit Challenge</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-[#040816] border border-white/10 space-y-5 shadow-lg lg:max-h-[70vh] lg:overflow-y-auto scrollbar-thin">
        <div>
          <h3 className="text-xs font-bold text-[#3ccb57] uppercase tracking-wider mb-2">Objective</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{activeProg.objective}</p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Key Requirements</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {activeProg.requirements?.map((req, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 leading-relaxed">
                {req}
              </div>
            ))}
          </div>
        </div>

        {activeProg.patternRules && activeProg.patternRules.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Pattern Rules</h4>
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1.5">
              {activeProg.patternRules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Example Output</h3>
          <pre className="p-4 rounded-xl bg-black border border-white/5 font-mono text-xs text-[#3ccb57] overflow-x-auto leading-relaxed shadow-inner">
            {activeProg.exampleOutput}
          </pre>
        </div>
      </div>

      <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-[#040816] border border-white/10 flex flex-col justify-between space-y-4 shadow-lg">
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase">Write Your Java Solution</span>
            <span className="text-xs font-mono text-black bg-[#3ccb57] px-2 py-0.5 rounded font-bold">{activeProg.language}</span>
          </div>
          <textarea
            value={studentCodeInput}
            onChange={(e) => setStudentCodeInput(e.target.value)}
            className="w-full flex-1 min-h-[300px] p-4 rounded-xl bg-black border border-white/10 font-mono text-sm text-slate-200 focus:outline-none focus:border-[#3ccb57] leading-relaxed shadow-inner resize-none scrollbar-thin"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isGenerating}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <span>Submit Code for AI Evaluation</span>
            )}
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
  <div className="w-full max-w-4xl mx-auto h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-10 relative z-50 bg-[#060c20]">
    <div className="p-5 sm:p-7 rounded-3xl border border-white/10 bg-[#040816] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
      <div>
        <span className="text-[10px] sm:text-xs font-mono text-[#3ccb57] uppercase font-bold block mb-1">Evaluation Finalized</span>
        <h2 className="text-xl sm:text-2xl font-black text-white">{activeProg?.title}</h2>
      </div>
      <div className="sm:text-right bg-black/40 px-5 py-3 rounded-2xl border border-white/5">
        <span className="text-3xl sm:text-4xl font-black text-[#3ccb57] font-mono">{progResults.score}/100</span>
        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Code Score</span>
      </div>
    </div>
    
    <div className="p-5 sm:p-7 rounded-3xl bg-[#040816] border border-white/10 space-y-4 shadow-lg">
      <h3 className="text-xs font-bold text-[#3ccb57] uppercase tracking-wider flex items-center gap-2">
        <Code2 className="h-4 w-4" /> AI Mentor Feedback & Grading Breakdown
      </h3>
      <div className="p-4 rounded-xl bg-black border border-white/5">
        <p className="text-sm text-slate-200 leading-loose whitespace-pre-wrap font-mono">{progResults.feedback}</p>
      </div>
    </div>
    
    <div className="mt-8 pt-4 flex justify-center">
      <button onClick={onBack} className="px-10 py-3.5 rounded-xl font-black text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] cursor-pointer">
        Return
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
  <div className="w-full max-w-6xl mx-auto h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-4 relative z-50 bg-[#060c20]">
    <div className="flex justify-between items-center p-4 sm:p-5 rounded-3xl bg-[#040816] border border-white/10 shadow-lg">
      <div>
        <span className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-wider block">
          Mental Execution Drill · {analysisDifficulty.toUpperCase()}
        </span>
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{activeAnalysis.title}</h2>
      </div>
      <button onClick={onAbandon} className="text-xs text-slate-500 hover:text-red-400 cursor-pointer font-semibold transition-colors">Abandon Drill</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-[#040816] border border-white/10 space-y-4 shadow-lg">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-orange-400" /> Trace in your head (No IDE!)
          </span>
          <span className="text-xs font-mono text-black font-bold bg-orange-400 px-2 py-0.5 rounded">
            {activeAnalysis.language}
          </span>
        </div>
        <pre className="p-4 sm:p-5 rounded-xl bg-black border border-white/5 text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
          <code>{activeAnalysis.trickyCode}</code>
        </pre>
        <p className="text-xs text-slate-500 bg-white/[0.02] p-3 rounded-lg border border-white/5">Step through loops in your head. What exact text will print to the console? Pay attention to newlines and spaces.</p>
      </div>

      <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-[#040816] border border-white/10 flex flex-col justify-between space-y-5 shadow-lg">
        <div className="space-y-5 flex-1">
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Predicted Console Output <span className="text-orange-400">*</span>
            </label>
            <input
              type="text"
              required
              value={predictedOutputInput}
              onChange={(e) => setPredictedOutputInput(e.target.value)}
              placeholder="e.g. 24 or 0 2 6 12"
              className="w-full p-4 rounded-xl bg-black border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-orange-400 shadow-inner"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-xs font-semibold text-slate-400 mb-2">Scratchpad / Mental Notes (Optional)</label>
            <textarea
              value={scratchpadNotes}
              onChange={(e) => setScratchpadNotes(e.target.value)}
              placeholder="Jot down loop variables: i=0 j=1 sum=2..."
              className="w-full flex-1 min-h-[150px] p-3.5 rounded-xl bg-black/50 border border-white/5 text-xs font-mono text-slate-300 focus:outline-none focus:border-orange-400/50 resize-none scrollbar-thin shadow-inner"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isGenerating || !predictedOutputInput.trim()}
          className="w-full py-3.5 rounded-xl font-black text-xs bg-orange-500 text-black hover:bg-orange-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(249,115,22,0.3)]"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-black" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Submit Predicted Output</span>
          )}
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
    <div className="w-full max-w-5xl mx-auto h-full sm:h-[82vh] overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-left animate-fade-in pb-10 relative z-50 bg-[#060c20]">
      <div className="p-5 sm:p-7 rounded-3xl border border-white/10 bg-[#040816] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] sm:text-xs font-mono text-orange-400 uppercase font-bold block mb-1">Audit Evaluated</span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{activeAnalysis?.title}</h2>
        </div>
        <div className="sm:text-right bg-black/40 px-5 py-3 rounded-2xl border border-white/5">
          <span className={`text-3xl sm:text-4xl font-black font-mono ${isSuccess ? 'text-[#3ccb57]' : 'text-amber-400'}`}>
            {analysisResults.score}/100
          </span>
          <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Execution Score</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 rounded-3xl border border-white/10 bg-[#040816] space-y-4 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-mono">
          <div className="p-4 rounded-xl bg-black border border-white/5 shadow-inner">
            <span className="text-xs text-slate-500 block mb-2 font-sans font-semibold">Your Mental Prediction:</span>
            <span className={isSuccess ? 'text-[#3ccb57] font-bold text-base' : 'text-red-400 font-bold text-base'}>
              {predictedOutputInput || 'No input'}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-black border border-orange-400/20 shadow-inner">
            <span className="text-xs text-slate-500 block mb-2 font-sans font-semibold">Actual Console Output:</span>
            <span className="text-orange-400 font-bold text-base">{activeAnalysis?.expectedOutput}</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7 rounded-3xl bg-[#040816] border border-white/10 space-y-4 shadow-lg">
        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Step-by-Step Execution Breakdown
        </h3>
        <div className="p-4 rounded-xl bg-black border border-white/5">
          <p className="text-sm text-slate-200 leading-loose font-mono whitespace-pre-wrap">{analysisResults.feedback}</p>
        </div>
      </div>

      <div className="mt-8 pt-4 flex justify-center">
        <button onClick={onBack} className="px-10 py-3.5 rounded-xl font-black text-xs bg-orange-500 text-black hover:bg-orange-400 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] cursor-pointer">
          Return
        </button>
      </div>
    </div>
  );
};
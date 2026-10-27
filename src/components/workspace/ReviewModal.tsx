import React, { useState } from 'react';
import { ArrowLeft, X, Send, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import type { UserSession } from '../../types/ise';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSession;
}

interface ReviewCategory {
  id: string;
  badge: string;
  title: string;
  description: string;
  hint: string;
}

const REVIEW_CATEGORIES: ReviewCategory[] = [
  {
    id: 'interface',
    badge: 'UI & Design',
    title: 'User Interface & Aesthetics',
    description: 'Rate the visual appearance, typography, layout clarity, and overall dark-mode design of revISE.',
    hint: '0 = Clunky and hard to navigate, 10 = Sleek, intuitive, and visually polished',
  },
  {
    id: 'functionality',
    badge: 'Features & Tools',
    title: 'Platform Features & Learning Modes',
    description: 'Rate the variety and usefulness of study modes (Quizzes, Code Challenges, Code Tracing drills, and Learn Notes).',
    hint: '0 = Lacks features or buggy, 10 = Comprehensive, versatile, and runs reliably',
  },
  {
    id: 'ai_performance',
    badge: 'AI Intelligence',
    title: 'AI Accuracy & Feedback Quality',
    description: 'Rate the quality of AI-generated questions, feedback depth, code verifications, and explanations.',
    hint: '0 = Frequent hallucinations or inaccuracies, 10 = Highly accurate and academically insightful',
  },
  {
    id: 'general_systems',
    badge: 'Systems & Stability',
    title: 'Core Systems, Leaderboard & Reliability',
    description: 'Rate the stability of authentication, Leaderboard tracking, Test History, and page responsiveness.',
    hint: '0 = Unreliable or slow, 10 = Fast, seamless, and preserves your study progress',
  },
  {
    id: 'usability',
    badge: 'Usability & Real Value',
    title: 'Overall Usefulness for ISE Coursework',
    description: 'How effectively does revISE assist you in mastering syllabus topics and preparing for assignments?',
    hint: '0 = Not helpful for studies, 10 = Indispensable learning companion for ISE',
  },
];

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, user }) => {
  // Steps: 0..4 (the 5 categories), 5 (written feedback), 6 (success screen)
  const [currentStep, setCurrentStep] = useState(0);
  const [ratings, setRatings] = useState<(number | null)[]>([null, null, null, null, null]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSelectRating = (score: number) => {
    setRatings((prev) => {
      const next = [...prev];
      next[currentStep] = score;
      return next;
    });
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (isSuccess) {
      handleClose();
      return;
    }
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setRatings([null, null, null, null, null]);
    setComment('');
    setSubmitError(null);
    setIsSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const validRatings = ratings.map((r) => (r === null ? 0 : r));
    const avgScore = (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1);

    const payload = {
      _subject: `⭐ revISE Review from ${user.nickname || user.email || 'Student'} (Avg: ${avgScore}/10)`,
      student_nickname: user.nickname || 'Unknown Student',
      student_email: user.email || 'Not provided',
      student_year: user.studyYear || 'year1',
      score_interface: `${validRatings[0]} / 10`,
      score_functionality: `${validRatings[1]} / 10`,
      score_ai_performance: `${validRatings[2]} / 10`,
      score_general_systems: `${validRatings[3]} / 10`,
      score_usability_value: `${validRatings[4]} / 10`,
      average_rating: `${avgScore} / 10`,
      user_feedback_comment: comment.trim() || 'No additional comment provided',
      submitted_at: new Date().toISOString(),
    };

    try {
      // Send directly to revise.ul@gmail.com via FormSubmit AJAX endpoint
      const response = await fetch('https://formsubmit.co/ajax/revise.ul@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email (status ${response.status}).`);
      }

      setIsSuccess(true);
    } catch (err) {
      console.error('Error submitting review:', err);
      setSubmitError(
        'Could not submit your review automatically. You can also send feedback directly to revise.ul@gmail.com.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSteps = REVIEW_CATEGORIES.length; // 5 evaluation steps + 1 final comment step
  const currentCategory = currentStep < totalSteps ? REVIEW_CATEGORIES[currentStep] : null;
  const currentRating = currentStep < totalSteps ? ratings[currentStep] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#060c20]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Glow decoration */}
        <div
          className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] pointer-events-none opacity-20"
          style={{ background: '#3ccb57' }}
        />

        {/* Header: Back arrow, Title/Progress, Close button */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{currentStep === 0 || isSuccess ? 'Exit' : 'Back'}</span>
          </button>

          {!isSuccess && (
            <div className="text-center">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#3ccb57]">
                Step {currentStep + 1} of {totalSteps + 1}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SUCCESS SCREEN */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3ccb57]/20 border border-[#3ccb57]/40 text-[#3ccb57] shadow-[0_0_30px_rgba(60,203,87,0.3)]">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="text-xl font-black text-white">Thank you for your feedback!</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Your ratings and feedback have been successfully sent to{' '}
              <span className="text-[#3ccb57] font-mono font-semibold">revise.ul@gmail.com</span>. Your insights help us
              continually enhance revISE for all ISE students!
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl bg-[#3ccb57] text-black text-xs font-bold hover:bg-[#4ade67] transition-all cursor-pointer shadow-lg shadow-[#3ccb57]/20"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : currentStep < totalSteps && currentCategory ? (
          /* STEPS 0 to 4: Rating categories */
          <div className="space-y-6 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3ccb57]/10 border border-[#3ccb57]/30 text-[10px] font-mono text-[#3ccb57] mb-2 font-bold uppercase">
                {currentCategory.badge}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">{currentCategory.title}</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{currentCategory.description}</p>
              <p className="text-[11px] text-slate-500 mt-1 italic">{currentCategory.hint}</p>
            </div>

            {/* 0 to 10 rating picker */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-2 px-1">
                <span>0 — Poor</span>
                <span>5 — Average</span>
                <span>10 — Excellent</span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 sm:gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                  const isSelected = currentRating === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => handleSelectRating(score)}
                      className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all duration-150 cursor-pointer flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[#3ccb57] text-black border-[#3ccb57] shadow-[0_0_15px_rgba(60,203,87,0.4)] scale-105'
                          : 'bg-white/[0.04] text-slate-200 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next button appears only after selection */}
            <div className="min-h-12 flex justify-end items-center pt-2">
              {currentRating !== null && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="animate-fade-in inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3ccb57] hover:bg-[#4ade67] text-black text-xs font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(60,203,87,0.25)] cursor-pointer"
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* STEP 5: Final Written Description */
          <div className="space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3ccb57]/10 border border-[#3ccb57]/30 text-[10px] font-mono text-[#3ccb57] mb-2 font-bold uppercase">
                <Sparkles className="h-3 w-3" /> Final Step
              </div>
              <h3 className="text-lg font-bold text-white">Why did you rate it this way?</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Share what you loved, any friction or bugs you encountered, and ideas for improvement.
              </p>
            </div>

            {/* Summary preview of ratings */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px]">
              {REVIEW_CATEGORIES.map((cat, idx) => (
                <div key={cat.id} className="flex items-center justify-between p-1.5 rounded-lg bg-black/40">
                  <span className="text-slate-400 truncate pr-1">{cat.badge}:</span>
                  <span className="font-mono font-bold text-[#3ccb57]">{ratings[idx] ?? '-'}/10</span>
                </div>
              ))}
            </div>

            {/* Detailed textarea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Your Feedback & Comments
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us what worked great, what felt clunky or difficult, and what new features would help you study best..."
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3ccb57] transition-all resize-none leading-relaxed"
              />
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                ← Edit Ratings
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3ccb57] hover:bg-[#4ade67] text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(60,203,87,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Review</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

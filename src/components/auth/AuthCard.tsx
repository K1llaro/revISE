import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AuthMode, StudyYear, UserSession } from '../../types/ise';
import { ApiKeyTooltip } from '../common/LayoutComponents';

export const AuthCard: React.FC<{ onSuccessAuth: (u: UserSession) => void }> = ({ onSuccessAuth }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [studyYear, setStudyYear] = useState<StudyYear>('year1');
  const [password, setPassword] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname, study_year: studyYear },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        },
      });

      setIsSubmitting(false);
      if (error) return setStatusMessage({ type: 'error', text: error.message });

      if (geminiApiKey.trim()) localStorage.setItem('gemini_api_key', geminiApiKey.trim());

      if (data.user && !data.session) {
        setIsAwaitingConfirmation(true);
      } else if (data.session) {
        onSuccessAuth({ id: data.user!.id, email, nickname, studyYear, apiKey: geminiApiKey.trim() });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setIsSubmitting(false);
      if (error) {
        return setStatusMessage({
          type: 'error',
          text: error.message.toLowerCase().includes('email not confirmed')
            ? 'Account not activated! Please click the confirmation link sent to your email.'
            : error.message,
        });
      }

      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('nickname, study_year').eq('id', data.user.id).single();
        const localKey = localStorage.getItem('gemini_api_key') || undefined;
        onSuccessAuth({
          id: data.user.id,
          email: data.user.email || email,
          nickname: prof?.nickname,
          studyYear: (prof?.study_year as StudyYear) || 'year1',
          apiKey: localKey,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto p-7 rounded-2xl border border-white/10 bg-[#060c20]/90 backdrop-blur-2xl shadow-2xl text-left">
      {isAwaitingConfirmation ? (
        <div className="text-center py-4 space-y-4">
          <Mail className="h-12 w-12 text-[#3ccb57] mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-white">Check Your Email</h3>
          <p className="text-xs text-slate-300">We've sent an activation link to <strong className="text-white">{email}</strong>. Confirm it to activate your account.</p>
          <button onClick={() => { setIsAwaitingConfirmation(false); setMode('signin'); }} className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black cursor-pointer">Back to Sign In</button>
        </div>
      ) : (
        <>
          <div className="flex justify-between border-b border-white/10 pb-3 mb-5">
            <div className="p-1 rounded-xl bg-black/40 text-xs font-semibold">
              <button onClick={() => setMode('signin')} className={`px-4 py-1.5 rounded-lg ${mode === 'signin' ? 'bg-[#3ccb57] text-black' : 'text-slate-400'}`}>Sign In</button>
              <button onClick={() => setMode('signup')} className={`px-4 py-1.5 rounded-lg ${mode === 'signup' ? 'bg-[#3ccb57] text-black' : 'text-slate-400'}`}>Sign Up</button>
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-white">rev<span className="text-[#3ccb57]">ISE</span></h1>
            <p className="text-xs text-slate-400 mt-1">Immersive Software Engineering AI Station</p>
          </div>

          {statusMessage && (
            <div className={`p-3 rounded-lg text-xs mb-4 ${statusMessage.type === 'success' ? 'bg-[#3ccb57]/10 text-[#3ccb57]' : 'bg-red-950/40 text-red-200'}`}>
              {statusMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nickname</label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Kiril_Dev"
                    className="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Study Year</label>
                  <select
                    value={studyYear}
                    onChange={(e) => setStudyYear(e.target.value as StudyYear)}
                    className="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-[#3ccb57] font-semibold focus:outline-none focus:border-[#3ccb57]"
                  >
                    <option value="year1">Year 1 (Freshmen 2026 - Java, DevOps, Cloud)</option>
                    <option value="year2">Year 2 (Sophomores - Systems, Databases)</option>
                    <option value="year3">Year 3 (Residency & Enterprise Systems)</option>
                    <option value="year4">Year 4 (Senior Capstone & Architecture)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@studentmail.ul.ie"
                className="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 pr-10 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300">Google AI Studio Key</label>
                  <ApiKeyTooltip />
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    required
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full p-2.5 pr-10 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#3ccb57]"
                  />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-2.5 text-slate-400">
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#3ccb57] text-black cursor-pointer">
              {isSubmitting ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};
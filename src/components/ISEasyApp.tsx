import React, { useState, useEffect } from 'react';
import { Sparkles, KeyRound, Loader2, Rocket, EyeOff, Eye, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserSession, StudyYear } from '../types/ise';
import { Navbar, Footer, BackgroundGradients, ApiKeyTooltip } from './common/LayoutComponents';
import { AuthCard } from './auth/AuthCard';
import { AuthenticatedWorkspace } from './workspace/AuthenticatedWorkspace';

export default function ISEasyApp() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [onboardingNickname, setOnboardingNickname] = useState('');
  const [onboardingYear, setOnboardingYear] = useState<StudyYear>('year1');
  const [onboardingPassword, setOnboardingPassword] = useState('');
  const [onboardingConfirmPassword, setOnboardingConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [onboardingApiKey, setOnboardingApiKey] = useState('');
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);

  // 🛡️ Проверка реального верифицированного email в GitHub
  const verifyRealStudentEmail = async (session: any): Promise<string | null> => {
    const adminEmail = 'dinosaurkiril@gmail.com';
    const ulStudentRegex = /^\d+@studentmail\.ul\.ie$/i;

    if (session.user.email?.toLowerCase() === adminEmail) {
      return adminEmail;
    }

    if (session.provider_token) {
      try {
        const response = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${session.provider_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (response.ok) {
          const emails: Array<{ email: string; verified: boolean; primary: boolean }> = await response.json();
          const validStudentEntry = emails.find(
            (entry) => entry.verified === true && ulStudentRegex.test(entry.email.trim())
          );

          if (validStudentEntry) {
            return validStudentEntry.email.trim().toLowerCase();
          }
        }
      } catch (err) {
        console.error('Failed to query GitHub verified emails API:', err);
      }
    }

    if (session.user.email && ulStudentRegex.test(session.user.email.trim())) {
      return session.user.email.trim().toLowerCase();
    }

    return null;
  };

  useEffect(() => {
    const validateAndSetSession = async (session: any) => {
      if (!session?.user) {
        setCurrentUser(null);
        setShowOnboarding(false);
        return;
      }

      const verifiedStudentEmail = await verifyRealStudentEmail(session);

      if (!verifiedStudentEmail) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setShowOnboarding(false);
        setSecurityError(
          'Access Denied: Your GitHub account does not have a verified University of Limerick student email (e.g. 23123456@studentmail.ul.ie). A public display email is not enough — please add and verify your student address in GitHub Settings ➡ Emails.'
        );
        return;
      }

      setSecurityError(null);

      // 🌟 ПОЛНАЯ ВЫГРУЗКА ПРОФИЛЯ (с флагом согласия лидерборда и реальным именем)
      const { data: prof } = await supabase
        .from('profiles')
        .select('nickname, study_year, real_name, leaderboard_accepted, hide_from_leaderboard')
        .eq('id', session.user.id)
        .single();

      const localKey = localStorage.getItem('gemini_api_key');

      const isFirstTimeUser = !prof?.nickname;

      if (isFirstTimeUser) {
        setPendingSession({
          session,
          email: verifiedStudentEmail,
        });
        setOnboardingNickname(
          session.user.user_metadata?.user_name ||
          session.user.user_metadata?.nickname ||
          session.user.user_metadata?.name ||
          ''
        );
        setOnboardingYear((prof?.study_year as StudyYear) || 'year1');
        setOnboardingApiKey(localKey || '');
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
        setCurrentUser({
          id: session.user.id,
          email: verifiedStudentEmail,
          nickname: prof.nickname,
          realName: prof.real_name || undefined,
          studyYear: (prof.study_year as StudyYear) || 'year1',
          leaderboardAccepted: prof.leaderboard_accepted || false,
          hideFromLeaderboard: prof.hide_from_leaderboard || false,
          apiKey: localKey || undefined,
        });
      }

      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await validateAndSetSession(session);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await validateAndSetSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingError(null);

    if (onboardingPassword.length < 6) {
      setOnboardingError('Password must be at least 6 characters long.');
      return;
    }

    if (onboardingPassword !== onboardingConfirmPassword) {
      setOnboardingError('Passwords do not match.');
      return;
    }

    setIsSavingOnboarding(true);

    const { error: pwdError } = await supabase.auth.updateUser({
      password: onboardingPassword,
    });

    if (pwdError) {
      setIsSavingOnboarding(false);
      setOnboardingError('Failed to set password: ' + pwdError.message);
      return;
    }

    const cleanNick = onboardingNickname.trim() || 'Student';
    const cleanKey = onboardingApiKey.trim();

    await supabase.from('profiles').upsert({
      id: pendingSession.session.user.id,
      email: pendingSession.email,
      nickname: cleanNick,
      study_year: onboardingYear,
    });

    if (cleanKey) {
      localStorage.setItem('gemini_api_key', cleanKey);
    }

    setIsSavingOnboarding(false);
    setShowOnboarding(false);

    setCurrentUser({
      id: pendingSession.session.user.id,
      email: pendingSession.email,
      nickname: cleanNick,
      studyYear: onboardingYear,
      leaderboardAccepted: false,
      hideFromLeaderboard: false,
      apiKey: cleanKey || undefined,
    });
  };

  const handleCancelOnboarding = async () => {
    await supabase.auth.signOut();
    setShowOnboarding(false);
    setCurrentUser(null);
    setPendingSession(null);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden text-slate-100 selection:bg-[#3ccb57]/30 selection:text-white flex flex-col justify-between">
      <BackgroundGradients />

      <div className="relative z-10 flex flex-col h-full w-full justify-between overflow-hidden">
        <Navbar />

        <main className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-4 sm:px-8 py-2 overflow-hidden">
          {currentUser ? (
            <AuthenticatedWorkspace
              user={currentUser}
              onSignOut={async () => {
                await supabase.auth.signOut();
                setCurrentUser(null);
              }}
              onApiKeyUpdated={(k) => setCurrentUser((prev) => (prev ? { ...prev, apiKey: k } : null))}
            />
          ) : (
            <AuthCard
              onSuccessAuth={(u) => setCurrentUser(u)}
              securityError={securityError}
            />
          )}
        </main>

        <Footer />
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in text-left">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#060c20]/95 backdrop-blur-2xl p-7 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#3ccb57] uppercase tracking-wider block mb-1">
                  First Time Setup
                </span>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#3ccb57]" />
                  <span>Welcome to rev<span className="text-[#3ccb57]">ISE</span></span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your student profile and credentials to calibrate AI drills.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelOnboarding}
                title="Sign out and return to login"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {onboardingError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{onboardingError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteOnboarding} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nickname</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={onboardingNickname}
                  onChange={(e) => setOnboardingNickname(e.target.value)}
                  placeholder="e.g. Kiril_Dev"
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Study Year</label>
                <select
                  value={onboardingYear}
                  onChange={(e) => setOnboardingYear(e.target.value as StudyYear)}
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-[#3ccb57] font-semibold focus:outline-none focus:border-[#3ccb57]"
                >
                  <option value="year1">Year 1 (Freshmen 2026 - Java, DevOps, Cloud)</option>
                  <option value="year2">Year 2 (Sophomores - Systems, Databases)</option>
                  <option value="year3">Year 3 (Residency & Enterprise Systems)</option>
                  <option value="year4">Year 4 (Senior Capstone & Architecture)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={onboardingPassword}
                      onChange={(e) => setOnboardingPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-8 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={onboardingConfirmPassword}
                    onChange={(e) => setOnboardingConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#3ccb57]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-[#3ccb57]" /> Google AI Studio Key
                  </label>
                  <ApiKeyTooltip />
                </div>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={onboardingApiKey}
                  onChange={(e) => setOnboardingApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#3ccb57]"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Stored securely in your local browser vault.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingOnboarding || !onboardingNickname.trim()}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-[#3ccb57] text-black hover:bg-[#4ade67] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(60,203,87,0.3)] disabled:opacity-50"
                >
                  {isSavingOnboarding ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : (
                    <>
                      <span>Launch revISE Station</span>
                      <Rocket className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
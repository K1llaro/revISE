import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, KeyRound, Loader2, Rocket, EyeOff, Eye, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserSession, StudyYear } from '../types/ise';
import { Navbar, BackgroundGradients, ApiKeyTooltip } from './common/LayoutComponents';
import { AuthCard } from './auth/AuthCard';
import { AuthenticatedWorkspace } from './workspace/AuthenticatedWorkspace';

export type VisualTheme = 'standard' | 'glass' | 'dark_glass';

export default function ISEasyApp() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const currentUserRef = useRef<UserSession | null>(null);
  currentUserRef.current = currentUser;

  const [securityError, setSecurityError] = useState<string | null>(null);

  // 3 визуальных режима: standard (оригинал), glass (платиновое стекло), dark_glass (тёмный обсидиан)
  const [uiTheme, setUiTheme] = useState<VisualTheme>('standard');

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

  useEffect(() => {
    const saved = localStorage.getItem('revise_visual_theme') as VisualTheme;
    if (saved === 'glass' || saved === 'dark_glass' || saved === 'standard') {
      setUiTheme(saved);
    }
  }, []);

  const handleThemeToggle = (theme: VisualTheme) => {
    setUiTheme(theme);
    localStorage.setItem('revise_visual_theme', theme);
  };

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

      // 🛑 Защита: не трогаем интерфейс при фоновом обновлении токена
      if (currentUserRef.current && currentUserRef.current.id === session.user.id) {
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

      let prof: any = null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nickname, study_year, real_name, leaderboard_accepted, hide_from_leaderboard, disable_vortex, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          const { data: safeData } = await supabase
            .from('profiles')
            .select('nickname, study_year, real_name, leaderboard_accepted, hide_from_leaderboard, disable_vortex')
            .eq('id', session.user.id)
            .single();
          prof = safeData;
        } else {
          prof = data;
        }
      } catch (err) {
        console.error('[revISE Auth] Error fetching profile:', err);
      }

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
          nickname: prof?.nickname,
          realName: prof?.real_name || undefined,
          studyYear: (prof?.study_year as StudyYear) || 'year1',
          leaderboardAccepted: prof?.leaderboard_accepted || false,
          hideFromLeaderboard: prof?.hide_from_leaderboard || false,
          apiKey: localKey || undefined,
          disableVortex: prof?.disable_vortex || false,
          avatarUrl: prof?.avatar_url || undefined,
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

    // 🛡️ Безопасный слушатель сессии
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && currentUserRef.current) return;
      if (event === 'USER_UPDATED' && currentUserRef.current) return;
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

    const cleanNick = onboardingNickname.trim() || 'Student';
    const cleanKey = onboardingApiKey.trim();

    // 1. Сначала сохраняем профиль
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: pendingSession.session.user.id,
      email: pendingSession.email,
      nickname: cleanNick,
      study_year: onboardingYear,
    });

    if (profileError) {
      setIsSavingOnboarding(false);
      setOnboardingError(`Could not save your profile: ${profileError.message}`);
      return;
    }

    // 2. Затем обновляем пароль
    const { error: pwdError } = await supabase.auth.updateUser({
      password: onboardingPassword,
    });

    if (pwdError) {
      setIsSavingOnboarding(false);
      setOnboardingError('Profile saved, but failed to set password: ' + pwdError.message);
      return;
    }

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

  const rootThemeClass = uiTheme === 'dark_glass' ? 'theme-dark-glass' : uiTheme === 'glass' ? 'theme-glass' : '';

  return (
    <div className={`relative min-h-[100dvh] h-screen w-full overflow-hidden text-slate-100 selection:bg-[#3ccb57]/30 selection:text-white flex flex-col justify-between ${rootThemeClass}`}>
      
      {/* 💎 ПЛАТИНОВОЕ СТЕКЛО ДЛЯ ВСЕХ ОКОН И НАСТРОЕК 💎 */}
      {uiTheme !== 'standard' && (
        <style>{`
          /* Отключаем лагающие GPU-блюры */
          .theme-glass .backdrop-blur-md,
          .theme-glass .backdrop-blur-xl,
          .theme-glass .backdrop-blur-2xl,
          .theme-glass .backdrop-blur-3xl,
          .theme-dark-glass .backdrop-blur-md,
          .theme-dark-glass .backdrop-blur-xl,
          .theme-dark-glass .backdrop-blur-2xl,
          .theme-dark-glass .backdrop-blur-3xl {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* 1. РЕЖИМ «СТЕКЛО» (Оптимальная плотность 90%, световая фаска, 0% потери плавности) */
          .theme-glass .bg-\\[\\#060c20\\]\\/90,
          .theme-glass .bg-\\[\\#060c20\\]\\/85,
          .theme-glass .bg-\\[\\#060c20\\]\\/80,
          .theme-glass .bg-\\[\\#060c20\\]\\/98,
          .theme-glass .bg-\\[\\#060c20\\] {
            background: linear-gradient(145deg, rgba(22, 34, 54, 0.88) 0%, rgba(9, 15, 28, 0.94) 100%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.22) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.04) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 28px rgba(0, 0, 0, 0.35) !important;
            contain: paint !important;
          }

          /* Шапка сайта */
          .theme-glass .bg-\\[\\#080b14\\]\\/95 {
            background: linear-gradient(to right, rgba(14, 20, 34, 0.94), rgba(8, 12, 22, 0.98)) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          }

          /* 🌟 ТЕПЕРЬ И КАРТОЧКИ ВНУТРИ НАСТРОЕК СТАЛИ СТЕКЛЯННЫМИ! 🌟 */
          .theme-glass .bg-white\\/\\[0\\.02\\] {
            background: linear-gradient(140deg, rgba(255, 255, 255, 0.09) 0%, rgba(24, 38, 64, 0.65) 24%, rgba(10, 18, 36, 0.82) 70%, rgba(6, 12, 26, 0.9) 100%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.22) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.4), 0 14px 32px rgba(0, 0, 0, 0.4) !important;
          }

          /* Главная панель окна настроек */
          .theme-glass .bg-\\[\\#080d1e\\] {
            background: linear-gradient(150deg, rgba(20, 32, 54, 0.92) 0%, rgba(8, 14, 28, 0.97) 100%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.22) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12), 0 20px 50px rgba(0, 0, 0, 0.5) !important;
          }

          /* Боковая колонка настроек (Sidebar) */
          .theme-glass .bg-\\[\\#040816\\] { 
            background: linear-gradient(180deg, rgba(16, 26, 44, 0.96) 0%, rgba(7, 12, 22, 0.98) 100%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.22) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
          }

          /* Кнопка "Close Settings" */
          .theme-glass button.bg-white\\/5 {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
          }
          .theme-glass button.bg-white\\/5:hover {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 100%) !important;
            border-color: rgba(255, 255, 255, 0.24) !important;
          }

          /* Активная вкладка в меню настроек */
          .theme-glass .bg-\\[\\#3ccb57\\]\\/10 {
            background: linear-gradient(135deg, rgba(60, 203, 87, 0.18) 0%, rgba(60, 203, 87, 0.05) 100%) !important;
            border: 1px solid rgba(60, 203, 87, 0.3) !important;
            box-shadow: 0 0 15px rgba(60, 203, 87, 0.1) !important;
          }

          /* Внутренние инпуты */
          .theme-glass .bg-black\\/60,
          .theme-glass .bg-black\\/50,
          .theme-glass .bg-black\\/40 {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.35) 100%) !important;
            border-top: 1px solid rgba(0, 0, 0, 0.7) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4) !important;
          }

          /* 2. РЕЖИМ «ТЁМНЫЙ ОБСИДИАН» */
          .theme-dark-glass .bg-\\[\\#060c20\\]\\/90,
          .theme-dark-glass .bg-\\[\\#060c20\\]\\/85,
          .theme-dark-glass .bg-\\[\\#060c20\\]\\/80,
          .theme-dark-glass .bg-\\[\\#060c20\\]\\/98,
          .theme-dark-glass .bg-\\[\\#060c20\\] {
            background: linear-gradient(145deg, rgba(26, 20, 26, 0.92) 0%, rgba(10, 8, 12, 0.96) 100%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.14) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.04) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.04) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.7) !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 14px 32px rgba(0, 0, 0, 0.5) !important;
            contain: paint !important;
          }

          .theme-dark-glass .bg-\\[\\#080b14\\]\\/95 {
            background: linear-gradient(to right, rgba(18, 14, 18, 0.95), rgba(9, 7, 10, 0.98)) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
          }

          /* Инпуты */
          .theme-glass .bg-black\\/60, .theme-dark-glass .bg-black\\/60 {
            background: rgba(0, 0, 0, 0.4) !important;
            border-top: 1px solid rgba(0, 0, 0, 0.7) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
          }

          /* Наведение на кнопки в тёмном режиме */
          .theme-dark-glass .hover\\:border-\\[\\#3ccb57\\]\\/50:hover {
            border-color: rgba(180, 75, 100, 0.5) !important;
            box-shadow: 0 0 20px rgba(180, 75, 100, 0.15) !important;
          }
        `}</style>
      )}

      <BackgroundGradients showVortex={!currentUser?.disableVortex} theme={uiTheme} />

      <div className="relative z-10 flex flex-col h-full w-full justify-between overflow-hidden">
        {!currentUser && <Navbar />}

        <main className={`flex-1 min-h-0 w-full flex flex-col justify-start overflow-x-hidden ${currentUser ? 'items-stretch overflow-hidden p-0' : 'items-center px-3 sm:px-6 lg:px-8 py-3 sm:py-6 overflow-y-auto'}`}>
          {currentUser ? (
            <AuthenticatedWorkspace
              user={currentUser}
              onSignOut={async () => {
                await supabase.auth.signOut();
                setCurrentUser(null);
              }}
              onApiKeyUpdated={(k) => setCurrentUser((prev) => (prev ? { ...prev, apiKey: k } : null))}
              onVortexToggled={(disabled) => setCurrentUser((prev) => (prev ? { ...prev, disableVortex: disabled } : null))}
              uiTheme={uiTheme}
              onUiThemeToggled={handleThemeToggle}
            />
          ) : (
            <AuthCard
              onSuccessAuth={(u) => setCurrentUser(u)}
              securityError={securityError}
            />
          )}
        </main>
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in text-left">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#060c20]/95 backdrop-blur-2xl p-5 sm:p-7 space-y-4 sm:space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
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
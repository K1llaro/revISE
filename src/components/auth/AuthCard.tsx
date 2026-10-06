import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { UserSession } from '../../types/ise';

export const AuthCard: React.FC<{
  onSuccessAuth: (u: UserSession) => void;
  securityError?: string | null;
}> = ({ securityError }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (securityError) {
      setStatusMessage(securityError);
    }
  }, [securityError]);

  // 🐙 Авторизация через GitHub с запросом доступа к закрытым подтвержденным адресам
  const handleGitHubSignIn = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'read:user user:email',
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
      },
    });

    if (error) {
      setIsSubmitting(false);
      setStatusMessage(error.message);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto p-8 rounded-2xl border border-white/10 bg-[#060c20]/90 backdrop-blur-2xl shadow-2xl text-center animate-fade-in space-y-6">
      {/* Логотип */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight select-none">
          rev<span className="text-[#3ccb57] drop-shadow-[0_0_20px_rgba(60,203,87,0.4)]">ISE</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 font-mono">
          Immersive Software Engineering AI Station
        </p>
      </div>

      {/* Ошибка безопасности, если почта на GitHub не подтверждена */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 text-left leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>{statusMessage}</div>
        </div>
      )}

      {/* Описание для студента */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 leading-relaxed text-left">
        <p className="mb-1 text-white font-semibold flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#3ccb57]" />
          University of Limerick Access
        </p>
        <span className="text-slate-400 text-[11px]">
          Sign in using your GitHub account associated with your verified <code className="text-[#3ccb57] font-mono">@studentmail.ul.ie</code> address.
        </span>
      </div>

      {/* Главная кнопка входа в 1 клик */}
      <button
        type="button"
        onClick={handleGitHubSignIn}
        disabled={isSubmitting}
        className="w-full py-3.5 px-5 rounded-xl font-bold text-xs bg-black text-white hover:bg-zinc-900 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-xl cursor-pointer border border-white/15 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[#3ccb57]" />
            <span>Connecting to GitHub...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02_0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </>
        )}
      </button>

      {/* Бейдж безопасности */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
        <ShieldCheck className="h-3.5 w-3.5 text-[#3ccb57]" />
        <span>Cryptographically verified student access</span>
      </div>
    </div>
  );
};
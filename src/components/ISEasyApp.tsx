import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSession, StudyYear } from '../types/ise';
import { Navbar, Footer, BackgroundGradients } from './common/LayoutComponents';
import { AuthCard } from './auth/AuthCard';
import { AuthenticatedWorkspace } from './workspace/AuthenticatedWorkspace';

export default function ISEasyApp() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase.from('profiles').select('nickname, study_year').eq('id', session.user.id).single();
        const localKey = localStorage.getItem('gemini_api_key') || undefined;
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          nickname: prof?.nickname,
          studyYear: (prof?.study_year as StudyYear) || 'year1',
          apiKey: localKey,
        });
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: prof } = await supabase.from('profiles').select('nickname, study_year').eq('id', session.user.id).single();
        const localKey = localStorage.getItem('gemini_api_key') || undefined;
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          nickname: prof?.nickname,
          studyYear: (prof?.study_year as StudyYear) || 'year1',
          apiKey: localKey,
        });

        if (event === 'SIGNED_IN' && window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden text-slate-100 selection:bg-[#3ccb57]/30 selection:text-white">
      <BackgroundGradients />

      <div className="relative z-10 flex flex-col min-h-screen justify-between">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
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
            <AuthCard onSuccessAuth={(u) => setCurrentUser(u)} />
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}